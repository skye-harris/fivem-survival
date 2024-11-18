import {
    calculateHeadingForEntityFaceEntity, displayTextOnScreen,
    distanceBetweenEntities,
    getEntityPositionInFrontOrBehind,
    isEntityBehindEntity,
    isEntityInFrontOfEntity,
    loadAnimationDict, loadModel,
    runAnimation, runAnimationLooped, scareNearbyPeds, sleep,
    throttle
} from "../util/util"
import {addPlayerMoney, spendCash} from "../util/Cash";

const MAX_USE_DISTANCE = 1.5;
const MAX_TEXT_DRAW_DISTANCE = 3;

const Directions = {
    Any: 0,
    InFront: 1,
    Behind: 2,
}

class InteractiveObject {
    constructor(entityId, text, useDirection, onUse, textOffset = [0, 0, 0.1]) {
        this.entity = entityId;
        this.onUse = onUse;
        this.text = text;
        this.textOffset = textOffset;
        this.direction = useDirection;
    }
}

let interactiveObjects = [];

let ObjectHandlers = {
    // Cash registers
    'prop_till_01': {
        model: 'prop_till_01',
        onUse: cashRegisterInteraction,
        text: 'Press [] to rob till',
    },
    'prop_till_02': {
        model: 'prop_till_02',
        onUse: cashRegisterInteraction,
        text: 'Press [] to rob till',
    },

    // Vending machines
    'prop_vend_soda_01': {
        model: 'prop_vend_soda_01',
        onUse: vendingMachineInteraction,
        direction: Directions.Any,
        text: 'Press [] to buy drink',
    },
    'prop_vend_soda_02': {
        model: 'prop_vend_soda_02',
        onUse: vendingMachineInteraction,
        direction: Directions.Any,
        text: 'Press [] to buy drink',
    },

    // ATMs
    'prop_atm_01': {
        model: 'prop_atm_01',
        onUse: (obj) => atmInteraction(obj, 1),
        textOffset: [0, 0, 1.1],
        text: 'Press [] to bank cash',
    },
    'prop_atm_02': {
        model: 'prop_atm_02',
        onUse: (obj) => atmInteraction(obj, 0.5),
        textOffset: [0, 0, 1],
        text: 'Press [] to bank cash',
    },
    'prop_atm_03': {
        model: 'prop_atm_03',
        onUse: (obj) => atmInteraction(obj, 0.5),
        textOffset: [0, 0, 1],
        text: 'Press [] to bank cash',
    },
    'prop_fleeca_atm': {
        model: 'prop_fleeca_atm',
        onUse: (obj) => atmInteraction(obj, 0.5),
        textOffset: [0, 0, 1.25],
        text: 'Press [] to bank cash',
    },
};

Object.keys(ObjectHandlers)
      .forEach((key) => {
          const hash = GetHashKey(key)
              .toString();
          ObjectHandlers[hash] = ObjectHandlers[key];
          delete (ObjectHandlers[key]);
      });

