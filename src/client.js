import {sendChat, throttle} from "./util/util";
import {AnimalHashes} from "./util/AnimalHashes";
import * as Cfx from 'fivem-js';
import initFlameTrail from "./client/flames";
import config from "./client/config";
import initCopOverride from "./client/copOverride";

// Start the trains running
for (let trackIndex of [0, 3]) {
    SwitchTrainTrack(trackIndex, true)
    SetTrainTrackSpawnFrequency(trackIndex, 120000);
}

// A little further world setup
SetTrainsForceDoorsOpen(false);
SetRandomBoats(true);
SetAggressiveHorns(true);
SetAllLowPriorityVehicleGeneratorsActive(true);

const weaponHashes = [
    // Some basic weapons...
    GetHashKey("WEAPON_PISTOL"),
    GetHashKey("WEAPON_COMBATPISTOL"),
    GetHashKey("WEAPON_MICROSMG"),
    GetHashKey("WEAPON_SMG"),
    GetHashKey("WEAPON_ASSAULTRIFLE"),
    GetHashKey("WEAPON_CARBINERIFLE"),

    // How crazy do we want to get?
    GetHashKey("WEAPON_SNIPERRIFLE"),
    GetHashKey("WEAPON_GRENADE"),
    GetHashKey("WEAPON_GRENADELAUNCHER"),
    GetHashKey("WEAPON_RPG"),
    GetHashKey("WEAPON_MINIGUN"),
    GetHashKey("WEAPON_COMPACTLAUNCHER"),
    GetHashKey("WEAPON_MOLOTOV"),
];

function getRandomWeapon() {
    const randomIndex = Math.floor(Math.random() * weaponHashes.length);
    return weaponHashes[randomIndex];
}

RegisterCommand('peds', (source, args) => {
    const arg = args.length ? args[0].toLowerCase() : null;

    if (['on', 'off', 'hostile', 'normal'].indexOf(arg) === -1) {
        sendChat(`Usage: "/peds [on/off]"  Will enable or disable population NPC spawning.`);
        sendChat(`Usage: "/peds [normal/hostile]"  Will enable or disable population NPCs attacking you.`);
        return;
    }

    switch (arg) {
        case 'on':
        case 'off':
            config.pedsOn = arg === 'on';
            sendChat(`Peds ${config.pedsOn ? 'ON' : 'OFF'}!`);
            break;

        case 'normal':
        case 'hostile':
            config.pedsHostile = arg === 'hostile';
            sendChat(`Peds ${config.pedsHostile ? 'HOSTILE' : 'NORMAL'}!`);
            break;
    }
}, false);

RegisterCommand("settime", (source, args) => {
    emitNet('skyemod:settime', args);
}, false);

// Handle time update
addNetEventListener('skyemod:settime', (args) => {
    NetworkOverrideClockTime(Number(args[0]), Number(args[1]), Number(args[2]));
});

// Hostile Peds ticker, throttled to every 2sec
setTick(throttle(() => {
    if (!config.pedsHostile) {
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
        if (IsPedDeadOrDying(ped, true)) {
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

        const pedModel = GetEntityModel(ped)
            .toString();
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
            TaskDriveBy(ped, player, 0, 0.0, 0.0, 0.0, 50.0, accuracy, true, "FIRING_PATTERN_BURST_FIRE");
        } else {
            // Ped is on foot, engage in regular combat
            TaskCombatPed(ped, player, 0, 16);
        }
    }
}, 2000));

initFlameTrail();
initCopOverride();
