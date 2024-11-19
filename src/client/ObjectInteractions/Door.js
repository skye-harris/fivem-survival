import {InteractionDirection, InteractiveObject} from "./InteractiveObject";
import {sendChat} from "../../util/util";

const registeredDoors = [];
export default class Door extends InteractiveObject {
    constructor(entityId) {
        super(entityId, InteractionDirection.Any, [0.5,0,1.2]);
    }

    getText() {
        return "Press [] to open door";
    }

    async onUse() {
        if (!IsDoorRegisteredWithSystem(this.entity)) {
            const nextIndex = registeredDoors.length;
            const coords = GetEntityCoords(this.entity, false);
            AddDoorToSystem(nextIndex, GetEntityModel(this.entity), coords[0], coords[1], coords[2], 0,0,0);

            this.doorId = nextIndex;
        }

        DoorSystemSetDoorState(this.doorId, 0); // 0 = Open
        DoorSystemSetHoldOpen(this.doorId, true); // Prevent it from auto-closing
        DoorSystemSetHoldOpen(this.doorId, true);
    }
}