export default function initInteractiveObjects() {
    let isInteracting = false;

    setTick(() => {
        if (isInteracting) {
            return;
        }

        let nearbyObject = [...interactiveObjects].map((obj) => {
            return {...obj, distance: distanceBetweenEntities(PlayerPedId(), obj.entity)};
        })
                                                  .filter((obj) => {
                                                      return obj.distance <= MAX_TEXT_DRAW_DISTANCE && IsEntityVisible(obj.entity) && HasEntityClearLosToEntity(PlayerPedId(), obj.entity, 16);
                                                  })
                                                  .sort((a, b) => {
                                                      return a.distance - b.distance;
                                                  })
                                                  .find((obj) => {
                                                      switch (obj.direction) {
                                                          case Directions.InFront:
                                                              return isEntityInFrontOfEntity(PlayerPedId(), obj.entity);

                                                          case Directions.Behind:
                                                              return isEntityBehindEntity(PlayerPedId(), obj.entity);

                                                          default:
                                                              return true;
                                                      }
                                                  });

        if (nearbyObject) {
            const entityCoords = GetEntityCoords(nearbyObject.entity, false);
            const [onScreen, screenX, screenY] = GetScreenCoordFromWorldCoord(
                entityCoords[0] + nearbyObject.textOffset[0],
                entityCoords[1] + nearbyObject.textOffset[1],
                entityCoords[2] + nearbyObject.textOffset[2]
            );

            if (onScreen) {
                const textScale = 0.3;
                const keyMapping = GetControlInstructionalButton(0, 51, true)
                    .replace('t_', '');
                const text = nearbyObject.text.replace('[]', `[${keyMapping}]`);

                // Draw text above the entity
                SetTextFont(0); // Font type
                SetTextProportional(1);
                SetTextScale(textScale, textScale);
                SetTextColour(255, 255, 255, 255); // RGBA color
                SetTextDropShadow();
                SetTextOutline();
                SetTextEntry("STRING");
                SetTextCentre(true);
                AddTextComponentString(text);
                DrawText(screenX, screenY);

                if (IsControlJustPressed(0, 51)) {
                    if (nearbyObject.distance <= MAX_USE_DISTANCE) {
                        isInteracting = true;

                        nearbyObject.onUse(nearbyObject)
                                    .catch((err) => {
                                        displayTextOnScreen(err, 0.5, 0.3, 0.4, [255,64,64,255], 2000, true);
                                    })
                                    .finally(() => {
                                        isInteracting = false;
                                    });
                    }
                }
            }
        } else {
            isInteracting = false;
        }
    });

    addEventListener('interactions:register', (entity, text, direction, onUse, textOffset) => {
        interactiveObjects = interactiveObjects.filter((obj) => obj.entity !== entity);

        interactiveObjects.push(new InteractiveObject(entity, text, direction, onUse, textOffset))
    });

    setTick(throttle(() => {
        const objects = GetGamePool('CObject');

        for (let entity of objects) {
            const modelHash = GetEntityModel(entity);
            if (ObjectHandlers.hasOwnProperty(modelHash.toString()) && !interactiveObjects.find((obj) => obj.entity === entity)) {
                const objData = ObjectHandlers[modelHash];

                const args = {
                    entity: entity,
                    text: objData.hasOwnProperty('text') ? objData.text : `Press [] to use`,
                    useDirection: objData.hasOwnProperty('direction') ? objData.direction : Directions.Behind,
                    onUse: objData.onUse,
                    textOffset: objData.hasOwnProperty('textOffset') ? objData.textOffset : [0, 0, 0.1]
                };

                emit('interactions:register', args.entity, args.text, args.useDirection, args.onUse, args.textOffset);
            }
        }
    }, 5000));
}

function cashRegisterInteraction(obj) {
    return new Promise((resolve, reject) => {
        const playerPed = PlayerPedId(); // Get the player's ped ID
        const animDict = "oddjobs@shop_robbery@rob_till";
        const animName = "loop"; // Specific animation name
        const soundName = "PURCHASE"; // Name of the sound to play
        const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
        RequestScriptAudioBank(soundSet, false);

        loadAnimationDict(animDict)
            .then(async () => {
                const objCoords = getEntityPositionInFrontOrBehind(obj.entity, 0.6, true);
                const playerCoords = GetEntityCoords(playerPed, false);

                FreezeEntityPosition(playerPed, true);
                SetEntityCoords(playerPed, objCoords[0], objCoords[1], playerCoords[2] - 1, true, true, true, false);
                const heading = calculateHeadingForEntityFaceEntity(playerPed, obj.entity);
                SetEntityHeading(playerPed, heading);

                const currWeapon = GetCurrentPedWeapon(playerPed, true);
                DisableControlAction(0, 37, true);
                SetCurrentPedWeapon(playerPed, `WEAPON_UNARMED`, true);

                const addRandomCash = () => {
                    addPlayerMoney(20 + (Math.round(Math.random() * 20)));
                    PlaySoundFromEntity(-1, soundName, playerPed, soundSet, true, 0);
                };

                // Start our sounds
                let loops = 5;
                const soundInterval = setInterval(() => {
                    addRandomCash();
                    if (!IsPlayerWantedLevelGreater(PlayerId(), 0)) {
                        SetPlayerWantedLevel(PlayerId(), 1, false);
                    }
                    if (!loops--) {
                        clearInterval(soundInterval);
                    }
                }, 1000);

                scareNearbyPeds();

                // Play the animation
                await runAnimationLooped(playerPed, animDict, animName, 3, true).catch(() => {
                    clearInterval(soundInterval)
                });

                SetCurrentPedWeapon(playerPed, currWeapon[1], true);
                DisableControlAction(0, 37, false);

                ClearPedTasks(playerPed);
                clearInterval(soundInterval);
                FreezeEntityPosition(playerPed, false);
                resolve();
            });
    });
}

