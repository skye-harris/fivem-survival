import {debounce, debugChat, distanceBetweenEntities, findNearbyFreeVehicles, getPlayerAimTarget, loadModel, sendChat, sleep, throttle} from "../util/util";
import PedestrianHashes from "../util/PedestrianHashes";
import {VehicleHash} from "fivem-js";
import config from "./config";
import {CombatAttributes} from "../util/CombatAttributes";

const MAX_HEALTH = 1000;
const CONGLOMERATE_RADIUS = 10;
const TRIGGER_MOVE_RADIUS = 15;

const States = {
    Dead: -1,
    Loading: 0,
    FollowPlayerOnFoot: 1,
    FollowPlayerInVehicleAsDriver: 2,
    FollowPlayerInVehicleAsPassenger: 3,
    FollowPlayerOnFootAiming: 4,
    StandingByPlayer: 5,
    StandingByPlayerAiming: 6,
    CombatAroundPlayer: 7,
}

let GameState = {
    EntityPlayerRecentlyDamaged: 0,
    EntityPlayerIsFreeAimingAt: 0,
};

let ViableCombatTargets = [];

class AiBot {
    constructor() {
        this.ped = 0;
        this.blip = 0;
        this.state = States.Loading;
        this.thought = new Promise((resolve) => resolve());
        this.targetEntity = 0;

        this.pedState = {
            distanceFromPlayer: 0,
            playerVehicle: 0,
            vehicleWeAreIn: 0,
            vehicleWeAreUsing: 0,
            vehicleSeat: 0,
            combatTargetChanged: false,
            combatTarget: 0,
            freeAimTarget: 0,
        };

        this.throttledTargetting = throttle(() => {
            const newTarget = this.findClosestViableTarget();
            debugChat('scan for better target')

            if (newTarget && newTarget !== this.pedState.combatTarget) {
                this.pedState.combatTarget = newTarget;
                this.pedState.combatTargetChanged = true;
                debugChat(`Set combat target to ${this.pedState.combatTarget} at a distance of ${distanceBetweenEntities(this.ped, this.pedState.combatTarget)}`)
            }
        }, 10000);

        const pedModels = Object.values(PedestrianHashes);
        const pedModel = pedModels[Math.round(Math.random() * (pedModels.length - 1))];
        const modelHash = GetHashKey(pedModel);

        const playerPedId = PlayerPedId();
        const playerCoords = GetEntityCoords(playerPedId, true);

        loadModel(modelHash)
            .then(async () => {
                const spawnCoords = [playerCoords[0], playerCoords[1] + 2, playerCoords[2]];

                this.ped = CreatePed(4, modelHash, spawnCoords[0], spawnCoords[1], spawnCoords[2], GetEntityHeading(playerPedId), true, true)
                this.blip = AddBlipForEntity(this.ped)
                SetBlipFriendly(this.blip, true);

                SetBlockingOfNonTemporaryEvents(this.ped, true);

                SetPedAsGroupMember(this.ped, GetPedGroupIndex(playerPedId));
                SetPedRelationshipGroupHash(this.ped, GetHashKey("ALLY_GROUP"));
                SetEntityCanBeDamagedByRelationshipGroup(this.ped, true, GetHashKey("ALLY_GROUP"));
                SetPedCanBeTargetted(this.ped, true);
                SetPedCanBeTargettedByPlayer(this.ped, PlayerId(), true);
                SetPedCanBeTargettedByTeam(this.ped, GetPedGroupIndex(playerPedId), true);
                SetPedCanTeleportToGroupLeader(this.ped, GetPedGroupIndex(playerPedId), true);

                // todo: set up a pool of weapons to choose from
                GiveWeaponToPed(this.ped, GetHashKey("WEAPON_ASSAULTRIFLE"), 10000, false, false);
                GiveWeaponToPed(this.ped, GetHashKey("WEAPON_MICROSMG"), 10000, false, true);
                //GiveWeaponToPed(this.ped, GetHashKey("WEAPON_GRENADELAUNCHER"), 10000, false, true);

                SetPedMaxHealth(this.ped, MAX_HEALTH);
                SetEntityHealth(this.ped, MAX_HEALTH);
                SetPedArmour(this.ped, 100);

                // For the meantime lets buff our allies a bit
                SetPedCanRagdoll(this.ped, false);
                SetPedCanBeDraggedOut(this.ped, false);
                SetPedCanBeKnockedOffVehicle(this.ped, false);

                SetPedPathCanUseClimbovers(this.ped, true);
                SetPedPathCanUseLadders(this.ped, true);
                SetPedPathCanDropFromHeight(this.ped, true);

                SetPedCombatAttributes(this.ped, CombatAttributes.USE_COVER, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.DO_DRIVEBYS, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.LEAVE_VEHICLES, false);
                SetPedCombatAttributes(this.ped, CombatAttributes.CAN_INVESTIGATE, true); // Whether our ped can can investigate events such as distant gunfire, footsteps, explosions etc
                SetPedCombatAttributes(this.ped, CombatAttributes.CAN_TAUNT_IN_VEHICLE, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.CAN_CHASE_TARGET_ON_FOOT, false);
                SetPedCombatAttributes(this.ped, CombatAttributes.CAN_COMMANDEER_VEHICLES, false);
                SetPedCombatAttributes(this.ped, CombatAttributes.CAN_FIGHT_ARMED_PEDS_WHEN_NOT_ARMED, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.USE_VEHICLE_ATTACK, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.USE_VEHICLE_ATTACK_IF_VEHICLE_HAS_MOUNTED_GUNS, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.DISABLE_ALL_RANDOMS_FLEE, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.CAN_USE_DYNAMIC_STRAFE_DECISIONS, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.FLEE_WHILST_IN_VEHICLE, false);
                SetPedCombatAttributes(this.ped, CombatAttributes.JUST_FOLLOW_VEHICLE, false);
                SetPedCombatAttributes(this.ped, CombatAttributes.USE_PROXIMITY_FIRING_RATE, true);
                SetPedCombatAttributes(this.ped, CombatAttributes.CAN_USE_FRUSTRATED_ADVANCE, true);

                // Testing overriding task driving styles
                SetDriveTaskDrivingStyle(this.ped, 4 | 8 | 32 | 256 | 512 | 262144 | 2097152 | 4194304)

                SetPedCombatAbility(this.ped, 2);
                SetPedCombatRange(this.ped, 0);
                SetPedFleeAttributes(this.ped, 0, false); // Will not flee

                SetPedAccuracy(this.ped, 95);

                SetModelAsNoLongerNeeded(modelHash);

                return this.think();
            })
            .catch((err) => {
                sendChat(err.message);
            });
    }

