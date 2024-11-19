import * as Cfx from 'fivem-js';
import initFlameTrail from "./client/flames";
import initCopOverride from "./client/copOverride";
import initPedControl from "./client/pedControl";
import initAllyPed from "./client/allyPed";
import {displayTextOnScreen, distanceBetweenEntities, drawTextThisFrame, getPlayerAimTarget, sendChat} from "./util/util";
import initAiTest from "./client/aiTest";
import config from "./client/config";
import {MoneySources, setPlayerCash} from "./util/Cash";
import initSpawnManager from "./client/spawnManager";
import {initInteractiveObjects} from "./client/interactiveObjects";
import initUnionDepositoryHeist from "./client/Heist/UnionDepository";

// init some listeners
addNetEventListener('skyemod:setCash', (walletCash, bankCash) => {
    setPlayerCash(walletCash, MoneySources.Wallet, true);
    setPlayerCash(bankCash, MoneySources.Bank, true);
});

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

RegisterCommand('clear', () => {
    TriggerEvent('chat:clear');
});

// Init modules
initSpawnManager();
initFlameTrail();
initCopOverride();
initPedControl();
initAllyPed();
initInteractiveObjects();
initUnionDepositoryHeist();

initAiTest();

for (let group of config.hatedGroups) {
    SetRelationshipBetweenGroups(4, GetHashKey('PLAYER'), GetHashKey(group))
    SetRelationshipBetweenGroups(4, GetHashKey(group), GetHashKey('PLAYER'))
}

displayTextOnScreen("SkyMod started", 0, 0, 0.5, [255,255,255,200], 3000, false);

let objTick = null;
RegisterCommand("whatobj", () => {
    if (objTick) {
        clearTick(objTick);
        objTick = null;
        sendChat('whatobj disabled')
    } else {
        sendChat('Aim gun at an entity to display further info')
        objTick = setTick(() => {
            const ent = getPlayerAimTarget();
            if (ent) {
                const coords = GetEntityCoords(ent,false);
                const model = GetEntityModel(ent);

                for (let i=0;i<3;i++) {
                    coords[i] = Math.round(coords[i] * 100)/100;
                }

                drawTextThisFrame(0.5, 0.45, `ModelHash: ${model}, X:${coords[0]}, Y:${coords[1]}, Z:${coords[2]}`, 0.3, true);
            }
        });
    }
})