function vendingMachineInteraction(obj) {
    return new Promise((resolve,reject) => {
        spendCash(1).then(() => {
            const playerPed = PlayerPedId(); // Get the player's ped ID
            const animDict = "mini@sprunk";
            const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
            RequestScriptAudioBank(soundSet, false);

            loadAnimationDict(animDict)
                .then(async () => {
                    const useCoords = getEntityPositionInFrontOrBehind(obj.entity, 1, true);
                    const playerCoords = GetEntityCoords(playerPed, false);

                    // if (IsPositionOccupied(useCoords[0], useCoords[1], playerCoords[2], 0.2, true, false, true, false, false, playerPed, false)) {
                    //     reject(new Error("There is no room available"));
                    //     return;
                    // }
                    const drinkHash = GetHashKey('prop_ld_can_01');
                    await loadModel(drinkHash);

                    FreezeEntityPosition(playerPed, true);
                    SetEntityCoords(playerPed, useCoords[0], useCoords[1], playerCoords[2]-1, true, true, true, false);

                    const heading = calculateHeadingForEntityFaceEntity(playerPed, obj.entity);
                    SetEntityHeading(playerPed, heading);

                    const currWeapon = GetCurrentPedWeapon(playerPed, true);
                    DisableControlAction(0, 37, true);
                    SetCurrentPedWeapon(playerPed, `WEAPON_UNARMED`, true);

                    let drinkCan = 0;
                    let isCancelled = false;
                    const drinkSpawnTimeout = setTimeout(async () => {
                        drinkCan = CreateObject(drinkHash, playerCoords[0], playerCoords[1], playerCoords[2], true, false, false);
                        SetModelAsNoLongerNeeded(drinkHash);
                        SetObjectAsNoLongerNeeded(drinkCan);
                        SetEntityAsNoLongerNeeded(drinkCan);

                        if (!isCancelled) {
                            AttachEntityToEntity(drinkCan, playerPed, GetPedBoneIndex(playerPed, 18905), 0.11, 0.01, 0.02, -100, 0, -10, true, true, false, true, 1, true);
                            await sleep(3300);
                        }

                        if (!isCancelled) {
                            AttachEntityToEntity(drinkCan, playerPed, GetPedBoneIndex(playerPed, 57005), 0.12, 0.01, -0.02, -70, 0, -25, true, true, false, true, 1, true);
                            await sleep(2500);
                        }

                        DetachEntity(drinkCan, true, true);
                    }, 3500)

                    // Play the animation
                    await runAnimation(playerPed, animDict, 'plyr_buy_drink_pt1', 0, 2, true)
                        .then(() => runAnimation(playerPed, animDict, 'plyr_buy_drink_pt2', 0, 2, true))
                        .then(() => runAnimation(playerPed, animDict, 'plyr_buy_drink_pt3', 0, 0, true))
                        .catch((err) => {
                            if (drinkCan) {
                                DetachEntity(drinkCan, true, true);
                            }
                            clearTimeout(drinkSpawnTimeout);
                        })

                    setTimeout(() => {
                        DeleteEntity(drinkCan);
                        DeleteObject(drinkCan);
                    }, 6000);

                    SetCurrentPedWeapon(playerPed, currWeapon[1], true);
                    DisableControlAction(0, 37, false);

                    FreezeEntityPosition(playerPed, false);
                    ClearPedTasks(playerPed);
                    resolve();
                });
        }).catch(err => {
            reject(new Error("You cannot afford a drink"));
        });
    });
}

function atmInteraction(obj, useDistance) {
    return new Promise((resolve) => {
        const playerPed = PlayerPedId(); // Get the player's ped ID
        const gender = IsPedMale(playerPed) ? 'male' : 'female';
        const animDictEnter = `amb@prop_human_atm@${gender}@enter`;
        const animDictExit = `amb@prop_human_atm@${gender}@exit`;
        const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
        RequestScriptAudioBank(soundSet, false);

        Promise.all([loadAnimationDict(animDictEnter), loadAnimationDict(animDictExit)])
            .then(async () => {
                FreezeEntityPosition(playerPed, true);
                const objCoords = getEntityPositionInFrontOrBehind(obj.entity, useDistance, true);
                const playerCoords = GetEntityCoords(playerPed, false);
                SetEntityCoords(playerPed, objCoords[0], objCoords[1], playerCoords[2] - 1, true, true, true, false);

                const heading = calculateHeadingForEntityFaceEntity(playerPed, obj.entity);
                SetEntityHeading(playerPed, heading);

                // Holster weapon
                const currWeapon = GetCurrentPedWeapon(playerPed, true);
                DisableControlAction(0, 37, true);
                SetCurrentPedWeapon(playerPed, `WEAPON_UNARMED`, true);

                // Play the animation
                await runAnimation(playerPed, animDictEnter, 'enter', 0, 2, false);
                await runAnimation(playerPed, animDictExit, 'exit', 0, 0, false).then(() => {
                    emitNet('skyemod:bankCash');
                });

                ClearPedTasks(playerPed);
                FreezeEntityPosition(playerPed, false);

                // Reequip weapon
                SetCurrentPedWeapon(playerPed, currWeapon[1], true);
                DisableControlAction(0, 37, false);

                resolve();
            });
    });
}