    // Exit the current vehicle. Promise resolves after 1sec (an arbitrary delay)
    exitVehicle() {
        return new Promise((resolve, reject) => {
            debugChat('Bot exiting vehicle');
            TaskLeaveAnyVehicle(this.ped, 0, 0);
            SetBlockingOfNonTemporaryEvents(this.ped, true);

            sleep(1000)
                .then(() => {
                    resolve();
                });
        });
    }

    // Enter the specified vehicle. Checks if we managed to do so and resolves, and rejects if we couldnt get in by the timeout
    enterVehicle(vehicle, seat) {
        return new Promise((resolve, reject) => {
            let isCancelled = false;
            const cancelFunc = () => {
                isCancelled = true;
            };

            addEventListener(`bot${this.ped}:cancelThought`, cancelFunc);
            TaskEnterVehicle(this.ped, vehicle, -1, seat, 2, 8, 0);

            const internalTicker = setInterval(() => {
                if (isCancelled) {
                    clearInterval(internalTicker);
                    removeEventListener(`bot${this.ped}:cancelThought`, cancelFunc);
                    debugChat('enterVehicle cancelled');
                    reject(new Error("enterVehicle task cancelled"));

                    return;
                }

                if (IsPedInVehicle(this.ped, vehicle, true)) {
                    clearInterval(internalTicker);
                    removeEventListener(`bot${this.ped}:cancelThought`, cancelFunc);
                    debugChat('Bot got into a vehicle');
                    this.pedState.vehicleSeat = seat;

                    resolve(vehicle, seat);
                    return;
                }

                if (GetVehiclePedIsTryingToEnter(this.ped) !== vehicle || GetVehiclePedIsEntering(this.ped) !== vehicle) {
                    clearInterval(internalTicker);
                    removeEventListener(`bot${this.ped}:cancelThought`, cancelFunc);
                    debugChat('Bot gave up trying to get into vehicle.. bad bot!');
                    reject(new Error("Ped is no longer using this vehicle"));
                }
            }, 500);
        });
    }

