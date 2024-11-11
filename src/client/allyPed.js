import {debugChat, distanceBetweenEntities, findNearbyFreeVehicles, findVehicleSpawnPointOutOfSight, getFreeVehicleSeats, getPlayerAimTarget, isPedAnAlly, loadModel, sendChat, sleep, throttle} from "../util/util";
import PedestrianHashes from "../util/PedestrianHashes";
import {Ped, VehicleHash} from "fivem-js";

const ALLY_MAX_HEALTH = 2000;
const ALLY_LIMIT = 8;
const ALLY_IGNORE_EVENTS_DISTANCE = 60;
const ALLY_EXIT_VEHICLE_DISTANCE = 10;

class AllyPed {
    constructor() {
        this.allyPed = 0;
        this.vehicleSeat = [0,0]; // [vehicle,seat]
        this.blip = 0;
        this.currentThink = null;
        this.ignoringTemporaryEvents = false;

        const pedModels = Object.values(PedestrianHashes);
        const pedModel = pedModels[Math.round(Math.random() * (pedModels.length - 1))];
        const modelHash = GetHashKey(pedModel);

        const playerPedId = PlayerPedId();
        const playerCoords = GetEntityCoords(playerPedId, true);

        loadModel(modelHash)
            .then(async () => {
                let spawnCoords = findVehicleSpawnPointOutOfSight(PlayerPedId(), 60, 100);
                const spawnVehicle = !!spawnCoords;
                let vehicleHash = null;

                spawnCoords = spawnCoords ||  [playerCoords[0], playerCoords[1] + 2, playerCoords[2]];
                const playerVehicle = GetVehiclePedIsIn(playerPedId, false);

                if (spawnVehicle) {
                    const vehicles = [
                        VehicleHash.Sanctus,
                        VehicleHash.ZombieB,
                        VehicleHash.Defiler,
                        VehicleHash.Avarus,
                        VehicleHash.Cliffhanger,
                        VehicleHash.Chimera,
                        VehicleHash.Hexer,
                        VehicleHash.Esskey,
                        VehicleHash.Manchez,
                    ];
                    vehicleHash = vehicles[Math.round(Math.random() * vehicles.length-1)]
                    await loadModel(vehicleHash);
                }

                this.allyPed = CreatePed(4, modelHash, spawnCoords[0], spawnCoords[1] , spawnCoords[2], GetEntityHeading(playerPedId), true, true)
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
                SetPedRandomProps(this.allyPed);

                SetPedCanRagdoll(this.allyPed,false);
                SetPedCanBeDraggedOut(this.allyPed, false);
                SetPedCanBeKnockedOffVehicle(this.allyPed,false);

                SetPedPathCanUseClimbovers(this.allyPed, true);
                SetPedPathCanUseLadders(this.allyPed, true);
                SetPedPathCanDropFromHeight(this.allyPed, true);

                SetPedCombatAttributes(this.allyPed, 0, true); // Can use cover
                SetPedCombatAttributes(this.allyPed, 14, true); // Ped can investigate events such as distant gunfire, footsteps, explosions etc
                SetPedCombatAttributes(this.allyPed, 20, true); // Ped can do unarmed taunts in vehicle
                SetPedCombatAttributes(this.allyPed, 21, true); // Ped will be able to chase their targets if both are on foot and the target is running away
                SetPedCombatAttributes(this.allyPed, 41, true); // Ped is allowed to "jack" vehicles when needing to chase a target in combat
                SetPedCombatAttributes(this.allyPed, 46, true); // Can fight armed peds

                SetPedCombatAbility(this.allyPed, 2); // Set combat ability (0: poor, 1: average, 2: professional)
                SetPedCombatRange(this.allyPed, 2); // Aggressive combat range
                SetPedFleeAttributes(this.allyPed, 0, false); // Will not flee

                SetPedAccuracy(this.allyPed, 95);
                //SetEntityInvincible(this.allyPed, true);

                this.followPlayerOnFoot();

                if (spawnVehicle) {
                    const vehicle = CreateVehicle(vehicleHash, spawnCoords[0], spawnCoords[1], spawnCoords[2], spawnCoords[3], true, false);
                    SetPedIntoVehicle(this.allyPed, vehicle, -1);

                    this.followPlayerInVehicle(vehicle, playerVehicle)
                } else {
                    // If player is in a vehicle, check for free seats, and set the ally into the vehicle if there is room
                    if (playerVehicle && IsAnyVehicleSeatEmpty(playerVehicle)) {
                        const freeSeat = getFreeVehicleSeats()[0];
                        TaskWarpPedIntoVehicle(this.allyPed, playerVehicle, freeSeat);
                    }
                }

                this.think();

                SetModelAsNoLongerNeeded(modelHash);
            })
            .catch((err) => {
                debugChat(err.message);
            });
    }

