import {sendChat} from "../util/util";

const RegisteredDoors = [];
export function RegisterDoor(entity) {
    const existingDoor = RegisteredDoors.indexOf(entity);
    if (existingDoor !== -1) {
        return existingDoor;
    }

    const nextIndex = RegisteredDoors.length;
    const coords = GetEntityCoords(entity, false);
    RegisteredDoors.push(entity);

    AddDoorToSystem(nextIndex, GetEntityModel(entity), coords[0], coords[1], coords[2], 0,0,0);
    sendChat(nextIndex)

    return nextIndex;
}

export function GetDoorHash(entity) {
    return RegisteredDoors.indexOf(entity);
}