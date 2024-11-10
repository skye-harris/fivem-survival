import {debugChat, findNearbyFreeVehicles, getFreeVehicleSeats, getPlayerAimTarget, isPedAnAlly, loadModel, sendChat, sleep, throttle} from "../util/util";
import PedestrianHashes from "../util/PedestrianHashes";

const ALLY_MAX_HEALTH = 2000;
const ALLY_LIMIT = 8;

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
                SetPedCanRagdoll(this.allyPed,false);

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
                this.followPlayerOnFoot();

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

        const playerPed = PlayerPedId();
        const playerVehicle = GetVehiclePedIsIn(playerPed, false);
        const pedVehicle = this.vehicleSeat[0];
        const nowVehicle = GetVehiclePedIsIn(this.allyPed, false);
        const playerFreeAimTarget = getPlayerAimTarget();

        // Ally is currently out of combat
        if (playerVehicle && !pedVehicle) {
                const findVehicle = this.findVehicleToEnter();
                if (findVehicle) {
                    debugChat(`found vehicle ${findVehicle[0]} and seat ${findVehicle[1]}`)
                    return this.enterVehicle(findVehicle[0], findVehicle[1])
                               .then(() => {
                                   this.think();
                               })
                               .catch((err) => {
                                   debugChat(err.message);
                               });
                } else {
                    debugChat('No vehicle')
                }
        } else if (!playerVehicle && nowVehicle) {
            // exit vehicle
            return this.exitVehicle();
        } else if (playerVehicle && nowVehicle) {
            if (this.vehicleSeat[1] === -1) {
                return this.followPlayerInVehicle(2000);
            }
        } else if (!playerVehicle && !pedVehicle && playerFreeAimTarget) {
            return this.aimAtTargetWithPlayer(playerFreeAimTarget);
        } else if (!IsPedInCombat(this.allyPed, -1)) {
            sendChat(`ally following on foot`)
            this.followPlayerOnFoot();
        }

        return sleep(1000).then(() => this.think());
    }

    followPlayerOnFoot() {
        TaskFollowToOffsetOfEntity(this.allyPed, PlayerPedId(), 0, -2, 0, 5.0, -1, 1.0, true);
        SetPedKeepTask(this.allyPed, true);
    }

    followPlayerInVehicle(timeout = 1000) {
        debugChat(`Ally ${this.allyPed} followPlayerInVehicle`)

        return new Promise(async (resolve,reject) => {
            TaskVehicleFollow(this.allyPed, this.vehicleSeat[0], PlayerPedId(), 100, 1074528293, 5);

            sleep(timeout).then(() => resolve());
        }).finally(() => {
            this.think()
        });
    }

    findVehicleToEnter() {
        debugChat(`Ally ${this.allyPed} findVehicleToEnter`)
        const nearbyVehicles = findNearbyFreeVehicles(this.allyPed, 30);
        debugChat(nearbyVehicles);

        for (let vehicle of nearbyVehicles) {
            try {
                const seats = GetVehicleModelNumberOfSeats(GetEntityModel(vehicle));//getFreeVehicleSeats(vehicle, false);
                for (let seat = -1; seat < seats-1; seat++) {
                    const seatAlly = getAllyUsingThisVehicleSeat(vehicle, seat);

                    if ((!seatAlly || seatAlly === this.allyPed) && GetPedInVehicleSeat(vehicle,seat) !== PlayerPedId()) {
                        return [vehicle, seat];
                    }
                }
            } catch (err) {
                debugChat(err.message)
            }
        }

        return null;
    }

    // Exit the current vehicle. Promise resolves after 1sec (an arbitrary delay)
    exitVehicle() {
        debugChat(`Ally ${this.allyPed} exitVehicle`)

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
        debugChat(`Ally ${this.allyPed} enterVehicle`)
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

                    reject(new Error('Did not enter vehicle in time'));
                }
            }, Math.min(timeout, 1000));
        })
    }

    // Aim at target with player, stop when player does
    aimAtTargetWithPlayer(target) {
        debugChat(`Ally ${this.allyPed} aimAtTargetWithPlayer`)
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
        debugChat(`Ally ${this.allyPed} attackTarget`)
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

    for (let ped of allPeds) {
        if (isPedAnAlly(ped, true)) {
            SetPedAsNoLongerNeeded(ped);
            SetPedRelationshipGroupHash(ped, GetHashKey("CIVMALE"));
            ClearPedTasksImmediately(ped);
            SetPedMaxHealth(ped,100);
            SetPedArmour(ped,0);
        }
    }
}

export default function initAllyPed() {
    // Lets see if we can find leftover followers from a script restart
    cleanupLostAllies();

    RegisterCommand("killallies", (source, args) => {
        for (let ally of allies) {
            ApplyDamageToPed(ally.allyPed, 100000000);
        }
    }, false);

    RegisterCommand("spawnally", (source, args) => {
        if (allies.length < ALLY_LIMIT) {
            const ally = new AllyPed();
            allies.push(ally);
        } else {
            sendChat(`Max ${ALLY_LIMIT} allies at a time`)
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
