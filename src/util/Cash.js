import {ClientRequest} from "./ClientRequest";

export const MoneySources = {
    Wallet: 'MP0_WALLET_BALANCE',
    Bank: 'BANK_BALANCE'
};

export function getPlayerCash(whereFrom = MoneySources.Wallet) {
    const [success, currCash] = StatGetInt(whereFrom, -1);

    return currCash;
}

const displayCashTimeout = [0,0];
export function setPlayerCash(amount, whereTo = MoneySources.Wallet, displayCashOnScreen = false) {
    const index = whereTo === MoneySources.Wallet ? 0 : 1;
    const didCashChange = getPlayerCash(whereTo) !== amount;
    if (!didCashChange) {
        return;
    }

    clearTimeout(displayCashTimeout[index]);

    if (displayCashOnScreen) {
        DisplayCash(true);
        switch (whereTo) {
            case MoneySources.Wallet:
                SetMultiplayerWalletCash();
                break;

            case MoneySources.Bank:
                SetMultiplayerBankCash();
                break;
        }
    }

    StatSetInt(whereTo, Math.max(0, amount), true);

    if (displayCashOnScreen) {
        displayCashTimeout[index] = setTimeout(() => {
            displayCashTimeout[index] = 0;

            switch (whereTo) {
                case MoneySources.Wallet:
                    RemoveMultiplayerWalletCash();
                    break;

                case MoneySources.Bank:
                    RemoveMultiplayerBankCash();
                    break;
            }
        }, 3000);
    }
    DisplayCash(false);
}

export function addPlayerMoney(amount, whereTo = MoneySources.Wallet) {
    // todo: this should be all handled server side and it just tells us what cash we have
    emitNet('skyemod:receivedCash', amount, whereTo);
}
export async function spendCash(amount) {
    return ClientRequest('skyemod:spendCash', amount).then((resp) => {
        const result = Boolean(resp);
        if (!result) {
            throw new Error("Not enough cash");
        }

        return true;
    });
}