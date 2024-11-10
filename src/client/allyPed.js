import {findNearbyFreeVehicles, getFreeVehicleSeats, getPlayerAimTarget, isPedAnAlly, loadModel, sendChat, sleep, throttle} from "../util/util";
import PedestrianHashes from "../util/PedestrianHashes";

const ALLY_MAX_HEALTH = 2000;

class AllyPed {
    constructor() {
        this.allyPed = 0;
        this.vehicleSeat = [0,0]; // [vehicle,seat]
        this.blip = 0;

        const pedModels = Object.values(PedestrianHashes);
        const pedModel = pedModels[Math.round(Math.random() * (pedModels.length - 1))];
        const modelHash = GetHashKey(pedModel);

        const playerPedId = PlayerPedId();
        const playerCoords = GetEntityCoords(playerPedId, true);

        loadModel(modelHash)
            .then(() => {
                this.allyPed = CreatePed(4, modelHash, playerCoords[0], playerCoords[1] + 2, playerCoords[2], GetEntityHeading(playerPedId), true, true)
                this.blip = AddBlipForEntity(this.allyPed)
                SetBlipFriendly(this.blip, true);

                SetPedAsGroupMember(this.allyPed, GetPedGroupIndex(playerPedId));
                SetPedRelationshipGroupHash(this.allyPed, GetHashKey("PLAYER"));

                // todo: set up a pool of weapons to choose from
                GiveWeaponToPed(this.allyPed, GetHashKey("WEAPON_ASSAULTRIFLE"), 10000, false, false);
                GiveWeaponToPed(this.allyPed, GetHashKey("WEAPON_MICROSMG"), 10000, false, true);
                GiveWeaponToPed(this.allyPed, GetHashKey("WEAPON_GRENADELAUNCHER"), 10000, false, true);

                SetPedMaxHealth(this.allyPed, ALLY_MAX_HEALTH);
                SetEntityHealth(this.allyPed, ALLY_MAX_HEALTH);
                SetPedArmour(this.allyPed, 100);

                SetPedCombatAttributes(this.allyPed, 46, true); // Can fight armed peds
                SetPedCombatAttributes(this.allyPed, 0, true); // Can use cover
                SetPedCombatAttributes(this.allyPed, 14, true); // Ped can investigate events such as distant gunfire, footsteps, explosions etc
                SetPedCombatAttributes(this.allyPed, 20, true); // Ped can do unarmed taunts in vehicle
                SetPedCombatAttributes(this.allyPed, 21, true); // Ped will be able to chase their targets if both are on foot and the target is running away
                SetPedCombatAttributes(this.allyPed, 41, true); // Ped is allowed to "jack" vehicles when needing to chase a target in combat

                SetPedCombatAbility(this.allyPed, 2); // Set combat ability (0: poor, 1: average, 2: professional)
                SetPedCombatRange(this.allyPed, 2); // Aggressive combat range
                SetPedFleeAttributes(this.allyPed, 0, false); // Will not flee

                SetPedAccuracy(this.allyPed, 95);

                //SetPedAsCop(allyPed, true); // Gives police-like behavior for hostile peds
                //this.followPlayerOnFoot();

                // todo: If player is in a vehicle, check for free seats, and set the ally into the vehicle if there is room
                const playerVehicle = GetVehiclePedIsIn(playerPedId, false);
                if (playerVehicle && IsAnyVehicleSeatEmpty(playerVehicle)) {
                    const freeSeat = getFreeVehicleSeats()[0];
                    TaskWarpPedIntoVehicle(this.allyPed, playerVehicle, freeSeat);
                }

                this.think();

                SetModelAsNoLongerNeeded(modelHash);
            })
            .catch((err) => {
                sendChat(err.message);
            });
    }

    think() {
        if (allies.indexOf(this) === -1) {
            return;
        }

        const playerId = PlayerId();
        const playerPed = PlayerPedId();
        const playerLocation = GetEntityCoords(playerPed, false);
        const playerVehicle = GetVehiclePedIsIn(playerPed, false);
        const pedVehicle = this.vehicleSeat[0];

        // Ally is currently out of combat
        if (playerVehicle && !pedVehicle) {
            const findVehicle = this.findVehicleToEnter();
            if (findVehicle) {
                return this.enterVehicle(findVehicle[0],findVehicle[1]);
            }
        } else if (!playerVehicle && pedVehicle) {
            // exit vehicle
            return this.exitVehicle();
        } else if (playerVehicle && pedVehicle) {
            if (this.vehicleSeat[1] === -1) {
                return this.followPlayerInVehicle(2000);
            }
        } else if (!playerVehicle && !pedVehicle) {
            const playerFreeAimTarget = getPlayerAimTarget();

            if (playerFreeAimTarget) {
                return this.aimAtTargetWithPlayer(playerFreeAimTarget);
            }

            return this.followPlayerOnFoot();
        }

        return sleep(1000).then(() => this.think());
    }

    followPlayerOnFoot(timeout = 1000) {
        return new Promise(async (resolve,reject) => {
            TaskFollowToOffsetOfEntity(this.allyPed, PlayerPedId(), 0, -2, 0, 5.0, -1, 1.0, true);
            SetPedKeepTask(this.allyPed, true);

            sleep(timeout).then(() => resolve());
        }).finally(() => {
            this.think()
        });
    }

    followPlayerInVehicle(timeout = 1000) {
        return new Promise(async (resolve,reject) => {
            TaskVehicleFollow(this.allyPed, this.vehicleSeat[0], PlayerPedId(), 100, 1074528293, 5);

            sleep(timeout).then(() => resolve());
        }).finally(() => {
            this.think()
        });
    }

