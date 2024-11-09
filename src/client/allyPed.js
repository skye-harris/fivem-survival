import {getPlayerAimTarget, loadModel, sendChat, sleep, throttle} from "../util/util";

class AllyPed {
    constructor(model = 'a_m_m_rurmeth_01') {
        this.allyPed = 0;

        const playerPedId = PlayerPedId();
        const playerCoords = GetEntityCoords(playerPedId, true);
        const modelHash = GetHashKey(model);

        loadModel(modelHash)
            .then(() => {
                this.allyPed = CreatePed(4, modelHash, playerCoords[0], playerCoords[1] + 2, playerCoords[2], GetEntityHeading(playerPedId), true, true)

                SetPedAsGroupMember(this.allyPed, GetPedGroupIndex(playerPedId));
                SetPedRelationshipGroupHash(this.allyPed, GetHashKey("PLAYER"));

                // todo: set up a pool of weapons to choose from
                GiveWeaponToPed(this.allyPed, GetHashKey("WEAPON_ASSAULTRIFLE"), 10000, false, true);

                SetPedCombatAttributes(this.allyPed, 46, true); // Can fight armed peds
                SetPedCombatAbility(this.allyPed, 2); // Set combat ability (0: poor, 1: average, 2: professional)
                SetPedCombatRange(this.allyPed, 2); // Aggressive combat range
                SetPedFleeAttributes(this.allyPed, 0, false); // Will not flee
                //SetPedAsCop(allyPed, true); // Gives police-like behavior for hostile peds

                // todo: If player is in a vehicle, check for free seats, and set the ally into the vehicle if there is room
                // const playerVehicle = GetVehiclePedIsIn(playerPedId, false);
                // if (playerVehicle && IsAnyVehicleSeatEmpty(playerVehicle)) {
                //     this.enterVehicle(playerVehicle, -1, 10000).catch(() => {
                //         this.followPlayerOnFoot();
                //     });
                // } else {
                //     this.followPlayerOnFoot();
                // }
                this.followPlayerOnFoot();

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
        return new Promise((resolve,reject) => {
            TaskLeaveAnyVehicle(this.allyPed, 0, 0);

            sleep(1000).then(() => {
                resolve();
            });
        })
    }

    // Enter the specified vehicle. Checks if we managed to do so and resolves, and rejects if we couldnt get in by the timeout
    enterVehicle(vehicle, seat, timeout= 10000) {
        return new Promise((resolve,reject) => {
            TaskEnterVehicle(this.allyPed, vehicle, timeout, seat, 2, 1, 0);

            let timer = 0;
            const intervalTicker = setInterval(() => {
                if (IsPedInVehicle(this.allyPed, vehicle, true)) {
                    clearInterval(intervalTicker);
                    resolve();

                    return;
                }

                timer += 1000;
                if (timer >= timeout) {
                    clearInterval(intervalTicker);
                    reject(new Error('Did not enter vehicle'));
                }
            }, Math.min(timeout,1000));
        });
    }

    // Attack the target. Promise resolves if the target dies or ceases to exist, or we have otherwise left combat (eg we are too far away)
    attackTarget(target) {
        return new Promise((resolve,reject) => {
            TaskCombatPed(this.allyPed, target, 0, 16);
            SetPedKeepTask(this.allyPed, true);

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

export default function initAllyPed() {
    let playerVehicle = IsPedInAnyVehicle(PlayerPedId(), true);

    RegisterCommand("spawnally", (source, args) => {
        // todo: select model from a pool

        allies.push(new AllyPed());
    }, false);

    setTick(throttle(() => {
        allies = allies.filter((ally) => {
            if (!DoesEntityExist(ally.allyPed)) {
                return false;
            }

            if (IsPedDeadOrDying(ally.allyPed, true)) {
                return false;
            }

            return true;
        });

        const playerId = PlayerId();
        const playerPed = PlayerPedId();
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
                            allies[allyIndex].enterVehicle(playerVehicleNow, seat).catch(() => {
                                // failed to enter vehicle, keep following player
                                allies[allyIndex].followPlayerOnFoot();
                            });

                            allyIndex++;
                        } else {
                            break;
                        }
                    }
                }
            } else {
                // Player exited their vehicle
                allies.map((ally) => {
                    if (IsPedInAnyVehicle(ally.allyPed, true)) {
                        ally.exitVehicle().then(() => {
                            ally.followPlayerOnFoot();
                        });
                    }
                });
            }
        }

        // Is player aiming at a target?
        if (IsPlayerFreeAiming(playerId)) {
            // Any allies not already in combat should target our target
            if (IsEntityAPed(playerAimTarget) && !IsPedDeadOrDying(playerAimTarget, true) && !IsPedAPlayer(playerAimTarget) && GetPedRelationshipGroupHash(playerAimTarget) !== GetHashKey('PLAYER')) {
                allies.map((ally) => {
                    // Make the ally target the specified ped
                    if (!IsPedInCombat(ally.allyPed, -1)) {
                        ally.attackTarget(playerAimTarget).then(() => {
                            ally.followPlayerOnFoot();
                        });
                    }
                });
            }
        }

        playerVehicle = playerVehicleNow;
    }, 1000));
}