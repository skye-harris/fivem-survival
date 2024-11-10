import {findNearbyFreeVehicle, getFreeVehicleSeats, getPlayerAimTarget, loadModel, sendChat, sleep, throttle} from "../util/util";
import PedestrianHashes from "../util/PedestrianHashes";

const ALLY_MAX_HEALTH = 2000;

class AllyPed {
    constructor(pedId = 0) {
        this.allyPed = pedId;

        if (pedId) {
            AddBlipForEntity(this.allyPed)
            return;
        }

        const pedModels = Object.values(PedestrianHashes);
        const pedModel = pedModels[Math.round(Math.random() * (pedModels.length - 1))];
        const modelHash = GetHashKey(pedModel);

        const playerPedId = PlayerPedId();
        const playerCoords = GetEntityCoords(playerPedId, true);

        loadModel(modelHash)
            .then(() => {
                this.allyPed = CreatePed(4, modelHash, playerCoords[0], playerCoords[1] + 2, playerCoords[2], GetEntityHeading(playerPedId), true, true)
                AddBlipForEntity(this.allyPed)

                SetPedAsGroupMember(this.allyPed, GetPedGroupIndex(playerPedId));
                SetPedRelationshipGroupHash(this.allyPed, GetHashKey("PLAYER"));

                // todo: set up a pool of weapons to choose from
                GiveWeaponToPed(this.allyPed, GetHashKey("WEAPON_ASSAULTRIFLE"), 10000, false, false);
                GiveWeaponToPed(this.allyPed, GetHashKey("WEAPON_MICROSMG"), 10000, false, true);
                GiveWeaponToPed(this.allyPed, GetHashKey("WEAPON_GRENADELAUNCHER"), 10000, false, true);

                SetPedMaxHealth(this.allyPed, ALLY_MAX_HEALTH);
                SetEntityHealth(this.allyPed, ALLY_MAX_HEALTH);

                SetPedCombatAttributes(this.allyPed, 46, true); // Can fight armed peds
                SetPedCombatAttributes(this.allyPed, 0, true); // Can use cover
                SetPedCombatAttributes(this.allyPed, 14, true); // Ped can investigate events such as distant gunfire, footsteps, explosions etc
                SetPedCombatAttributes(this.allyPed, 20, true); // Ped can do unarmed taunts in vehicle
                SetPedCombatAttributes(this.allyPed, 21, true); // Ped will be able to chase their targets if both are on foot and the target is running away
                SetPedCombatAttributes(this.allyPed, 41, true); // Ped is allowed to "jack" vehicles when needing to chase a target in combat

                SetPedCombatAbility(this.allyPed, 2); // Set combat ability (0: poor, 1: average, 2: professional)
                SetPedCombatRange(this.allyPed, 2); // Aggressive combat range
                SetPedFleeAttributes(this.allyPed, 0, false); // Will not flee
                //SetPedAsCop(allyPed, true); // Gives police-like behavior for hostile peds
                this.followPlayerOnFoot();

                // todo: If player is in a vehicle, check for free seats, and set the ally into the vehicle if there is room
                const playerVehicle = GetVehiclePedIsIn(playerPedId, false);
                if (playerVehicle && IsAnyVehicleSeatEmpty(playerVehicle)) {
                    const freeSeat = getFreeVehicleSeats()[0];
                    TaskWarpPedIntoVehicle(this.allyPed, playerVehicle, freeSeat);
                }

                SetModelAsNoLongerNeeded(modelHash);
            })
            .catch((err) => {
                sendChat(err.message);
            });
    }

    followPlayerOnFoot() {
        TaskFollowToOffsetOfEntity(this.allyPed, PlayerPedId(), 0, -2, 0, 5.0, -1, 1.0, true);
        SetPedKeepTask(this.allyPed, true);
    }

    // Exit the current vehicle. Promise resolves after 1sec (an arbitrary delay)
    exitVehicle() {
        return new Promise((resolve, reject) => {
            TaskLeaveAnyVehicle(this.allyPed, 0, 0);

            sleep(1000)
                .then(() => {
                    resolve();
                });
        })
    }

