import {calculateHeadingForEntityFaceEntity, displayTextOnScreen, getEntityPositionInFrontOrBehind, loadAnimationDict, randomItem, runAnimationLooped, scareNearbyPeds, sendChat, sleep} from "../../util/util";
import {InteractionDirection, InteractiveObject} from "./InteractiveObject";
import {AmmoType, WeaponHash} from "fivem-js";
import Dumpster from "./Dumpster";

export default class SmallBin extends Dumpster {
    constructor(entityId) {
        super(entityId);
        this.direction = InteractionDirection.Any
        this.textOffset = [0,0,1];
        this.maxUseDistance = 0.3;
        this.lootTable = [
            {
                name: 'nothing',
                tickets: 20,
            },
            {
                name: 'ammo',
                tickets: 20,
                items: [
                    {
                        tickets: 80,
                        name: 'Pistol',
                        hash: AmmoType.Pistol,
                        min: 5,
                        max: 10,
                    },
                ]
            },
            {
                name: 'weapon',
                tickets: 10,
                items: [
                    {
                        tickets: 80,
                        name: 'Bottle',
                        hash: WeaponHash.Bottle
                    },
                    {
                        tickets: 20,
                        name: 'Knuckle Duster',
                        hash: WeaponHash.KnuckleDuster
                    },
                    {
                        tickets: 10,
                        name: 'Machete',
                        hash: WeaponHash.Machete
                    },
                    {
                        tickets: 5,
                        name: 'Combat Pistol',
                        hash: WeaponHash.CombatPistol
                    },
                    {
                        tickets: 1,
                        name: 'Grenade',
                        hash: WeaponHash.Grenade
                    },
                ]
            },
        ];
    }

    async onUse() {
        return new Promise((resolve, reject) => {
            const playerPed = PlayerPedId(); // Get the player's ped ID
            const animDict = "oddjobs@shop_robbery@rob_till";
            const animName = "loop"; // Specific animation name

            loadAnimationDict(animDict)
                .then(async () => {
                    FreezeEntityPosition(playerPed, true);
                    const heading = calculateHeadingForEntityFaceEntity(playerPed, this.entity);
                    SetEntityHeading(playerPed, heading);

                    const currWeapon = GetCurrentPedWeapon(playerPed, true);
                    DisableControlAction(0, 37, true);
                    SetCurrentPedWeapon(playerPed, `WEAPON_UNARMED`, true);

                    // Play the animation
                    await runAnimationLooped(playerPed, animDict, animName, 1, true).then(() => {
                        this.onCooldownUntil = -1;
                        this.rewardRandomLoot();
                    }).catch(() => {
                        // player moved/aborted animation
                    })

                    SetCurrentPedWeapon(playerPed, currWeapon[1], true);
                    DisableControlAction(0, 37, false);

                    ClearPedTasks(playerPed);
                    FreezeEntityPosition(playerPed, false);
                    resolve();
                });
        });
    }
}