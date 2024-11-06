import {sendChat, throttle} from "./util/util";
import {AnimalHashes} from "./util/AnimalHashes";
import * as Cfx from 'fivem-js';
import {ClientRequest} from "./util/ClientRequest";
import PedestrianHelper from "./util/PedestrianHelper";

// Start the trains running
for (let trackIndex of [0,3]) {
    SwitchTrainTrack(trackIndex, true)
    SetTrainTrackSpawnFrequency(trackIndex, 120000);
}

// A little further world setup
SetTrainsForceDoorsOpen(false);
SetRandomBoats(true);
SetAggressiveHorns(true);
SetAllLowPriorityVehicleGeneratorsActive(true);

const weaponHashes = [
    GetHashKey("WEAPON_PISTOL"),
    GetHashKey("WEAPON_COMBATPISTOL"),
    GetHashKey("WEAPON_MICROSMG"),
    GetHashKey("WEAPON_SMG"),
    GetHashKey("WEAPON_ASSAULTRIFLE"),
    GetHashKey("WEAPON_CARBINERIFLE"),
    GetHashKey("WEAPON_SNIPERRIFLE"),
    GetHashKey("WEAPON_GRENADE"),
    GetHashKey("WEAPON_GRENADELAUNCHER"),
    GetHashKey("WEAPON_RPG"),
    GetHashKey("WEAPON_MINIGUN"),
    GetHashKey("WEAPON_COMPACTLAUNCHER"),
    GetHashKey("WEAPON_MOLOTOV"),
    // Add more weapon hashes as needed
];


function getRandomWeapon() {
    const randomIndex = Math.floor(Math.random() * weaponHashes.length);
    return weaponHashes[randomIndex];
}

const lawEnforcement = [
    "s_f_y_cop_01",
    "s_m_y_cop_01",
    "s_f_y_ranger_01",
    "s_m_y_ranger_01",
    "s_f_y_sheriff_01",
    "s_m_y_sheriff_01",
    "s_m_y_swat_01",
    "s_m_y_pilot_01",
    "s_m_m_pilot_01",
    "s_m_m_pilot_02",
    "s_m_m_prisguard_01",
    "s_m_m_security_01",
    "s_m_m_chemsec_01",
    "s_m_m_ciasec_01",
    "s_m_m_fibsec_01",
    "s_m_m_highsec_01",
    "s_m_m_highsec_02",
    "s_m_y_hwaycop_01",
    "s_m_m_paramedic_01",
];

const leoMap = {};
lawEnforcement.forEach((model) => {
    leoMap[GetHashKey(model)] = model;
    leoMap["-1920001264"] = "-1920001264";
});

const animalMap = {};
Object.values(AnimalHashes)
      .forEach((model) => {
          animalMap[GetHashKey(model)] = model;
      });


// Turn local population NPC's into cops?
let copOverrideChance = 0;

// Flame effect following vehicles at speed
let flameOn = false;

// Start turning all NPCs hostile towards the player?
let pedsHostile = false;

// Disable population NPC spawning completely, won't despawn any that already exist
let pedsOn = true;

function populationPedCreating(x, y, z, model, setters) {
    if (!pedsOn) {
        // If we arent spawning any peds, bail-out now
        CancelEvent();
        return;
    }

    if (copOverrideChance === 0) {
        // If we arent overriding ped spawns, bail-out now
        return;
    }

    const [groundRet,groundZ] = GetGroundZFor_3dCoord(x,y,z,true);
    if (groundRet && groundZ < (z-2)) {
        // If the ped is more than 2m off of the ground, theyre probably a bird.. lets leave them alone
        return;
    }

    const isAnimal = animalMap.hasOwnProperty(model.toString());
    if (isAnimal) {
        // If the ped model is a known animal hash, leave them be. we love our wildlife <3
		return;
    }

    const isLawEnforcement = leoMap.hasOwnProperty(model.toString());
    if (isLawEnforcement)
    {
        // If the ped model is a known law enforcement hash, leave them be
        return;
    }

    const spawnAsCop = Math.random() > (1-copOverrideChance);

    if (spawnAsCop) {
        // Lets load in a law enforcement officer!
        const keys = Object.keys(lawEnforcement);
        const modelIndex = Math.round(Math.random() * (keys.length - 1));
        let modelToUse = lawEnforcement[keys[modelIndex]];

        if (!IsModelValid(modelToUse) || !IsModelInCdimage(modelToUse) || !modelToUse) {
            return;
        }

        if (!HasModelLoaded(modelToUse)) {
            RequestModel(modelToUse);
        }

        setters.setModel(modelToUse);
    }
}

RegisterCommand('copittome', (source,args,rawCommand) => {
    if (args.length !== 1) {
        sendChat(`Usage: "/copittome 0.5" will set to 50%. Use 0 to disable.`);
        return;
    }

    let copChance = Number(args[0]);
    copOverrideChance = Math.min(Math.max(0,copChance),1);

    sendChat(`Cop Override chance set to ${copChance*100}%`);
}, false);