    think() {
        if (allies.indexOf(this) === -1) {
            debugChat(`Ally think task ending (died, out of range, etc)`)
            return;
        }

        if (!this.currentThink) {
            (() => {
                const playerPed = PlayerPedId();
                const playerVehicle = GetVehiclePedIsIn(playerPed, false);
                const pedVehicleUsing = GetVehiclePedIsUsing(this.allyPed) || GetVehiclePedIsTryingToEnter(this.allyPed);
                const pedActuallyInVehicle = GetVehiclePedIsIn(this.allyPed, false);
                const playerFreeAimTarget = getPlayerAimTarget();
                const distanceFromPlayer = distanceBetweenEntities(playerPed,this.allyPed);
                const isInCombat = IsPedInCombat(this.allyPed, -1);

                if (distanceFromPlayer > ALLY_IGNORE_EVENTS_DISTANCE && !this.ignoringTemporaryEvents) {
                    this.ignoringTemporaryEvents = true;
                    TaskSetBlockingOfNonTemporaryEvents(this.allyPed, true)
                    debugChat(`Ally ${this.allyPed} is now ignoring temporary events`)
                } else if (distanceFromPlayer < ALLY_IGNORE_EVENTS_DISTANCE-5 && this.ignoringTemporaryEvents) {
                    this.ignoringTemporaryEvents = false;
                    TaskSetBlockingOfNonTemporaryEvents(this.allyPed, false)
                    debugChat(`Ally ${this.allyPed} is no longer ignoring temporary events`)
                }

                if (playerVehicle && !pedVehicleUsing && (!isInCombat || this.ignoringTemporaryEvents)) {
                    const findVehicle = this.findVehicleToEnter();
                    if (findVehicle) {
                        debugChat(`found vehicle ${findVehicle[0]} and seat ${findVehicle[1]}`)
                        this.currentThink = this.enterVehicle(findVehicle[0], findVehicle[1]);

                        return;
                    }
                }

                if (playerVehicle && pedActuallyInVehicle && GetPedInVehicleSeat(pedActuallyInVehicle, -1) === this.allyPed && distanceFromPlayer > 30) {
                    // drive towards player
                    this.followPlayerInVehicle(pedActuallyInVehicle, playerVehicle);

                    return;
                }

                if (!playerVehicle && pedActuallyInVehicle && distanceFromPlayer <= ALLY_EXIT_VEHICLE_DISTANCE) {
                    // exit vehicle
                    this.currentThink = this.exitVehicle();

                    return;
                }

                if (!playerVehicle && !pedActuallyInVehicle && playerFreeAimTarget && playerFreeAimTarget !== this.allyPed) {
                    this.currentThink = this.aimAtTargetWithPlayer(playerFreeAimTarget);

                    return;
                }
            })();
        }

        sleep(1000).then(() => this.think());
    }

    followPlayerOnFoot() {
        TaskFollowToOffsetOfEntity(this.allyPed, PlayerPedId(), 0, -2, 0, 5.0, -1, 1.0, true);
        SetPedKeepTask(this.allyPed, true);
    }

