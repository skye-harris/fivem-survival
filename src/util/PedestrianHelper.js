export default class PedestrianHelper {
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
