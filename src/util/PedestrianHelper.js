export default class PedestrianHelper {
    isPlayerAimingAt(ped) {
        const [aiming, targetPed] = GetEntityPlayerIsFreeAimingAt(PlayerId())
        return aiming && targetPed === ped.handle;
    }

    distanceFromPlayer(playerPedId, ped) {
        const playerCoords = GetEntityCoords(playerPedId, false);
        const pedCoords = GetEntityCoords(ped.handle, false);

        return GetDistanceBetweenCoords(pedCoords[0], pedCoords[1] , pedCoords[2], playerCoords[0], playerCoords[1], playerCoords[2], true)
    }

    performTaskSequence(sequenceCallback) {
        const sequence = OpenSequenceTask(0);

        sequenceCallback();

        CloseSequenceTask(sequence);
        TaskPerformSequence(this.ped.handle, sequence);
    }

    static getNearbyPlayers(radius = 100, includeSelf = false) {
        const myPlayerPedId = PlayerPedId();
        const myCoords = GetEntityCoords(myPlayerPedId, true);

        let nearbyPlayers = [];
        for (let playerId of GetActivePlayers()) {
            const playerPedId = GetPlayerPed(playerId);

            if (playerPedId !== myPlayerPedId || includeSelf) {
                const playerCoords = GetEntityCoords(playerPedId, true);
                const distance = GetDistanceBetweenCoords(playerCoords[0],playerCoords[1],playerCoords[2],myCoords[0],myCoords[1],myCoords[2],true);

                if (distance <= radius) {
                    nearbyPlayers.push(playerPedId);
                }
            }
        }

        return nearbyPlayers;
    }

}
