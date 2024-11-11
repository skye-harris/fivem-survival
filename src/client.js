import * as Cfx from 'fivem-js';
import initFlameTrail from "./client/flames";
import initCopOverride from "./client/copOverride";
import initPedControl from "./client/pedControl";
import initAllyPed from "./client/allyPed";

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
});

// Init modules
initFlameTrail();
initCopOverride();
initPedControl();
initAllyPed();