    goToVehicle(vehicle) {
        return new Promise((resolve, reject) => {
            let moveType = 0;
            let isCancelled = false;
            const cancelFunc = () => {
                isCancelled = true;
            };
            addEventListener(`bot${this.ped}:cancelThought`, cancelFunc);

            const internalTicker = setInterval(() => {
                if (isCancelled) {
                    clearInterval(internalTicker);
                    removeEventListener(`bot${this.ped}:cancelThought`, cancelFunc);
                    debugChat('goToVehicle cancelled')
                    reject(new Error("enterVehicle task cancelled"));

                    return;
                }

                const distance = distanceBetweenEntities(this.ped, vehicle);
                if (distance < 5) {
                    clearInterval(internalTicker);
                    removeEventListener(`bot${this.ped}:cancelThought`, cancelFunc);
                    debugChat('Bot is by the vehicle');
                    resolve();
                    return;
                }

                if (this.pedState.combatTarget && (moveType !== 1 || this.pedState.combatTargetChanged)) {
                    moveType = 1;
                    TaskGoToEntityWhileAimingAtEntity(this.ped, vehicle, this.pedState.combatTarget, CONGLOMERATE_RADIUS, true, 2, 0, false, false, GetHashKey("FIRING_PATTERN_FULL_AUTO"))
                } else if (this.pedState.freeAimTarget && moveType !== 2) {
                    moveType = 2;
                    TaskGoToEntityWhileAimingAtEntity(this.ped, vehicle, this.pedState.freeAimTarget, CONGLOMERATE_RADIUS, false, 2, 0, false, false, GetHashKey("FIRING_PATTERN_FULL_AUTO"))
                    debugChat('Bot is moving towards the vehicle while aiming at a target');
                } else if (!this.pedState.freeAimTarget && moveType !== 3) {
                    moveType = 3;
                    TaskGoToEntity(this.ped, vehicle, -1, CONGLOMERATE_RADIUS, 5, 0, 0);
                    debugChat('Bot is moving towards the vehicle');
                }
            }, 500);
        });
    }

    findVehicleToEnter() {
        const nearbyVehicles = findNearbyFreeVehicles(this.ped, 30);

        for (let vehicle of nearbyVehicles) {
            // const seats = getFreeVehicleSeats(vehicle, false);
            // if (seats.length) {
            // }

            const vehicleSeats = GetVehicleMaxNumberOfPassengers(vehicle);

            if (vehicleSeats) {
                let useSeat = null;

                for (let seat = -1; seat < vehicleSeats; seat++) {
                    if (IsVehicleSeatFree(vehicle, seat)) {
                        // nobody in this seat, but is anyone TRYING to be ?
                        const playerPedId = PlayerPedId();
                        const vehiclePlayerIsUsing = GetVehiclePedIsUsing(playerPedId);

                        if (vehiclePlayerIsUsing !== vehicle || (vehiclePlayerIsUsing === vehicle && GetSeatPedIsTryingToEnter(PlayerPedId()) !== seat)) {
                            useSeat = seat;
                            break;
                        }
                    }

                    const seatedPed = GetPedInVehicleSeat(vehicle, seat);
                    if (GetPedRelationshipGroupHash(seatedPed) === GetHashKey("ALLY_GROUP")) {
                        // Ped is an ally
                        continue;
                    }

                    if (IsPedAPlayer(seatedPed)) {
                        // Ped is a player
                        continue;
                    }

                    // use this seat
                    useSeat = seat;
                    break;
                }

                if (useSeat !== null) {
                    debugChat(`Bot found a vehicle to enter as ${useSeat === -1 ? 'the driver' : 'a passenger'}`)
                    return [vehicle, useSeat];
                }
            }
        }

        return null;
    }

