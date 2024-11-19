import {calculateHeadingForEntityFaceEntity, getEntityPositionInFrontOrBehind, loadAnimationDict, runAnimationLooped, scareNearbyPeds} from "../../util/util";
import {addPlayerMoney} from "../../util/Cash";
import {InteractionDirection, InteractiveObject} from "./InteractiveObject";

export default class CashRegister extends InteractiveObject {
    constructor(entityId) {
        super(entityId, InteractionDirection.Behind, [0, 0, 0.1]);
    }

    async onUse() {
        return new Promise((resolve, reject) => {
            const playerPed = PlayerPedId(); // Get the player's ped ID
            const animDict = "oddjobs@shop_robbery@rob_till";
            const animName = "loop"; // Specific animation name
            const soundName = "PURCHASE"; // Name of the sound to play
            const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
            RequestScriptAudioBank(soundSet, false);

            // Prevent immediate re-use no matter even if we cancel the robbery
            this.onCooldownUntil = GetGameTimer() + 5000;

            loadAnimationDict(animDict)
                .then(async () => {
                    const objCoords = getEntityPositionInFrontOrBehind(this.entity, 0.6, true);
                    const playerCoords = GetEntityCoords(playerPed, false);

                    FreezeEntityPosition(playerPed, true);
                    SetEntityCoords(playerPed, objCoords[0], objCoords[1], playerCoords[2] - 1, true, true, true, false);
                    const heading = calculateHeadingForEntityFaceEntity(playerPed, this.entity);
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
                        // Add some random cash and increase the cooldown by some amount each  time
                        this.onCooldownUntil += 2000;

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
                    await runAnimationLooped(playerPed, animDict, animName, 3, true)
                        .catch(() => {
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

    getText() {
        if (this.canUse()) {
            return 'Press [] to rob till';
        }

        const secondsRemaining = Math.ceil((this.onCooldownUntil - GetGameTimer()) / 1000);
        return `On Cooldown for ${secondsRemaining}s`;
    }
}