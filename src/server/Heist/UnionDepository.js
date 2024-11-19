const HeistState = {
    active: false,
    currentStage: null,
};

export default function initUnionDepositoryHeist() {
    addNetEventListener('heist:union:begin', () => {
        if (!HeistState.active) {
            HeistState.active = true;
            HeistState.currentStage = 0;
        }

        emitNet('heist:union:begin',source,HeistState);
    });
}