    followPlayer() {
        const didPlayerAimChange = GameState.EntityPlayerIsFreeAimingAt !== this.pedState.freeAimTarget;
        const isAimTargetValid = GameState.EntityPlayerIsFreeAimingAt && GameState.EntityPlayerIsFreeAimingAt !== this.ped;

        if (this.pedState.vehicleWeAreIn) {
            const isDriver = this.pedState.vehicleSeat === -1;

            if (this.state !== States.FollowPlayerInVehicleAsDriver && isDriver) {
                // if we are the driver and not already driving
                debugChat('Bot is now escorting player in their own vehicle')
                this.state = States.FollowPlayerInVehicleAsDriver;
                SetBlockingOfNonTemporaryEvents(this.ped, true);
                TaskVehicleEscort(this.ped, this.pedState.vehicleWeAreIn, this.pedState.playerVehicle, -1, 100, 2, 10, 0, 20);
                SetPedKeepTask(this.ped, true);
            } else if (this.state !== States.FollowPlayerInVehicleAsPassenger && !isDriver) {
                debugChat('Bot is now riding along as a passenger')
                this.state = States.FollowPlayerInVehicleAsPassenger;

                // Let the regular ped AI take over while in vehicle as a passenger
                SetBlockingOfNonTemporaryEvents(this.ped, false);
                TaskSetBlockingOfNonTemporaryEvents(this.ped, false)
                ClearPedTasksImmediately(this.ped)
            }
        } else if (this.state !== States.FollowPlayerOnFoot || (didPlayerAimChange && this.state === States.FollowPlayerOnFoot) || this.pedState.combatTargetChanged) {
            this.state = States.FollowPlayerOnFoot;

            if (this.pedState.combatTarget) {
                TaskGoToEntityWhileAimingAtEntity(this.ped, PlayerPedId(), this.pedState.combatTarget, 5, true, CONGLOMERATE_RADIUS, 0, true, true, GetHashKey("FIRING_PATTERN_FULL_AUTO"));
                debugChat(`Bot is now following on foot, attacking target ${this.pedState.combatTarget}`)
            } else if (isAimTargetValid) {
                TaskGoToEntityWhileAimingAtEntity(this.ped, PlayerPedId(), GameState.EntityPlayerIsFreeAimingAt, 5, false, CONGLOMERATE_RADIUS, 0, true, true, GetHashKey("FIRING_PATTERN_FULL_AUTO"));
                debugChat(`Bot is now following on foot, aiming at target ${GameState.EntityPlayerIsFreeAimingAt}`)
            } else {
                TaskFollowToOffsetOfEntity(this.ped, PlayerPedId(), 0, -2, 0, 5, -1, CONGLOMERATE_RADIUS, true);
                debugChat('Bot is now following on foot')
            }

            this.pedState.freeAimTarget = GameState.EntityPlayerIsFreeAimingAt;
            SetPedKeepTask(this.ped, true);
        }
    }

    standByPlayer() {
        const didPlayerAimChange = GameState.EntityPlayerIsFreeAimingAt !== this.pedState.freeAimTarget;
        const isAimTargetValid = GameState.EntityPlayerIsFreeAimingAt && GameState.EntityPlayerIsFreeAimingAt !== this.ped;

        if (this.pedState.combatTarget) {
            if (this.state !== States.CombatAroundPlayer || this.pedState.combatTargetChanged) {
                TaskCombatPed(this.ped, this.pedState.combatTarget, 0, 16);
                debugChat(`Bot is now attacking ${this.pedState.combatTarget}`)
                this.state = States.CombatAroundPlayer;
            }
        } else {
            if ((this.state !== States.StandingByPlayerAiming && isAimTargetValid) || (this.state === States.StandingByPlayerAiming && isAimTargetValid && didPlayerAimChange)) {
                this.state = States.StandingByPlayerAiming;
                TaskAimGunAtEntity(this.ped, GameState.EntityPlayerIsFreeAimingAt, -1, false);
                debugChat(`Bot is now standing by player, aiming at target ${GameState.EntityPlayerIsFreeAimingAt}`)
            } else if ((this.state !== States.StandingByPlayer && !isAimTargetValid) || (this.state === States.StandingByPlayer && !isAimTargetValid && didPlayerAimChange)) {
                this.state = States.StandingByPlayer;
                TaskFollowToOffsetOfEntity(this.ped, PlayerPedId(), 0, -2, 0, 5, -1, CONGLOMERATE_RADIUS, true);
                //const playerCoords = GetEntityCoords(PlayerPedId(), false);
                //tASK(this.ped, this.pedState.combatTarget, -1, GetHashKey("FIRING_PATTERN_FULL_AUTO"));
                //TaskCombatHatedTargetsInArea(this.ped, playerCoords[0], playerCoords[1], playerCoords[2], 50, 0)
                //TaskGuardCurrentPosition(this.ped, CONGLOMERATE_RADIUS, 10, true);
                debugChat('Bot is now standing by player')
            }
        }

        this.pedState.freeAimTarget = GameState.EntityPlayerIsFreeAimingAt;
        SetPedKeepTask(this.ped, true);
    }

