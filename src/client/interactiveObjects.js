import {
    displayTextOnScreen,
    distanceBetweenEntities, drawTextThisFrame, getDistanceToObjectEdge, getObjectCenter,
    isEntityBehindEntity,
    isEntityInFrontOfEntity,
} from "../util/util"
import {InteractionDirection} from "./ObjectInteractions/InteractiveObject";
import CashRegister from "./ObjectInteractions/CashRegister";
import TellerMachine from "./ObjectInteractions/TellerMachine";
import VendingMachine from "./ObjectInteractions/VendingMachine";
import Dumpster from "./ObjectInteractions/Dumpster";
import SmallBin from "./ObjectInteractions/SmallBin";

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

    // Dumpsters
    'prop_dumpster_3a': Dumpster,
    'prop_dumpster_4a': Dumpster,
    'prop_dumpster_4b': Dumpster,
    'prop_cs_dumpster_01a': Dumpster,
    'p_dumpster_t': Dumpster,
    'prop_dumpster_01a': Dumpster,
    'prop_dumpster_02a': Dumpster,
    'prop_dumpster_02b': Dumpster,
    'prop_bin_14a': Dumpster,
    'prop_bin_13a': Dumpster,
    'prop_bin_14b': Dumpster,

    // Bins
    'prop_bin_07b': SmallBin,
    'prop_bin_beach_01d': SmallBin,
    'prop_bin_01a': SmallBin,
    'prop_bin_01b': SmallBin,
    'prop_recyclebin_04_a': SmallBin,
    'prop_recyclebin_04_b': SmallBin,
    'prop_bin_beach_01a': SmallBin,
    'prop_recyclebin_02_c': SmallBin,
    'prop_bin_delpiero_b': SmallBin,
    'prop_bin_delpiero_c': SmallBin,
    'zprop_bin_01a_old': SmallBin,
    'prop_recyclebin_03_a': SmallBin,
    'prop_bin_07c': SmallBin,
    'prop_bin_01c': SmallBin,
    'prop_bin_10b': SmallBin,
    'prop_bin_10a': SmallBin,
    'prop_bin_11a': SmallBin,
    'prop_bin_06a': SmallBin,
    'prop_bin_06b': SmallBin,
    'prop_bin_07d': SmallBin,
    'prop_bin_11b': SmallBin,
    'prop_bin_04a': SmallBin,
    'prop_bin_04b': SmallBin,
    'prop_recyclebin_02b': SmallBin,
    'prop_bin_delpiero': SmallBin,
    'prop_bin_09a': SmallBin,
    'prop_bin_08a': SmallBin,
    'prop_bin_02a': SmallBin,
    'prop_recyclebin_02_d': SmallBin,
    'prop_bin_08open': SmallBin,
    'prop_bin_12a': SmallBin,
    'prop_recyclebin_02a': SmallBin,
    'prop_bin_05a': SmallBin,
    'prop_bin_07a': SmallBin,
    'prop_recyclebin_01a': SmallBin,
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
                    obj.distance = getDistanceToObjectEdge(obj.entity);//distanceBetweenEntities(PlayerPedId(), obj.entity);
                    return obj;
                })
                .filter((obj) => {
                    return obj.distance <= obj.maxUseDistance && IsEntityVisible(obj.entity) && HasEntityClearLosToEntity(PlayerPedId(), obj.entity, 16);
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
                //const entityCoords = GetEntityCoords(nearbyObject.entity, false);
                const entityCoords = getObjectCenter(nearbyObject.entity);
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

                    if (IsControlJustPressed(0, 51) && nearbyObject.canUse()) {
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