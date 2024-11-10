export async function sleep(ms) {
    return new Promise(res => setTimeout(res,ms));
}

export async function loadModel(modelHash) {
    return new Promise(async (resolve,reject) => {
        if (!IsModelValid(modelHash) || !IsModelInCdimage(modelHash)) {
            reject(new Error("Model is not valid"));
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
    return new Promise(async (resolve,reject) => {
        if (!HasAnimDictLoaded(animationDict)) {
            RequestAnimDict(animationDict)

            while (!HasAnimDictLoaded(animationDict)) {
                await sleep(10)
            }
        }

        resolve(animationDict);
    });
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

export function sendChat(message) {
    emit('chat:addMessage', {
        args: [
            message
        ]
    })
}

export function distance3D(x1,y1,z1, x2,y2,z2) {
    return Math.abs(Math.sqrt(
        Math.pow(x2 - x1, 2) +
        Math.pow(y2 - y1, 2) +
        Math.pow(z2 - z1, 2)
    ));
}

export function getPlayerAimTarget() {
    const [aiming, targetPed] = GetEntityPlayerIsFreeAimingAt(PlayerId());

    return aiming ? targetPed : false;
}

export function getFreeVehicleSeats(vehicle, forceDriverAvailable = false) {
    const vehicleSeats = GetVehicleMaxNumberOfPassengers(vehicle);
    const result = [];

    if (forceDriverAvailable) {
        result.push(-1);
    }

    for (let seat = -1; seat < vehicleSeats; seat++) {
        if (IsVehicleSeatFree(vehicle, seat)) {
            result.push(seat);
        }
    }

    return result.filter((ele,index) => result.indexOf(ele) === index);
}

export function findNearbyFreeVehicle(ped) {
    const coords = GetEntityCoords(ped, false);
    const allVehicles = GetGamePool('CVehicle');
    let vehicles = [];

    for (let vehicle of allVehicles) {
        const driverPed = GetPedInVehicleSeat(vehicle,-1);

        if (IsPedAPlayer(driverPed)) {
            continue;
        }

        if (GetEntitySpeed(vehicle) > 1) {
            continue;
        }

        if (GetPedRelationshipGroupHash(driverPed) === GetHashKey('PLAYER')) {
            continue;
        }

        const vehicleCoords = GetEntityCoords(vehicle,false)
        vehicles.push({
            entity: vehicle,
            distance: GetDistanceBetweenCoords(coords[0],coords[1],coords[2],vehicleCoords[0],vehicleCoords[1],vehicleCoords[2], true)
        });
    }

    vehicles = vehicles.filter((veh) => veh.distance < 30);
    vehicles.sort((a,b) => a.distance - b.distance);

    return vehicles.length ? vehicles[0] : null;
}