    findClosestViableTarget() {
        // We arent in combat, are there any peds we hate nearby?
        const peds = [...ViableCombatTargets].map((ped) => {
            return {
                ped: ped,
                dist: distanceBetweenEntities(this.ped, ped),
                los: HasEntityClearLosToEntity(this.ped, ped, 1|16)
            }
        }).filter((ped) => {
            return ped.dist < 100;
        },).sort((a, b) => {
            const losA = HasEntityClearLosToEntity(this.ped, a.ped, 1|16);
            const losB = HasEntityClearLosToEntity(this.ped, b.ped, 1|16);

            if (losA && !losB) {
                return losA
            } else if (losB && !losA) {
                return losB;
            }
        });

        return peds.length ? peds[0].ped : 0;
    }

    updateCombatAttribs() {
        this.pedState.combatTargetChanged = false;

        if (this.pedState.combatTarget) {
            if (DoesEntityExist(this.pedState.combatTarget) && IsEntityAPed(this.pedState.combatTarget) && !IsPedDeadOrDying(this.pedState.combatTarget, false) && !IsPedInWrithe(this.pedState.combatTarget)) {
                // stay on target
                this.throttledTargetting();
                return;
            }

            // Target died, or no longer exists
            debugChat(`our target ${this.pedState.combatTarget} is dead`)
            this.pedState.combatTarget = 0;
            this.pedState.combatTargetChanged = false;
        }

        if (!this.pedState.combatTarget && IsPedInCombat(this.ped, -1)) {
            const target = GetPedTaskCombatTarget(this.ped, 0);
            if (DoesEntityExist(target) && IsEntityAPed(target) && !IsPedDeadOrDying(target,false) && !IsPedInWrithe(this.pedState.combatTarget)) {
                this.pedState.combatTarget = target;
                this.pedState.combatTargetChanged = true;
            }
        }

        if (!this.pedState.combatTarget && ViableCombatTargets.length) {
            // We arent in combat, are there any peds we hate nearby?
            const newTarget = this.findClosestViableTarget();

            if (newTarget) {
                this.pedState.combatTarget = newTarget;
                this.pedState.combatTargetChanged = true;
                debugChat(`Set combat target to ${this.pedState.combatTarget} at a distance of ${distanceBetweenEntities(this.ped, this.pedState.combatTarget)}`)
            }
        }

    }

