import {sendChat, throttle} from "../util/util";
import PedestrianHelper from "../util/PedestrianHelper";
import config from "./config";

export default function initFlameTrail() {
    RegisterCommand('flame', (source, args) => {
        const arg = args.length ? args[0].toLowerCase() : null;

        if (['on', 'off'].indexOf(arg) === -1) {
            sendChat(`Usage: "/flame [on/off]"  Will enable or disable the flame effect.`);
            return;
        }

        config.flameOn = arg === 'on';
        sendChat(`Flame ${config.flameOn ? 'ON' : 'OFF'}!`);
    }, false);

// Flame trackers ticker, throttled to every 100ms
    setInterval(() => {
        if (!config.flameOn) {
            return;
        }

        const player = PlayerPedId();
        const nearbyPlayers = PedestrianHelper.getNearbyPlayers(100, true)
                                              .filter((playerPedId) => {
                                                  const playerSpeed = GetEntitySpeed(playerPedId);

                                                  return playerSpeed > config.flameMinSpeed && IsPedInAnyVehicle(playerPedId, false) && !IsPedInAnyBoat(playerPedId) && !IsPedInAnyPlane(playerPedId) && !IsPedInAnyHeli(playerPedId);
                                              });

        for (let playerPedId of nearbyPlayers) {
            try {
                const playerVehicle = GetVehiclePedIsIn(playerPedId, false);

                if (GetVehicleCurrentGear(playerVehicle) > 0) {
                    const vehicleModel = GetEntityModel(playerVehicle);
                    const vehicleDimensions = GetModelDimensions(vehicleModel);

                    const vehiclePos = GetEntityCoords(playerVehicle, true); // Get vehicle coordinates
                    const forwardVector = GetEntityForwardVector(player); // Get vehicle forward vector
                    const distanceBehind = vehicleDimensions[1][1] + 0.1; // Distance behind the vehicle

                    // Subtract the forward vector multiplied by the distance from the vehicle position
                    const behindPosX = vehiclePos[0] - (forwardVector[0] * distanceBehind);
                    const behindPosY = vehiclePos[1] - (forwardVector[1] * distanceBehind);
                    const behindPosZ = vehiclePos[2] + vehicleDimensions[0][2];

                    const fireLocation = [
                        behindPosX,
                        behindPosY,
                        behindPosZ,
                    ];

                    const [foundFire, closestFire] = GetClosestFirePos(fireLocation[0], fireLocation[1], fireLocation[2]);
                    const distanceToFire = GetDistanceBetweenCoords(closestFire[0], closestFire[1], closestFire[2], fireLocation[0], fireLocation[1], fireLocation[2], true);

                    if (!foundFire || distanceToFire > 1) {
                        const fireId = StartScriptFire(fireLocation[0], fireLocation[1], fireLocation[2], 2, false);
                        setTimeout(() => {
                            RemoveScriptFire(fireId)
                        }, config.flameTimeout)
                    }
                }
            } catch (err) {
                //sendChat(err.message);
            }
        }
    }, 100)
}
