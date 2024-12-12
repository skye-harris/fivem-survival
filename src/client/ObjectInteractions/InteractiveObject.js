export const InteractionDirection = {
    Any: 0,
    InFront: 1,
    Behind: 2,
}

export class InteractiveObject {
    constructor(entityId, useDirection, textOffset) {
        this.entity = entityId;
        this.textOffset = textOffset;
        this.direction = useDirection;
        this.onCooldownUntil = 0;
        this.maxUseDistance = 1.5;
    }

    async onUse() {
        return true;
    }

    canUse() {
        return GetGameTimer() >= this.onCooldownUntil;
    }

    getText() {
        return "Override me"
    }
}