    async think() {
        const ticker = setTick(throttle(() => {
            const playerPed = PlayerPedId();
            if (this.state !== States.Loading && (!DoesEntityExist(this.ped) || IsPedDeadOrDying(this.ped, true)) || distanceBetweenEntities(this.ped, playerPed) > 250) {
                emit('bot:cancelThought')
                debugChat('Bot cleanup')
                clearTick(ticker);
                SetPedAsNoLongerNeeded(this.ped);
                RemoveBlip(this.blip);
                setTimeout(() => {
                    DeleteEntity(this.ped);
                }, 10000);

                return;
            }

            RegisterHatedTargetsAroundPed(this.ped, 50.0);

            this.pedState.distanceFromPlayer = distanceBetweenEntities(this.ped, playerPed);
            this.pedState.playerVehicle = GetVehiclePedIsIn(playerPed, false);
            this.pedState.vehicleWeAreIn = GetVehiclePedIsIn(this.ped, false);
            this.pedState.vehicleWeAreUsing = GetVehiclePedIsUsing(this.ped);

            this.updateCombatAttribs();

            if (this.pedState.playerVehicle && !this.pedState.vehicleWeAreUsing) {
                // Player in vehicle, and we are not "using" a vehicle at all, try find and enter one
                const [vehicle, seat] = this.findVehicleToEnter();
                if (vehicle) {
                    emit('bot:cancelThought')
                    this.thought.finally(() => this.enterVehicle(vehicle, seat))
                }
            } else if (!this.pedState.playerVehicle && this.pedState.vehicleWeAreIn) {
                // Player on foot, we are in a vehicle, lets stop what we are doing and exit vehicle
                emit('bot:cancelThought')
                this.thought.finally(() => this.exitVehicle())
            } else if (!this.pedState.playerVehicle && this.pedState.vehicleWeAreUsing) {
                // Player on foot, we are *using* a vehicle (not "in" a vehicle yet), lets stop what we are doing and re-think next tick
                emit('bot:cancelThought')
            } else if ((this.pedState.playerVehicle && this.pedState.vehicleWeAreIn) || (!this.pedState.playerVehicle && !this.pedState.vehicleWeAreIn)) {
                // Both player and ourselves are either on foot, or in vehicle
                if (this.pedState.distanceFromPlayer > TRIGGER_MOVE_RADIUS || this.pedState.vehicleWeAreIn) {
                    this.followPlayer();
                } else if (!this.pedState.playerVehicle) {
                    this.standByPlayer();
                }
            }
        }, 1000));
    }
}

export default function initAiTest() {
    AddRelationshipGroup("ALLY_GROUP");
    SetRelationshipBetweenGroups(1, GetHashKey("ALLY_GROUP"), GetHashKey("PLAYER"))
    //SetRelationshipBetweenGroups(1, GetHashKey("PLAYER"), GetHashKey("ALLY_GROUP"))

    RegisterCommand("testbot", (source, args) => {
        const aiBot = new AiBot();
    }, false);

    const playerTargetClearFunc = debounce(() => {
        GameState.EntityPlayerRecentlyDamaged = 0;
    }, 2000);

    addEventListener('entityDamaged', (victim, culprit) => {
        if (culprit === PlayerPedId()) {
            if (IsEntityAPed(victim) && !IsPedDeadOrDying(victim, true)) {
                GameState.EntityPlayerRecentlyDamaged = victim;
                emit("ai:playerDidDamageEntity", victim)

                playerTargetClearFunc();
            }
        } else if (victim === PlayerPedId()) {
            SetPedAsEnemy(culprit, true);
        }
    });

    const playerAimTargetClearFunc = debounce(() => {
        GameState.EntityPlayerIsFreeAimingAt = 0;
    }, 2000);

    setInterval(() => {
        const currTarget = getPlayerAimTarget();
        if (currTarget) {
            GameState.EntityPlayerIsFreeAimingAt = currTarget;
            playerAimTargetClearFunc();
        }
    }, 100);

    setTick(throttle(() => {
        const allPeds = GetGamePool('CPed');
        const allyGroup = GetHashKey('ALLY_GROUP');
        SetPedAsGroupLeader(PlayerPedId(), GetPedGroupIndex(PlayerPedId()))

        ViableCombatTargets = allPeds.filter((targetPed) => {
            if (IsPedAPlayer(targetPed) || !IsEntityAPed(targetPed)) {
                return false;
            }

            if (GetPedRelationshipGroupHash(targetPed) === GetHashKey("ALLY_GROUP")) {
                return false;
            }

            if (IsPedInWrithe(targetPed) || IsPedDeadOrDying(targetPed, false)) {
                return false;
            }

            if (GetRelationshipBetweenPeds(targetPed, allyGroup) < 5) {
                return false;
            }

            if (!IsPedInCombat(targetPed, -1)) {
                return false;
            }

            return true;
        });
    }, 2000))
}