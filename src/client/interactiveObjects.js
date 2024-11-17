import {calculateHeadingForEntityFaceEntity, distanceBetweenEntities, getEntityPositionInFrontOrBehind, isEntityBehindEntity, isEntityInFrontOfEntity, loadAnimationDict, runAnimation, runAnimUntilEnd, sendChat, sleep, throttle} from "../util/util"

const MAX_USE_DISTANCE = 1.5;
const MAX_TEXT_DRAW_DISTANCE = 3;

const Directions = {
    Any: 0,
    InFront: 1,
    Behind: 2,
}

class InteractiveObject {
    constructor(entityId, text, direction, onUse) {
        this.entity = entityId;
        this.onUse = onUse;
        this.text = text;
        this.direction = direction;
    }
}
let interactiveObjects = [];

let ObjectHandlers = {
    // Cash registers
    'prop_till_01': cashRegisterInteraction,
    'prop_till_02': cashRegisterInteraction,

    // Vending machines
    'prop_vend_soda_01': vendingMachineInteraction,
    'prop_vend_soda_02': vendingMachineInteraction,
};

Object.keys(ObjectHandlers).forEach((key) => {
    const hash = GetHashKey(key).toString();
    ObjectHandlers[hash] = ObjectHandlers[key];
    delete(ObjectHandlers[key]);
});

export default function initInteractiveObjects() {
    let isInteracting = false;

    setTick(() => {
        if (isInteracting) {
            return;
        }

        let nearbyObject = [...interactiveObjects].map((obj) => {
            return {...obj, distance: distanceBetweenEntities(PlayerPedId(), obj.entity)};
        }).filter((obj) => {
            return obj.distance <= MAX_TEXT_DRAW_DISTANCE && IsEntityVisible(obj.entity) && HasEntityClearLosToEntity(PlayerPedId(), obj.entity, 1|16);
        }).sort((a, b) => {
            return a.distance - b.distance;
        }).find((obj) => {
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
            const [onScreen, screenX, screenY] = GetScreenCoordFromWorldCoord(entityCoords[0], entityCoords[1], entityCoords[2] + 0.1);

            if (onScreen) {
                const textScale = 0.3;

                // Draw text above the entity
                SetTextFont(0); // Font type
                SetTextProportional(1);
                SetTextScale(textScale, textScale);
                SetTextColour(255, 255, 255, 255); // RGBA color
                SetTextDropShadow();
                SetTextOutline();
                SetTextEntry("STRING");
                SetTextCentre(true);
                AddTextComponentString(Array.isArray(nearbyObject.text) ? nearbyObject.text.join("\n") : nearbyObject.text);
                DrawText(screenX, screenY);

                if (IsControlJustPressed(0, 51) && nearbyObject.distance <= MAX_USE_DISTANCE) {
                    isInteracting = true;

                    nearbyObject.onUse(nearbyObject).finally(() => {
                        isInteracting = false;
                    });
                }
            }
        } else {
            isInteracting = false;
        }
    });

    setTick(throttle(() => {
        const objects = GetGamePool('CObject');

        for (let entity of objects) {
            const modelHash = GetEntityModel(entity);
            if (ObjectHandlers.hasOwnProperty(modelHash.toString()) && !interactiveObjects.find((obj) => obj.entity === entity)) {
                let keyMapping = GetControlInstructionalButton(0, 51, true)
                    .replace('t_', '');

                interactiveObjects.push(new InteractiveObject(entity, `Press [${keyMapping}] to use`, Directions.Behind, ObjectHandlers[modelHash]));
            }
        }
    }, 5000));
}

export function registerInteractiveObject(entity, text, direction, onUse) {
    const interactiveObject = new InteractiveObject(entity, text, direction, onUse);

    interactiveObjects.push(interactiveObject)
}

function cashRegisterInteraction(obj) {
    return new Promise((resolve) => {
        const playerPed = PlayerPedId(); // Get the player's ped ID
        const animDict = "oddjobs@shop_robbery@rob_till";
        const animName = "loop"; // Specific animation name
        const soundName = "PURCHASE"; // Name of the sound to play
        const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
        RequestScriptAudioBank(soundSet, false);

        loadAnimationDict(animDict).then(async () => {
            FreezeEntityPosition(playerPed, true);

            const objCoords = getEntityPositionInFrontOrBehind(obj.entity, 0.6, true);
            const playerCoords = GetEntityCoords(playerPed, false);
            SetEntityCoords(playerPed, objCoords[0], objCoords[1], playerCoords[2]-1, true, true, true, false);

            const heading = calculateHeadingForEntityFaceEntity(playerPed, obj.entity);
            SetEntityHeading(playerPed, heading-90);

            // Start our sounds
            PlaySoundFromEntity(-1, soundName, playerPed, soundSet, true, 0);
            const soundInterval = setInterval(() => {
                PlaySoundFromEntity(-1, soundName, playerPed, soundSet, true, 0); // Play sound at the player's location
            }, 1000);

            // Play the animation
            for (let i=0;i<3;i++) {
                await runAnimation(playerPed, animDict, animName)
            }

            ClearPedTasks(playerPed);
            FreezeEntityPosition(playerPed, false);
            clearInterval(soundInterval)
            if (!IsPlayerWantedLevelGreater(PlayerId(), 1)) {
                SetPlayerWantedLevel(PlayerId(), 1, false);
            }
            resolve();
        });
    });
}

function vendingMachineInteraction(obj) {
    return new Promise((resolve) => {
        const playerPed = PlayerPedId(); // Get the player's ped ID
        const animDict = "mini@sprunk";
        const soundSet = "HUD_LIQUOR_STORE_SOUNDSET"
        RequestScriptAudioBank(soundSet, false);

        loadAnimationDict(animDict).then(async () => {
            FreezeEntityPosition(playerPed, true);

            const objCoords = getEntityPositionInFrontOrBehind(obj.entity, 1, true);
            const playerCoords = GetEntityCoords(playerPed, false);
            SetEntityCoords(playerPed, objCoords[0], objCoords[1], playerCoords[2]-1, true, true, true, false);

            const heading = calculateHeadingForEntityFaceEntity(playerPed, obj.entity);
            SetEntityHeading(playerPed, heading-90);

            // Play the animation
            await runAnimation(playerPed, animDict, 'plyr_buy_drink_pt1', 0, 2);
            await runAnimation(playerPed, animDict, 'plyr_buy_drink_pt2', 0, 2);
            await runAnimation(playerPed, animDict, 'plyr_buy_drink_pt3', 0, 0);

            ClearPedTasks(playerPed);
            FreezeEntityPosition(playerPed, false);
            resolve();
        });
    });
}