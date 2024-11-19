import {
    displayTextOnScreen,
    distanceBetweenEntities, drawTextThisFrame,
    isEntityBehindEntity,
    isEntityInFrontOfEntity,
} from "../util/util"
import {InteractionDirection} from "./ObjectInteractions/InteractiveObject";
import CashRegister from "./ObjectInteractions/CashRegister";
import TellerMachine from "./ObjectInteractions/TellerMachine";
import VendingMachine from "./ObjectInteractions/VendingMachine";

const MAX_USE_DISTANCE = 1.5;
const MAX_TEXT_DRAW_DISTANCE = 3;

let interactiveObjects = [];

let ObjectHandlers = {
    // Cash registers
    'prop_till_01': CashRegister,
    'prop_till_02': CashRegister,

    // // Vending machines
    'prop_vend_soda_01': VendingMachine,
    'prop_vend_soda_02': VendingMachine,

    // ATMs
    'prop_atm_01': TellerMachine,
    'prop_atm_02': TellerMachine,
    'prop_atm_03': TellerMachine,
    'prop_fleeca_atm': TellerMachine,
};

Object.keys(ObjectHandlers)
    .forEach((key) => {
        const hash = GetHashKey(key)
            .toString();
        ObjectHandlers[hash] = ObjectHandlers[key];
        delete (ObjectHandlers[key]);
    });

export function registerInteractableObject(interactableObject) {
    interactiveObjects = interactiveObjects.filter((obj) => obj.entity !== interactableObject.entity);
    interactiveObjects.push(interactableObject);
}

export function initInteractiveObjects() {
    let isInteracting = false;

    setTick(() => {
        try {
            if (isInteracting) {
                return;
            }

            let nearbyObject = interactiveObjects.map(
                (obj) => {
                    obj.distance = distanceBetweenEntities(PlayerPedId(), obj.entity);
                    return obj;
                })
                .filter((obj) => {
                    return obj.distance <= MAX_TEXT_DRAW_DISTANCE && IsEntityVisible(obj.entity) && HasEntityClearLosToEntity(PlayerPedId(), obj.entity, 16);
                })
                .sort((a, b) => {
                    return a.distance - b.distance;
                })
                .find((obj) => {
                    switch (obj.direction) {
                        case InteractionDirection.InFront:
                            return isEntityInFrontOfEntity(PlayerPedId(), obj.entity);

                        case InteractionDirection.Behind:
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
                    const keyMapping = GetControlInstructionalButton(0, 51, 1)
                        .replace('t_', '');
                    const text = nearbyObject.getText()
                        .replace('[]', `[${keyMapping}]`);

                    // Draw text above the entity
                    drawTextThisFrame(screenX, screenY, text, 0.3, true);

                    if (IsControlJustPressed(0, 51)) {
                        if (nearbyObject.distance <= MAX_USE_DISTANCE) {
                            isInteracting = true;

                            // Run our callback and then cleanup
                            nearbyObject.onUse(nearbyObject)
                                .catch((err) => {
                                    displayTextOnScreen(err, 0.5, 0.3, 0.4, [255, 64, 64, 255], 2000, true);
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
        } catch (err) {
            drawTextThisFrame(0, 0, err, 0.3, false);
        }
    });

    setInterval(() => {
        const objects = GetGamePool('CObject');

        for (let entity of objects) {
            const modelHash = GetEntityModel(entity);
            if (ObjectHandlers.hasOwnProperty(modelHash.toString()) && !interactiveObjects.find((obj) => obj.entity === entity)) {
                const objClass = ObjectHandlers[modelHash];

                registerInteractableObject(new objClass(entity));
            }
        }
    }, 5000);
}