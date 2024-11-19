export default class Marker {
    constructor(x, y, z, radius, height, onEnter = null, onLeave = null) {
        this.coords = [x, y, z];
        this.radius = radius;
        this.height = height;
        this.onEnter = onEnter;
        this.onLeave = onLeave;
        this.playerInside = false;
    }

    draw() {
        const circumference = (this.radius * 2) * 1.1; // making a little larger to better fit the distance
        DrawMarker(1, this.coords[0], this.coords[1], this.coords[2], 0, 0, 0, 0, 0, 0, circumference, circumference, this.height, 0, 255, 0, 128, false, false, 0, false, 0, 0, false)
    }

    update() {
        const playerCoords = GetEntityCoords(PlayerPedId(), false);
        const playerDistance = Vdist(playerCoords[0], playerCoords[1], playerCoords[2] - 0.7, this.coords[0], this.coords[1], this.coords[2]);

        if (this.playerInside && playerDistance > this.radius) {
            this.playerInside = false;
            if (!IsPlayerTeleportActive()) {
                this.onLeave && this.onLeave();
            }
        } else if (!this.playerInside && playerDistance <= this.radius) {
            this.playerInside = true;
            if (!IsPlayerTeleportActive()) {
                this.onEnter && this.onEnter();
            }
        }
    }
}