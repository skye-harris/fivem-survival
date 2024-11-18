export function debugChat(message) {
    sendChat(message);
}

export async function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

export async function loadModel(modelHash) {
    return new Promise(async (resolve, reject) => {
        if (!IsModelValid(modelHash) || !IsModelInCdimage(modelHash)) {
            reject(new Error(`Model ${modelHash} is not valid`));
        }

        RequestModel(modelHash)

        let timeout = 20000;
        while (!HasModelLoaded(modelHash)) {
            timeout -= 10;
            await sleep(10);

            if (!timeout) {
                reject(new Error("Failed to load model after 20,000ms"));

                return;
            }
        }

        resolve(modelHash);
    });
}

export async function loadAnimationDict(animationDict) {
    return new Promise(async (resolve, reject) => {
        if (!DoesAnimDictExist(animationDict)) {
            reject(new Error(`AnimationDict ${animationDict} is not valid`));

            return;
        }

        if (!HasAnimDictLoaded(animationDict)) {
            RequestAnimDict(animationDict)

            while (!HasAnimDictLoaded(animationDict)) {
                await sleep(10)
            }
        }

        resolve(animationDict);
    });
}

export async function runAnimation(ped, animDict, animName, duration = 0, flag = 0, playerCancellable = false){
    return new Promise(async (resolve,reject) => {
        if (duration === 0) {
            duration = GetAnimDuration(animDict, animName) * 1000;
        }

        TaskPlayAnim(ped, animDict, animName, 4.0, -4.0, duration, flag, 0, false, false, false);
        await sleep(50)

        if (playerCancellable) {
            let startedAt = GetGameTimer();
            const cancelTicker = setTick(() => {
                if (IsControlPressed(0, 30) || IsControlPressed(0, 31) || // Movement keys (A/D or Left/Right)
                    IsControlPressed(0, 32) || IsControlPressed(0, 33) || // Movement keys (W/S or Up/Down)
                    IsControlPressed(0, 34) || IsControlPressed(0, 35)) { // Movement keys (Q/E or Lean)
                    ClearPedTasks(ped); // Stop the animation
                    clearTick(cancelTicker);
                    reject(new Error("Player moved"));
                } else if (!IsEntityPlayingAnim(ped, animDict, animName, 3)) {
                    clearTick(cancelTicker);
                    resolve();
                }

                const elapsed = GetGameTimer() - startedAt;
                if (elapsed >= duration) {
                    clearTick(cancelTicker);
                    resolve();
                }
            });
        } else {
            await sleep(duration);
            resolve();
        }
    })
}

export async function runAnimationLooped(ped, animDict, animName, loops = 0, playerCancellable = false){
    return new Promise(async (resolve,reject) => {
        let duration = GetAnimDuration(animDict, animName) * 1000;
        if (loops) {
            duration *= loops;
        }

        TaskPlayAnim(ped, animDict, animName, 4.0, -4.0, duration, 1, 0, false, false, false);

        if (playerCancellable) {
            let startedAt = GetGameTimer();
            const cancelTicker = setTick(() => {
                if (IsControlPressed(0, 30) || IsControlPressed(0, 31) || // Movement keys (A/D or Left/Right)
                    IsControlPressed(0, 32) || IsControlPressed(0, 33) || // Movement keys (W/S or Up/Down)
                    IsControlPressed(0, 34) || IsControlPressed(0, 35)) { // Movement keys (Q/E or Lean)
                    ClearPedTasks(ped); // Stop the animation
                    clearTick(cancelTicker);
                    reject(new Error("Player moved"));
                } else if (!IsEntityPlayingAnim(ped, animDict, animName, 3)) {
                    clearTick(cancelTicker);
                    resolve();
                }

                const elapsed = GetGameTimer() - startedAt;
                if (elapsed >= duration) {
                    clearTick(cancelTicker);
                    resolve();
                }
            });
        } else {
            await sleep(duration);
            resolve();
        }
    })
}

export function throttle(func, wait = 250) {
    let isWaiting = false;
    return function executedFunction(...args) {
        if (!isWaiting) {
            func.apply(this, args);
            isWaiting = true;
            setTimeout(() => {
                isWaiting = false;
            }, wait);
        }
    };
}

export function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args);
        }, timeout);
    };
}

