import {drawTextThisFrame, getClosestObjectOfModel, loadModel, sendChat, sleep} from "../../util/util";
import Marker from "../Marker";
import {ClientRequest} from "../../util/ClientRequest";

const EntranceLocation = [9.9, -667.9, 32.45, 0];
const ExitLocation = [0.9, -702.8, 15.15, 334];

const ExtinguisherHash = -666581633;
const Extinguishers = [
    [9.98, -706.03, 15.36],
    [-12.5, -697.76, 15.36],
    [0.42, -693.13, 15.36],
    [-7.95, -686.71, 15.36],
    [-8.34, -686.57, 15.36],
];

class Heist {
    constructor(currentStage) {
        this.tickHandle = setTick(() => this.tick());
        this.currentStage = currentStage;
        this.stageTask = null;
        this.entranceMarker = this.createEntranceMarker();
        this.exitMarker = null;
    }

    endHeist() {
        clearTick(this.tickHandle);
        this.entranceMarker = null;
        this.exitMarker = null;
        this.tickHandle = 0;
    }

    tick() {
        for (let marker of [this.entranceMarker, this.exitMarker]) {
            if (marker) {
                marker.update();
                marker.draw();
            }
        }
    }

    beginPromiseChain() {
        switch (this.currentStage) {
            case 0:
                return this.stage1();

            case 1:
                return this.exitStage();
        }
    }

    createEntranceMarker() {
        return new Marker(EntranceLocation[0], EntranceLocation[1], EntranceLocation[2], 0.5, 1, () => {
            DoScreenFadeOut(500);
            sleep(500)
                .then(async () => {
                    StartPlayerTeleport(PlayerId(), ExitLocation[0], ExitLocation[1], ExitLocation [2], ExitLocation[3], false, true, true);
                    DoScreenFadeIn(500);

                    if (!this.stageTask) {
                        // if we arent already locally running the stage, then start it
                        this.stageTask = this.beginPromiseChain();
                    }
                });
        });
    }

    async stage1() {
        // Stage 1 resolves once all extinguishers are destroyed
        return new Promise(async (resolve, reject) => {
            let destroyEntities = [];
            let ticker = setTick(() => {
                drawTextThisFrame(0.5, 0.2, `${destroyEntities.length} remaining`, 0.2, true);
            });

            const resultChecker = setInterval(() => {
                if (!this.tickHandle) {
                    sendChat('cancelled?')
                    clearInterval(resultChecker);
                    clearTick(ticker)
                    reject(new Error("Heist has been cancelled"))
                } else {
                    destroyEntities = destroyEntities.filter((entity) => {
                        const isAlive = DoesEntityExist(entity) && !IsEntityDead(entity);

                        if (!isAlive) {
                            SetEntityDrawOutline(entity, false);
                            SetEntityAsNoLongerNeeded(entity);
                        }

                        return isAlive;
                    });

                    if (!destroyEntities.length) {
                        sendChat('nothing alive?')
                        clearTick(ticker)
                        clearInterval(resultChecker);
                        resolve();
                    }
                }
            }, 1000);

            // setup our extinguishers
            for (let coords of Extinguishers) {
                let result = getClosestObjectOfModel(ExtinguisherHash, coords[0], coords[1], coords[2]);
                let entity;

                if (result && result.distance < 1) {
                    entity = result.entity;
                    SetEntityAsMissionEntity(entity, true, true)

                    SetEntityCoords(entity, coords[0], coords[1], coords[2], true, true, true, false);
                    SetEntityRotation(entity, 0, 0, 0, 0, true);
                    SetEntityVisible(entity, true, true);
                } else {
                    await loadModel(ExtinguisherHash);
                    entity = CreateObject(ExtinguisherHash, coords[0], coords[1], coords[2], true, true, true);
                }

                NetworkRegisterEntityAsNetworked(entity);
                SetEntityCanBeDamaged(entity, true);
                SetEntityInvincible(entity, false)
                SetEntityHealth(entity, 10);
                SetEntityDrawOutline(entity, true);

                destroyEntities.push(entity);
            }

            sendChat('stage 1 active')
        }).then(() => {
            return this.exitStage();
        });
    }

    async exitStage() {
        return new Promise((resolve, reject) => {
            const cancelChecker = setInterval(() => {
                if (!this.tickHandle) {
                    clearInterval(cancelChecker);
                    reject(new Error("Heist has been cancelled"))
                }
            }, 1000);

            this.exitMarker = new Marker(ExitLocation[0], ExitLocation[1], ExitLocation[2], 0.5, 1, () => {
                DoScreenFadeOut(500);
                sleep(500)
                    .then(async () => {
                        StartPlayerTeleport(PlayerId(), EntranceLocation[0], EntranceLocation[1], EntranceLocation[2], EntranceLocation[3], false, true, true);
                        DoScreenFadeIn(500);

                        clearInterval(cancelChecker);
                        this.endHeist();
                        resolve();
                    });
            });

            sendChat('exit active')
        });
    }
}

export default function initUnionDepositoryHeist() {
    let heist = null;

    const delayedCheck = () => new Promise((resolve) => {
        const playerCoords = GetEntityCoords(PlayerPedId(), false);
        const distFromStart = Vdist(playerCoords[0], playerCoords[1], playerCoords[2], EntranceLocation[0], EntranceLocation[1], EntranceLocation[2]);
        let nextDelay = 10000;

        if (!heist) {
            if (distFromStart < 30 && playerCoords[2] < 34) {
                ClientRequest('heist:union:begin').then((heistState) => {
                    heist = new Heist(heistState.currentStage);
                    heist.createEntranceMarker();
                });
            } else if (distFromStart < 100) {
                nextDelay = 1000;
            } else if (distFromStart < 1000) {
                nextDelay = 5000;
            }
        }

        resolve(sleep(nextDelay)
                    .then(() => delayedCheck()));
    });

    delayedCheck(10000);
}