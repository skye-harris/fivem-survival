import {sendChat, throttle} from "../util/util";
import config from "./config";
import {LawEnforcementHashes} from "../util/LawEnforcementHashes";

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

export default function initPedControl() {
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

            // Skip mission NPCs
            if (IsEntityAMissionEntity(ped)) {
                continue;
            }

            // Skip Ally NPCs
            if (GetPedRelationshipGroupHash(ped) === GetHashKey('PLAYER')) {
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
            const isLawEnforcement = LawEnforcementHashes.hasOwnProperty(pedModel);
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

            SetPedCombatAttributes(ped, 46, true);
            //SetPedFleeAttributes(ped, 0, false);

            SetPedCombatRange(ped, Math.round(Math.random() * 3));
            SetPedCombatMovement(ped, Math.round(Math.random() * 3));
            SetPedCombatAbility(ped, Math.round(Math.random() * 2));

            const accuracy = Math.round(50 + (Math.random() * 80));

            if (IsPedHuman(ped)) {
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
}