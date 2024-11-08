import config from "./config";
import {sendChat} from "../util/util";
import {AnimalHashes} from "../util/AnimalHashes";
import {LawEnforcementHashes} from "../util/LawEnforcementHashes";

export default function initCopOverride() {
    RegisterCommand('copittome', (source, args) => {
        if (args.length !== 1) {
            sendChat(`Usage: "/copittome 0.5" will set to 50%. Use 0 to disable.`);
            return;
        }

        let copChance = Number(args[0]);
        copChance = Math.min(Math.max(0, copChance), 1);
        config.copOverrideChance = copChance;

        sendChat(`Cop Override chance set to ${copChance * 100}%`);
    }, false);

    addEventListener('populationPedCreating', (x, y, z, model, setters) => {
        if (!config.pedsOn) {
            // If we arent spawning any peds, bail-out now
            CancelEvent();
            return;
        }

        if (config.copOverrideChance === 0) {
            // If we arent overriding ped spawns, bail-out now
            return;
        }

        const [groundRet, groundZ] = GetGroundZFor_3dCoord(x, y, z, true);
        if (groundRet && groundZ < (z - 2)) {
            // If the ped is more than 2m off of the ground, theyre probably a bird.. lets leave them alone
            return;
        }

        try {
            const modelHash = model.toString();
            const isAnimal = AnimalHashes.hasOwnProperty(modelHash);
            if (isAnimal) {
                // If the ped model is a known animal hash, leave them be. we love our wildlife <3
                return;
            }

            const isLawEnforcement = LawEnforcementHashes.hasOwnProperty(modelHash);
            if (isLawEnforcement) {
                // If the ped model is a known law enforcement hash, leave them be
                return;
            }

            const spawnAsCop = Math.random() > (1 - config.copOverrideChance);

            if (spawnAsCop) {
                // Lets load in a law enforcement officer!
                const keys = Object.keys(LawEnforcementHashes);
                const modelIndex = Math.round(Math.random() * (keys.length - 1));
                let modelToUse = LawEnforcementHashes[keys[modelIndex]];

                if (!IsModelValid(modelToUse) || !IsModelInCdimage(modelToUse) || !modelToUse) {
                    return;
                }

                if (!HasModelLoaded(modelToUse)) {
                    RequestModel(modelToUse);
                }

                setters.setModel(modelToUse);
            }
        } catch (err) {
            sendChat(err.message);
        }
    });
}