export function sendChat(message) {
    emit('chat:addMessage', {
        args: [
            message
        ]
    })
}

export function distanceBetweenEntities(e1, e2) {
    const coords1 = GetEntityCoords(e1);
    const coords2 = GetEntityCoords(e2);

    return GetDistanceBetweenCoords(coords1[0], coords1[1], coords1[2], coords2[0], coords2[1], coords2[2], true);
}

export function getPlayerAimTarget() {
    const [aiming, targetPed] = GetEntityPlayerIsFreeAimingAt(PlayerId());

    return aiming ? targetPed : 0;
}

export function isPedAnAlly(ped, ours = false) {
    return GetPedRelationshipGroupHash(ped) === GetHashKey('ALLY_GROUP') && !IsPedAPlayer(ped) && (!ours || NetworkGetEntityOwner(ped) === PlayerId());
}

export function getFreeVehicleSeats(vehicle, forceDriverAvailable = false) {
    const vehicleSeats = GetVehicleMaxNumberOfPassengers(vehicle);
    const result = [];

    if (forceDriverAvailable) {
        result.push(-1);
    }

    if (vehicleSeats) {
        for (let seat = -1; seat < vehicleSeats; seat++) {
            if (IsVehicleSeatFree(vehicle, seat)) {
                result.push(seat);
            } else {
                const seatedPed = GetPedInVehicleSeat(vehicle, seat);
                if (!isPedAnAlly(seatedPed, false) && !IsPedAPlayer(seatedPed)) {
                    result.push(seat);
                }
            }
        }
    }

    return result.filter((ele, index) => result.indexOf(ele) === index);
}

export function findNearbyFreeVehicles(ped, maxDistance = 30) {
    const coords = GetEntityCoords(ped, false);
    const allVehicles = GetGamePool('CVehicle');
    let vehicles = [];

    for (let vehicle of allVehicles) {
        const driverPed = GetPedInVehicleSeat(vehicle, -1);

        // Is this driver another player? Lets not select their vehicle
        if (IsPedAPlayer(driverPed) && driverPed !== PlayerPedId()) {
            continue;
        }

        // Is the vehicle moving? Lets ignore it
        if (GetEntitySpeed(vehicle) > 1) {
            continue;
        }

        // If the driver an ally ped thats owned by another player, skip it also
        if (GetPedRelationshipGroupHash(driverPed) === GetHashKey('PLAYER') && NetworkGetEntityOwner(driverPed) !== PlayerId()) {
            continue;
        }

        const vehicleCoords = GetEntityCoords(vehicle, false)
        vehicles.push({
            entity: vehicle,
            distance: GetDistanceBetweenCoords(coords[0], coords[1], coords[2], vehicleCoords[0], vehicleCoords[1], vehicleCoords[2], true)
        });
    }

    vehicles = vehicles.filter((veh) => veh.distance <= maxDistance);
    vehicles.sort((a, b) => a.distance - b.distance);

    return vehicles.map((vehicle) => vehicle.entity);
}

export function getHeadingTowardsPed(spawnX, spawnY, ped) {
    const pedCoords = GetEntityCoords(ped, true);
    const deltaX = pedCoords[0] - spawnX;
    const deltaY = pedCoords[1] - spawnY;

    // Calculate the heading using the 2D vector angle
    const heading = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Convert to a value between 0 and 360 (FiveM expects heading in this range)
    return (heading + 360) % 360;
}

export function findVehicleSpawnPointOutOfSight(playerPed, minDistance = 100.0, maxDistance = 200.0) {
    const playerCoords = GetEntityCoords(playerPed, true);

    // Lets try find a suitable place to spawn a vehicle out of sight from the player
    for (let i = 0; i < 1000; i++) {
        // Randomly pick a point within the distance range
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (maxDistance - minDistance);
        const targetX = playerCoords[0] + Math.cos(angle) * distance;
        const targetY = playerCoords[1] + Math.sin(angle) * distance;

        // Try find an appropriate road node
        const [found, coords, heading] = GetNthClosestVehicleNodeFavourDirection(targetX, targetY, playerCoords[2], playerCoords[0], playerCoords[1], playerCoords[2], 0, 0, 0, 0);
        if (found) {
            const travelDistance = CalculateTravelDistanceBetweenPoints(playerCoords[0], playerCoords[1], playerCoords[2], coords[0], coords[1], coords[2]);
            // Check if the road node is out of the player’s line of sight
            if (travelDistance >= minDistance && travelDistance <= maxDistance && !IsSphereVisible(coords[0], coords[1], coords[2], 2.0)) {
                return [...coords, heading];
            }
        }
    }

    return null;  // Return null if no suitable point is found after multiple attempts
}