    // Enter the specified vehicle. Checks if we managed to do so and resolves, and rejects if we couldnt get in by the timeout
    enterVehicle(vehicle, seat, timeout = 10000) {
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
                    this.followPlayerOnFoot();

                    reject(new Error('Did not enter vehicle'));
                }
            }, Math.min(timeout, 1000));
        });
    }

    // Aim at target with player, stop when player does
    aimAtTargetWithPlayer(target) {
        return new Promise((resolve, reject) => {
            TaskAimGunAtEntity(this.allyPed, target, -1, false);

            const intervalTicker = setInterval(() => {
                // If our ped no longer exists, reject promise
                if (!DoesEntityExist(this.allyPed) || IsPedDeadOrDying(this.allyPed, true) || allies.indexOf(this) === -1) {
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
        });
    }
}

let allies = [];

function findLostAllies() {
    const allPeds = GetGamePool('CPed');
    const playerId = PlayerId();

    for (let ped of allPeds) {
        if (NetworkGetEntityOwner(ped) === playerId && GetPedRelationshipGroupHash(ped) === GetHashKey('PLAYER') && !IsPedAPlayer(ped)) {
            SetPedAsNoLongerNeeded(ped);
            SetPedRelationshipGroupHash(ped, GetHashKey("CIVMALE"));
            ClearPedTasksImmediately(ped)
        }
    }
}

export default function initAllyPed() {
    let playerVehicle = GetVehiclePedIsIn(PlayerPedId(), false);
    let playerIsFreeAiming = false;

    // Lets see if we can find leftover followers from a script restart
    findLostAllies();

    RegisterCommand("spawnally", (source, args) => {
        if (allies.length < 3) {
            allies.push(new AllyPed());
        } else {
            sendChat('Max 3 allies at a time')
        }
    }, false);

    setTick(throttle(() => {
        try {
            const playerId = PlayerId();
            const playerPed = PlayerPedId();
            const playerLocation = GetEntityCoords(playerPed, false);

            allies = allies.filter((ally, index) => {
                if (ally.allyPed) {
                    if (!DoesEntityExist(ally.allyPed)) {
                        return false;
                    }

                    if (IsPedDeadOrDying(ally.allyPed, true)) {
                        SetPedAsNoLongerNeeded(ally.allyPed);
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

            const playerVehicleNow = GetVehiclePedIsIn(playerPed, false);
            const playerAimTarget = getPlayerAimTarget();

            // Did players vehicle change since we last checked?
            if (playerVehicle !== playerVehicleNow) {
                if (playerVehicleNow) {
                    // Player entered a vehicle
                    const vehicleSeats = GetVehicleModelNumberOfSeats(GetEntityModel(playerVehicleNow));
                    let allyIndex = 0;

                    for (let seat = 0; seat < vehicleSeats; seat++) {
                        if (IsVehicleSeatFree(playerVehicleNow, seat)) {
                            if (allyIndex < allies.length) {
                                allies[allyIndex].enterVehicle(playerVehicleNow, seat)
                                                 .catch(() => {
                                                     // failed to enter vehicle, keep following player
                                                     allies[allyIndex].followPlayerOnFoot();
                                                 });

                                allyIndex++;
                            } else {
                                break;
                            }
                        }
                    }

                    if (allyIndex < allies.length) {
                        // locate a nearby vehicle to put the remaining allies into
                        let allyVehicle = findNearbyFreeVehicle(allies[allyIndex].allyPed);

                        if (allyVehicle) {
                            let freeSeats = getFreeVehicleSeats(allyVehicle.entity, true);
                            let seatIndex = 0;

                            while (allyIndex < allies.length) {
                                const seat = freeSeats[seatIndex++];

                                allies[allyIndex].enterVehicle(allyVehicle.entity, seat);
                                if (seat === -1) {
                                    TaskVehicleFollow(allies[allyIndex].allyPed, allyVehicle.entity, playerPed, 80, 1074528293, 5);
                                }

                                if (seatIndex >= freeSeats.length) {
                                    allyVehicle = findNearbyFreeVehicle(allies[allyIndex].allyPed);

                                    if (!allyVehicle) {
                                        break;
                                    }

                                    freeSeats = getFreeVehicleSeats(allyVehicle.entity);
                                    seatIndex = 0;
                                }

                                allyIndex++;
                            }
                        }
                    }
                } else {
                    // Player exited their vehicle
                    allies.forEach((ally) => {
                        if (IsPedInAnyVehicle(ally.allyPed, true)) {
                            ally.exitVehicle()
                                .then(() => {
                                    ally.followPlayerOnFoot();
                                });
                        }
                    });
                }
            }

            // Is player aiming at a target?
            if (IsPlayerFreeAiming(playerId) && playerAimTarget && !playerIsFreeAiming && !IsPedInAnyVehicle(playerPed, true)) {
                playerIsFreeAiming = true;
                // Any allies not already in combat should target our target
                if (!IsPedAPlayer(playerAimTarget) && GetPedRelationshipGroupHash(playerAimTarget) !== GetHashKey('PLAYER')) {
                    allies.forEach((ally) => {
                        // Make the ally target the specified ped
                        if (!IsPedInCombat(ally.allyPed, -1)) {
                            ally.aimAtTargetWithPlayer(playerAimTarget)
                                .then(() => {
                                    ally.followPlayerOnFoot();
                                });
                        }
                    });
                }
            } else if ((!IsPlayerFreeAiming(playerId) || !playerAimTarget) && playerIsFreeAiming) {
                playerIsFreeAiming = false;
            }

            playerVehicle = playerVehicleNow;
        } catch (err) {
            sendChat(err.message);
        }
    }, 200));
}
