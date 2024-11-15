import * as Cfx from 'fivem-js';
import initFlameTrail from "./client/flames";
import initCopOverride from "./client/copOverride";
import initPedControl from "./client/pedControl";
import initAllyPed from "./client/allyPed";
import {displayTextOnScreen, sendChat} from "./util/util";

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

RegisterCommand("settime", (source, args) => {
    emitNet('skyemod:settime', args);
}, false);

// Handle time update
addNetEventListener('skyemod:settime', (args) => {
    NetworkOverrideClockTime(Number(args[0]), Number(args[1]), Number(args[2]));
    displayTextOnScreen(`Time has been set to ${args[0]}:${args[1]}:${args[2]}!`, 0.5, 0.1, 0.5, [255,255,255,200],3000, true);
});

RegisterCommand("bptyres", (source,args) => {
    const vehicle = GetVehiclePedIsUsing(PlayerPedId());
    if (vehicle) {
        const numWheels = GetVehicleNumberOfWheels(vehicle);
        for (let wheel=0;wheel < numWheels; wheel++) {
            SetVehicleTyreFixed(vehicle,wheel);
        }

        SetVehicleTyresCanBurst(vehicle, false);
        displayTextOnScreen("Made tyres bulletproof!", 0.5, 0.1, 0.5, [255,255,255,200],3000, true);
    }
});

// Init modules
initFlameTrail();
initCopOverride();
initPedControl();
initAllyPed();

const hatedGroups = [
    'AMBIENT_GANG_BALLAS',
    'AMBIENT_GANG_CULT',
    'AMBIENT_GANG_FAMILY',
    'AMBIENT_GANG_LOST',
    'AMBIENT_GANG_MARABUNTE',
    'AMBIENT_GANG_MEXICAN',
    'AMBIENT_GANG_SALVA',
    'AMBIENT_GANG_WEICHENG',
    'AMBIENT_GANG_HILLBILLY',
];

for (let group of hatedGroups) {
    SetRelationshipBetweenGroups(4, GetHashKey('PLAYER'), GetHashKey(group))
    SetRelationshipBetweenGroups(4, GetHashKey(group), GetHashKey('PLAYER'))
}

displayTextOnScreen("SkyMod started", 0, 0, 0.5, [255,255,255,200], 3000, false);