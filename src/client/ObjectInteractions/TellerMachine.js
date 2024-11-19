import {InteractionDirection, InteractiveObject} from "./InteractiveObject";
import {calculateHeadingForEntityFaceEntity, getEntityPositionInFrontOrBehind, loadAnimationDict, runAnimation} from "../../util/util";

const ModelData = [
    {
        model: 'prop_atm_01',
        animationDistance: 0.75,
        textOffset: [0, 0, 1.1],
    },
    {
        model: 'prop_atm_02',
        animationDistance: 0.5,
        textOffset: [0, 0, 1],
    },
    {
        model: 'prop_atm_03',
        animationDistance: 0.5,
        textOffset: [0, 0, 1],
    },
    {
        model: 'prop_fleeca_atm',
        animationDistance: 0.5,
        textOffset: [0, 0, 1.25],
    },
];

export default class TellerMachine extends InteractiveObject {
    constructor(entityId) {
        const entityModelHash = GetEntityModel(entityId);
        const modelData = ModelData.find((datum) => GetHashKey(datum.model) === entityModelHash);

        super(entityId, InteractionDirection.Behind, modelData.textOffset);
        this.animationDistance = modelData.animationDistance;
    }

    getText() {
        if (this.canUse()) {
            return 'Press [] to bank cash';
        }

        const secondsRemaining = Math.ceil((this.onCooldownUntil - GetGameTimer()) / 1000);
        return `On Cooldown for ${secondsRemaining}s`;
    }

    async onUse() {
        return new Promise((resolve) => {
            const playerPed = PlayerPedId();
            const gender = IsPedMale(playerPed) ? 'male' : 'female';
            const animDictEnter = `amb@prop_human_atm@${gender}@enter`;
            const animDictExit = `amb@prop_human_atm@${gender}@exit`;
            const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
            RequestScriptAudioBank(soundSet, false);

            Promise.all([loadAnimationDict(animDictEnter), loadAnimationDict(animDictExit)])
                .then(async () => {
                    FreezeEntityPosition(playerPed, true);
                    const objCoords = getEntityPositionInFrontOrBehind(this.entity, this.animationDistance, true);
                    const playerCoords = GetEntityCoords(playerPed, false);
                    SetEntityCoords(playerPed, objCoords[0], objCoords[1], playerCoords[2] - 1, true, true, true, false);

                    const heading = calculateHeadingForEntityFaceEntity(playerPed, this.entity);
                    SetEntityHeading(playerPed, heading);

                    // Holster weapon
                    const currWeapon = GetCurrentPedWeapon(playerPed, true);
                    DisableControlAction(0, 37, true);
                    SetCurrentPedWeapon(playerPed, `WEAPON_UNARMED`, true);

                    // Play the animation
                    await runAnimation(playerPed, animDictEnter, 'enter', 0, 2, false);
                    await runAnimation(playerPed, animDictExit, 'exit', 0, 0, false)
                        .then(() => {
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
}