export function displayTextOnScreen(text, x, y, scale = 1, colour = [255, 255, 255, 255], timeout = 5000, centerOnCoords = false) {
    const textTicker = setTick(() => {
        SetTextFont(0); // Font type
        SetTextProportional(1);
        SetTextScale(scale, scale);
        SetTextColour(colour[0], colour[1], colour[2], colour[3]); // RGBA color
        SetTextDropShadow();
        SetTextOutline();
        SetTextEntry("STRING");
        SetTextCentre(centerOnCoords);
        AddTextComponentString(Array.isArray(text) ? text.join("\n") : text);
        DrawText(x, y);
    });

    setTimeout(() => {
        clearTick(textTicker);
    }, timeout);
}

function calculateDotProductForEntities (entity1,entity2) {
    const firstEntityCoords = GetEntityCoords(entity1, true);
    const secondEntityCoords = GetEntityCoords(entity2, true);

    const [forwardX, forwardY, forwardZ] = GetEntityForwardVector(entity1);

    const toObjectX = secondEntityCoords[0] - firstEntityCoords[0];
    const toObjectY = secondEntityCoords[1] - firstEntityCoords[1];
    const toObjectZ = secondEntityCoords[2] - firstEntityCoords[2];

    // Normalize the to-object vector
    const length = Math.sqrt(toObjectX ** 2 + toObjectY ** 2 + toObjectZ ** 2);
    const normalizedToObject = [toObjectX / length, toObjectY / length, toObjectZ / length];

    // Calculate the dot product of the forward vector and the to-object vector
    return forwardX * normalizedToObject[0] +
        forwardY * normalizedToObject[1] +
        forwardZ * normalizedToObject[2];
}

export function isEntityInFrontOfEntity(entityInFront, entityTestingAgainst) {
    return calculateDotProductForEntities(entityTestingAgainst, entityInFront) > 0.1; // Adjust threshold if needed
}

export function isEntityBehindEntity(entityBehind, entityTestingAgainst) {
    return calculateDotProductForEntities(entityTestingAgainst, entityBehind) < -0.1; // Adjust threshold if needed

}

export function calculateHeadingForEntityFaceEntity(entityToRotate, targetEntity) {
    // Get coordinates of both entities
    const fromCoords = GetEntityCoords(entityToRotate, true);
    const toCoords = GetEntityCoords(targetEntity, true);

    // Calculate the difference in X and Y
    const deltaX = toCoords[0] - fromCoords[0];
    const deltaY = toCoords[1] - fromCoords[1];

    // Calculate the heading angle in degrees
    return (Math.atan2(deltaY, deltaX) * (180 / Math.PI)) - 90;
}

export function getEntityPositionInFrontOrBehind(entity, distance, isBehind = false) {
    // Get current coordinates and facing direction (heading) of the entity
    const [entityX, entityY, entityZ] = GetEntityCoords(entity, true);
    let [forwardX, forwardY, forwardZ] = GetEntityForwardVector(entity);

    // If we want to get the position behind the entity, reverse the direction
    if (isBehind) {
        forwardX = -forwardX;
        forwardY = -forwardY;
        forwardZ = -forwardZ;
    }

    // Calculate the new position by adding the direction vector scaled by the distance
    const newX = entityX + (forwardX * distance);
    const newY = entityY + (forwardY * distance);
    const newZ = entityZ + (forwardZ * distance);

    return [newX, newY, newZ];
}

export function scareNearbyPeds(radius = 10) {
    const playerPed = PlayerPedId();
    const nearbyPeds = GetGamePool('CPed')
        .filter((ped) => distanceBetweenEntities(playerPed, ped) <= radius);

    for (let ped of nearbyPeds) {
        TaskReactAndFleePed(ped, playerPed);
        PlayPain(ped, randomItem([3,4,5,6,7]), 0)
    }
}

export function randomItem(arr) {
    return arr[Math.round(Math.random() * (arr.length-1))];
}