    followPlayerInVehicle(vehicle, playerVehicle) {
        debugChat(`Ally ${this.allyPed} followPlayerInVehicle`)

        if (playerVehicle) {
            TaskVehicleEscort(this.allyPed, vehicle, playerVehicle, -1, 100, 6, 5, 0, 30);
        } else {
            const playerCoords = GetEntityCoords(PlayerPedId(), false);
            TaskVehicleDriveToCoord(this.allyPed, vehicle, playerCoords[0], playerCoords[1], playerCoords[2], 60, 0, VehicleHash.Bullet, 6, 5, 0)
        }
    }

    findVehicleToEnter() {
        const nearbyVehicles = findNearbyFreeVehicles(this.allyPed, 30);

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
            //this.think()
            this.currentThink = null;
        });
    }

    // Enter the specified vehicle. Checks if we managed to do so and resolves, and rejects if we couldnt get in by the timeout
    enterVehicle(vehicle, seat, timeout = 5000) {
        debugChat(`Ally ${this.allyPed} enterVehicle`)
        this.vehicleSeat = [vehicle,seat];

        return new Promise((resolve, reject) => {
            const currDriverPed = GetPedInVehicleSeat(vehicle,seat);
            // if (IsPedDeadOrDying(currDriverPed, false)) {
            //     DeletePed(currDriverPed);
            // }
            TaskEnterVehicle(this.allyPed, vehicle, timeout, seat, 2, 8, 0);

            let timer = 0;
            const intervalTicker = setInterval(() => {
                if (IsPedInVehicle(this.allyPed, vehicle, true)) {
                    clearInterval(intervalTicker);
                    resolve(vehicle,seat);

                    const inVehicleTicker = setInterval(() => {
                        if (!IsPedInVehicle(this.allyPed, vehicle, true)) {
                            this.vehicleSeat = [0,0];
                            clearTimeout(inVehicleTicker);
                        }
                    }, 1000);

                    return;
                }

                timer += 1000;
                if (timer >= timeout) {
                    clearInterval(intervalTicker);
                    this.vehicleSeat = [0,0];

                    reject(new Error('Did not enter vehicle in time'));
                }
            }, Math.min(timeout, 1000));
        }).finally(() => {
            //this.think();
            this.currentThink = null;
        });
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
            //this.think()
            this.currentThink = null;
        });
    }

    // Attack the target. Promise resolves if the target dies or ceases to exist, or we have otherwise left combat (eg we are too far away)
    attackTarget(target) {
        debugChat(`Ally ${this.allyPed} attackTarget ${target}`)
        return new Promise((resolve, reject) => {
            if (IsEntityAPed(target)) {
                TaskCombatPed(this.allyPed, target, 0, 16);
            } else {
                TaskShootAtEntity(this.allyPed, target, 4, GetHashKey('FIRING_PATTERN_BURST_FIRE'));
            }

            const intervalTicker = setInterval(() => {
                // If we are no longer in combat, our target is dead or doesnt exist, or *WE* no longer exist... we clear our interval
                if (!IsPedInCombat(this.allyPed, -1) || !DoesEntityExist(target) || IsPedDeadOrDying(target, true) || allies.indexOf(this) === -1) {
                    clearInterval(intervalTicker);

                    resolve();
                }
            }, 1000);
        }).finally(() => {
            //this.think()
            this.currentThink = null;
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
            DeletePed(ped);
        }
    }
}

export default function initAllyPed() {
    // Lets see if we can find leftover followers from a script restart
    setTimeout(() => {
        cleanupLostAllies();
    }, 1000);

    RegisterCommand("killallies", (source, args) => {
        for (let ally of allies) {
            SetEntityInvincible(ally.allyPed, false);
            ApplyDamageToPed(ally.allyPed, 100000, true);
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

debugChat('skymod initialised')