addEventListener('populationPedCreating', populationPedCreating);

RegisterCommand('flame', (source,args,rawCommand) => {
    const arg = args.length ? args[0].toLowerCase() : null;

    if (['on','off'].indexOf(arg) === -1) {
        sendChat(`Usage: "/flame [on/off]"  Will enable or disable the flame effect.`);
        return;
    }

    flameOn = arg === 'on';
    sendChat(`Flame ${flameOn ? 'ON' : 'OFF'}!`);
}, false);

RegisterCommand('peds', (source,args,rawCommand) => {
    const arg = args.length ? args[0].toLowerCase() : null;

    if (['on','off','hostile','normal'].indexOf(arg) === -1) {
        sendChat(`Usage: "/peds [on/off]"  Will enable or disable population NPC spawning.`);
        sendChat(`Usage: "/peds [normal/hostile]"  Will enable or disable population NPCs attacking you.`);
        return;
    }

    switch (arg) {
        case 'on':
        case 'off':
            pedsOn = arg === 'on';
            sendChat(`Peds ${pedsOn ? 'ON' : 'OFF'}!`);
            break;

        case 'normal':
        case 'hostile':
            pedsHostile = arg === 'hostile';
            sendChat(`Peds ${pedsHostile ? 'HOSTILE' : 'NORMAL'}!`);
            break;
    }
}, false);

RegisterCommand("settime", (source,args) => {
    emitNet('skyemod:settime', args);
}, false);

addNetEventListener('skyemod:settime', (args) => {
    NetworkOverrideClockTime(Number(args[0]), Number(args[1]), Number(args[2]));
});

setTick(throttle(() => {
    if (!flameOn) {
        return;
    }

    const player = PlayerPedId();
    const nearbyPlayers = PedestrianHelper.getNearbyPlayers(100, true).filter((playerPedId) => {
        const playerSpeed = GetEntitySpeed(playerPedId);

        return playerSpeed > 10 && IsPedInAnyVehicle(playerPedId, false) && !IsPedInAnyBoat(playerPedId) && !IsPedInAnyPlane(playerPedId) && !IsPedInAnyHeli(playerPedId);
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
                    }, 10000)
                }
            }
        } catch (err) {
            //sendChat(err.message);
        }
    }
}, 100));

setTick(throttle(() => {
    if (!pedsHostile) {
        return;
    }

    const allPeds = GetGamePool('CPed');
    const player = PlayerPedId();

    for (let ped of allPeds) {
        // Dont set this on players
        if (IsPedAPlayer(ped)) {
            continue;
        }

        // Skip if the NPC is dead/dying
        if (IsPedDeadOrDying(ped,true)) {
            continue;
        }

        // Skip if in combat with a player already.. let them keep fighting
        if (IsPedInCombat(ped, 0)) {
            let isInPlayerCombat = false;

            for (let player of GetActivePlayers()) {
                const thisPlayerPed = GetPlayerPed(player);
                if (IsPedInCombat(ped, thisPlayerPed)) {
                    isInPlayerCombat = true;
                    break;
                }
            }

            if (isInPlayerCombat) {
                continue;
            }
        }

        const pedModel = GetEntityModel(ped).toString();
        const isLawEnforcement = leoMap.hasOwnProperty(pedModel);
        if (isLawEnforcement) {
            // We dont want to affect law enforcement
            continue;
        }

        // Lets only arm them once, and only arm humans
        if (!IsPedArmed(ped, 4) && !IsPedArmed(ped, 2) && !IsPedArmed(ped, 1) && IsPedHuman(ped)) {
            const ammoAmount = 20 + Math.round(Math.random() * 1000);

            if (IsPedInAnyVehicle) {
                GiveWeaponToPed(ped, GetHashKey("WEAPON_MICROSMG"), ammoAmount, false, true);
            } else {
                GiveWeaponToPed(ped, getRandomWeapon(), ammoAmount, false, true);
            }
        }

        // Prevent NPC from getting angry at anyone else
        SetPedRelationshipGroupHash(ped, GetHashKey("HATES_PLAYER"));

        // Prevent the ped from fleeing
        SetPedCombatAttributes(ped, 46, true);

        if (IsPedHuman(ped)) {
            const accuracy = Math.round(50 + (Math.random() * 80));
            SetPedAccuracy(ped, accuracy);
        }

        if (IsPedInAnyVehicle(ped, false)) {
            // Ped is in a vehicle, set them up for a drive-by if they're not already armed
            // Task ped with drive-by targeting the player
            TaskDriveBy(ped, player, 0, 0.0, 0.0, 0.0, 50.0, accuracy , true, "FIRING_PATTERN_BURST_FIRE");
        } else {
            // Ped is on foot, engage in regular combat
            TaskCombatPed(ped, player, 0, 16);
        }
    }
}, 2000));
