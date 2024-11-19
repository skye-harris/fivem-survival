import {sleep} from "../util/util";
import {MoneySources, setPlayerCash} from "../util/Cash";
import {WeaponHash} from "fivem-js";

function findSpawnPointNearby(minDistance = 100.0, maxDistance = 200.0) {
    const playerCoords = GetEntityCoords(PlayerPedId(), true);

    // Lets try find a suitable place to spawn a vehicle out of sight from the player
    for (let i = 0; i < 1000; i++) {
        // Randomly pick a point within the distance range
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (maxDistance - minDistance);
        const targetX = playerCoords[0] + Math.cos(angle) * distance;
        const targetY = playerCoords[1] + Math.sin(angle) * distance;

        // Try find an appropriate road node
        const [found, coords] = GetClosestVehicleNode(targetX, targetY, playerCoords[2], 0, 0, 0);
        if (found) {
            return coords;
        }
    }

    return null;  // Return null if no suitable point is found after multiple attempts
}

export default function initSpawnManager() {
    let isFirstSpawn = true;
    let playerModelHash = GetEntityModel(PlayerPedId());

    // Receive login data from the server
    addNetEventListener('skyemod:loginData', (walletCash, bankCash, lastModelHash) => {
        playerModelHash = lastModelHash;
        setPlayerCash(walletCash, MoneySources.Wallet);
        setPlayerCash(bankCash, MoneySources.Bank);
    });

    exports.spawnmanager.setAutoSpawnCallback(async () => {
        const spawnArgs = {
            x: 686.245,
            y: 577.950,
            z: 130.461,
        };

        if (!isFirstSpawn) {
            let distanceEnd = 200;
            let iterations = 10;

            while (iterations > 0) {
                const spawnPoint = findSpawnPointNearby(100, distanceEnd);

                if (spawnPoint) {
                    spawnArgs.x = spawnPoint[0];
                    spawnArgs.y = spawnPoint[1];
                    spawnArgs.z = spawnPoint[2];

                    break;
                }

                distanceEnd+=100;
                iterations--;
            }
        } else {
            // delay a couple seconds for data to come in, but dont wait forever
            await sleep(5000);

            // Apply our ped model from server on first spawn... dont override on subsequent spawns
            spawnArgs.model = playerModelHash;
            isFirstSpawn = false;
        }

        exports.spawnmanager.spawnPlayer(spawnArgs, () => {
            GiveWeaponToPed(PlayerPedId(), WeaponHash.CombatPistol, 100, false, true);
        });
    });

    exports.spawnmanager.setAutoSpawn(true);

    // Every 30 seconds lets see if our model has changed, and if so, persist that to the server
    setInterval(() => {
        const currModelHash = GetEntityModel(PlayerPedId());
        if (currModelHash !== playerModelHash) {
            emitNet("skyemod:saveModelHash", currModelHash);
            playerModelHash = currModelHash;
        }
    }, 30000);
}