    findVehicleToEnter() {
        const nearbyVehicles = findNearbyFreeVehicles(this.allyPed, 30);
        for (let vehicle of nearbyVehicles) {
            const seats = getFreeVehicleSeats(vehicle, false);
            for (let seat of seats) {
                const seatAlly = getAllyUsingThisVehicleSeat(vehicle,seat);

                if (!seatAlly || seatAlly === this.allyPed) {
                    return [vehicle,seat];
                }
            }
        }

        return null;
    }

    // Exit the current vehicle. Promise resolves after 1sec (an arbitrary delay)
    exitVehicle() {
        return new Promise((resolve, reject) => {
            TaskLeaveAnyVehicle(this.allyPed, 0, 0);

            sleep(2000)
                .then(() => {
                    this.vehicleSeat = [0,0];
                    resolve();
                });
        }).finally(() => {
            this.think()
        });
    }

    // Enter the specified vehicle. Checks if we managed to do so and resolves, and rejects if we couldnt get in by the timeout
    enterVehicle(vehicle, seat, timeout = 5000) {
        this.vehicleSeat = [vehicle,seat];

        return new Promise((resolve, reject) => {
            TaskEnterVehicle(this.allyPed, vehicle, timeout, seat, 2, 1, 0);

            let timer = 0;
            const intervalTicker = setInterval(() => {
                if (IsPedInVehicle(this.allyPed, vehicle, true)) {
                    clearInterval(intervalTicker);
                    resolve(vehicle,seat);

                    return;
                }

                timer += 1000;
                if (timer >= timeout) {
                    clearInterval(intervalTicker);
                    this.vehicleSeat = [0,0];
                    //this.followPlayerOnFoot();

                    reject(new Error('Did not enter vehicle in time'));
                }
            }, Math.min(timeout, 1000));
        }).finally(() => {
            this.think();
        });
    }

    // Aim at target with player, stop when player does
    aimAtTargetWithPlayer(target) {
        return new Promise((resolve, reject) => {
            TaskAimGunAtEntity(this.allyPed, target, -1, false);

            const intervalTicker = setInterval(() => {
                // If our ped no longer exists, reject promise
                if (!DoesEntityExist(this.allyPed) || IsPedDeadOrDying(this.allyPed, true) || allies.indexOf(this) === -1) {
                    clearInterval(intervalTicker);
                    reject(new Error('Ped no longer exists'));
                    return;
                }

                // If player is no longer aiming at target, or we've moved on, resolve promise
                if (
                    IsPedInCombat(this.allyPed, -1)
                    || !DoesEntityExist(target)
                    || IsPedDeadOrDying(target, true)
                    || !IsPlayerFreeAiming(PlayerId())
                    || getPlayerAimTarget() !== target
                ) {
                    clearInterval(intervalTicker);

                    resolve(target);
                }
            }, 2000);
        }).finally(() => {
            this.think()
        });
    }

    // Attack the target. Promise resolves if the target dies or ceases to exist, or we have otherwise left combat (eg we are too far away)
    attackTarget(target) {
        return new Promise((resolve, reject) => {
            TaskCombatPed(this.allyPed, target, 0, 16);

            const intervalTicker = setInterval(() => {
                // If we are no longer in combat, our target is dead or doesnt exist, or *WE* no longer exist... we clear our interval
                if (!IsPedInCombat(this.allyPed, -1) || !DoesEntityExist(target) || IsPedDeadOrDying(target, true) || allies.indexOf(this) === -1) {
                    clearInterval(intervalTicker);

                    resolve();
                }
            }, 1000);
        }).finally(() => {
            this.think()
        });
    }
}

let allies = [];

function getAllyUsingThisVehicleSeat(vehicle,seat) {
    return allies.find((ally) => {
        return ally.vehicleSeat[0] === vehicle && ally.vehicleSeat[1] === seat;
    }) || null;
}

function cleanupLostAllies() {
    const allPeds = GetGamePool('CPed');
    const playerId = PlayerId();

    for (let ped of allPeds) {
        if (isPedAnAlly(ped, true)) {
            SetPedAsNoLongerNeeded(ped);
            SetPedRelationshipGroupHash(ped, GetHashKey("CIVMALE"));
            ClearPedTasksImmediately(ped)
        }
    }
}

export default function initAllyPed() {
    // Lets see if we can find leftover followers from a script restart
    cleanupLostAllies();

    RegisterCommand("spawnally", (source, args) => {
        if (allies.length < 3) {
            const ally = new AllyPed();
            allies.push(ally);
        } else {
            sendChat('Max 3 allies at a time')
        }
    }, false);

    setTick(throttle(() => {
        const playerPed = PlayerPedId();
        const playerLocation = GetEntityCoords(playerPed, false);

        allies = allies.filter((ally, index) => {
            if (ally.allyPed) {
                if (!DoesEntityExist(ally.allyPed)) {
                    RemoveBlip(ally.blip);
                    return false;
                }

                if (IsPedDeadOrDying(ally.allyPed, true)) {
                    SetPedAsNoLongerNeeded(ally.allyPed);
                    RemoveBlip(ally.blip);

                    return false;
                }

                const allyLocation = GetEntityCoords(ally.allyPed, false);
                const allyDistance = GetDistanceBetweenCoords(playerLocation[0],playerLocation[1],playerLocation[2],allyLocation[0],allyLocation[1],allyLocation[2],true)
                if (allyDistance > 400) {
                    SetPedAsNoLongerNeeded(ally.allyPed);
                    return false;
                }
            }

            return true;
        });
    }, 5000));
}
