import {calculateHeadingForEntityFaceEntity, displayTextOnScreen, getEntityPositionInFrontOrBehind, loadAnimationDict, randomItem, runAnimationLooped, scareNearbyPeds, sendChat} from "../../util/util";
import {InteractionDirection, InteractiveObject} from "./InteractiveObject";
import {AmmoType, WeaponHash} from "fivem-js";

function getObjectByChance (objects) {
    const ticketCount = objects.reduce((acc, cur) => acc + cur.tickets, 0);
    const chosenTicket = Math.round(Math.random() * (ticketCount-1));

    let ticketCounter = 0;
    return objects.find((object) => {
        ticketCounter += object.tickets;

        return chosenTicket <= ticketCounter;
    });
}

SetPedPathCanDropFromHeight

export default class Dumpster extends InteractiveObject {
    constructor(entityId, useDirection = InteractionDirection.Behind, textOffset = [0, 0, 1]) {
        super(entityId, useDirection, textOffset);
        this.maxUseDistance = 1;
        this.lootTable = [
            {
                name: 'nothing',
                tickets: 25,
            },
            {
                name: 'ammo',
                tickets: 45,
                items: [
                    {
                        tickets: 80,
                        name: 'Pistol',
                        hash: AmmoType.Pistol,
                        min: 5,
                        max: 20,
                    },
                    {
                        tickets: 20,
                        name: 'Shotgun',
                        hash: AmmoType.Shotgun,
                        min: 5,
                        max: 10,
                    }
                ]
            },
            {
                name: 'weapon',
                tickets: 15,
                items: [
                    {
                        tickets: 80,
                        name: 'Bottle',
                        hash: WeaponHash.Bottle
                    },
                    {
                        tickets: 20,
                        name: 'Baseball Bat',
                        hash: WeaponHash.Bat
                    },
                    {
                        tickets: 40,
                        name: 'Crowbar',
                        hash: WeaponHash.Crowbar
                    },
                    {
                        tickets: 30,
                        name: 'Switchblade',
                        hash: WeaponHash.SwitchBlade
                    },
                    {
                        tickets: 40,
                        name: 'Hammer',
                        hash: WeaponHash.Hammer
                    },
                    {
                        tickets: 5,
                        name: 'Molotov Cocktail',
                        hash: WeaponHash.Molotov
                    },
                    {
                        tickets: 10,
                        name: 'Combat Pistol',
                        hash: WeaponHash.CombatPistol
                    },
                    {
                        tickets: 10,
                        name: 'Shotgun',
                        hash: WeaponHash.PumpShotgun
                    },
                    {
                        tickets: 10,
                        name: 'Fire Extinguisher',
                        hash: WeaponHash.FireExtinguisher
                    },
                ]
            },
        ];
    }

    canUse() {
        return this.onCooldownUntil !== -1;
    }

    rewardRandomLoot() {
        const category = getObjectByChance(this.lootTable)

        switch (category.name) {
            case 'ammo':
                const ammoData = getObjectByChance(category.items);
                const ammoCount = Math.round(Math.random() * (ammoData.max - ammoData.min)) + ammoData.min;
                AddAmmoToPedByType(PlayerPedId(),ammoData.hash, ammoCount);
                displayTextOnScreen(`Found ${ammoCount} ${ammoData.name} ammo!`, 0.5, 0.1, 0.5, [255,255,255,255], 3000, true);
                break;

            case 'weapon':
                const weaponData = getObjectByChance(category.items);
                GiveWeaponToPed(PlayerPedId(), weaponData.hash, 1, false, true);
                displayTextOnScreen(`Found a ${weaponData.name}!`, 0.5, 0.1, 0.5, [255,255,255,255], 3000, true);
                break;

            default:
                displayTextOnScreen(`You only found garbage`, 0.5, 0.1, 0.5, [255,64,64,255], 3000, true);
                break;
        }
    }

    async onUse() {
        return new Promise((resolve, reject) => {
            const playerPed = PlayerPedId(); // Get the player's ped ID
            const animDict = "oddjobs@shop_robbery@rob_till";
            const animName = "loop"; // Specific animation name

            loadAnimationDict(animDict)
                .then(async () => {
                    const objCoords = getEntityPositionInFrontOrBehind(this.entity, 1, true);
                    const playerCoords = GetEntityCoords(playerPed, false);

                    FreezeEntityPosition(playerPed, true);
                    SetEntityCoords(playerPed, objCoords[0], objCoords[1], playerCoords[2] - 1, true, true, true, false);
                    const heading = calculateHeadingForEntityFaceEntity(playerPed, this.entity);
                    SetEntityHeading(playerPed, heading);

                    const currWeapon = GetCurrentPedWeapon(playerPed, true);
                    DisableControlAction(0, 37, true);
                    SetCurrentPedWeapon(playerPed, `WEAPON_UNARMED`, true);

                    // Play the animation
                    await runAnimationLooped(playerPed, animDict, animName, 3, true).then(() => {
                        this.onCooldownUntil = -1;
                        this.rewardRandomLoot();
                    }).catch(() => {
                        // player moved/aborted animation
                    });

                    SetCurrentPedWeapon(playerPed, currWeapon[1], true);
                    DisableControlAction(0, 37, false);

                    ClearPedTasks(playerPed);
                    FreezeEntityPosition(playerPed, false);
                    resolve();
                });
        });
    }

    getText() {
        if (this.canUse()) {
            return 'Press [] to search';
        }

        return '';
    }
}