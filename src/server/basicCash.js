import DB from "./DB";

export default function initBasicCash() {
    addNetEventListener('skyemod:spendCash', (amount) => {
        const playerIdentifier = GetPlayerIdentifier(source).replace('license:', '');
        const playerSource = source;

        DB.select('users', ['walletCash', 'bankCash'], {identifier: playerIdentifier})
          .then((resp) => {
              const data = resp.pop();
              if (data) {
                  let [walletCash, bankCash] = data.values[0];
                  if (walletCash + bankCash >= amount) {
                      // first duduct from wallet, then from bank
                      walletCash -= amount;
                      if (walletCash < 0) {
                          bankCash += walletCash;
                          walletCash = 0;
                      }

                      DB.update('users', {walletCash: walletCash, bankCash: bankCash}, {identifier: playerIdentifier});
                      emitNet('skyemod:spendCash', playerSource, true);
                      emitNet('skyemod:setCash', playerSource, walletCash, bankCash);
                  } else {
                      emitNet('skyemod:spendCash', playerSource, false);
                  }
              } else {
                  emitNet('skyemod:spendCash', playerSource, false);
              }
          });
    });

    addNetEventListener('skyemod:bankCash', () => {
        const playerIdentifier = DB.playerIdentifierForSource(source);
        const playerSource = source;

        DB.select('users', ['walletCash', 'bankCash'], {identifier: playerIdentifier})
          .then((resp) => {
              const data = resp.pop();
              if (data) {
                  let [walletCash, bankCash] = data.values[0];
                  DB.update('users', {walletCash: 0, bankCash: bankCash+walletCash}, {identifier: playerIdentifier});

                  emitNet('skyemod:setCash', playerSource, 0, bankCash+walletCash);
              }
          });
    });

    addNetEventListener('skyemod:receivedCash', (amount) => {
        const playerIdentifier = DB.playerIdentifierForSource(source);
        const playerSource = source;

        DB.select('users', ['walletCash','bankCash'], {identifier: playerIdentifier})
          .then((resp) => {
              const data = resp.pop();
              if (data) {
                  let [walletCash, bankCash] = data.values[0];

                  DB.update('users', {walletCash: walletCash+amount}, {identifier: playerIdentifier});
                  emitNet('skyemod:setCash', playerSource, walletCash, bankCash);
              }
          });
    });
}