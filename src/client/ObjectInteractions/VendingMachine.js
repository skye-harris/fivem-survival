import {spendCash} from "../../util/Cash";
import {calculateHeadingForEntityFaceEntity, getEntityPositionInFrontOrBehind, loadAnimationDict, loadModel, runAnimation, sleep} from "../../util/util";
import {InteractionDirection, InteractiveObject} from "./InteractiveObject";

export default class VendingMachine extends InteractiveObject {
    constructor(entityId) {
        super(entityId, InteractionDirection.Behind, [0, 0, 0.1]);
    }

    getText() {
        return `Press [] to buy drink`;
    }

    async onUse() {
        return new Promise((resolve, reject) => {
            spendCash(1)
                .then(() => {
                    const playerPed = PlayerPedId(); // Get the player's ped ID
                    const animDict = "mini@sprunk";
                    const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
                    RequestScriptAudioBank(soundSet, false);

                    loadAnimationDict(animDict)
                        .then(async () => {
                            const useCoords = getEntityPositionInFrontOrBehind(this.entity, 1, true);
                            const playerCoords = GetEntityCoords(playerPed, false);

                            // if (IsPositionOccupied(useCoords[0], useCoords[1], playerCoords[2], 0.2, true, false, true, false, false, playerPed, false)) {
                            //     reject(new Error("There is no room available"));
                            //     return;
                            // }
                            const drinkHash = GetHashKey('prop_ld_can_01');
                            await loadModel(drinkHash);

                            FreezeEntityPosition(playerPed, true);
                            SetEntityCoords(playerPed, useCoords[0], useCoords[1], playerCoords[2] - 1, true, true, true, false);

                            const heading = calculateHeadingForEntityFaceEntity(playerPed, this.entity);
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
                })
                .catch(err => {
                    reject(new Error("You cannot afford a drink"));
                });
        });
    }
}