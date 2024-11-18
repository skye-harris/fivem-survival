// init our db for player data

//GetPlayerIdentifier(source) license:<40-char-uuid

import DB from "./server/DB";

DB.createTable('users', [
    ['id', 'INTEGER', 'PRIMARY KEY AUTOINCREMENT'],
    ['identifier', 'STRING'],
    ['walletCash', 'INTEGER'],
    ['bankCash', 'INTEGER'],
    ['lastModelHash', 'INTEGER'],
]);

DB.createIndex('users', ['identifier'], true);

addNetEventListener('skyemod:settime', (args) => {
    emitNet('skyemod:settime', -1, args);
});

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
    const playerIdentifier = GetPlayerIdentifier(source).replace('license:', '');
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
    const playerIdentifier = GetPlayerIdentifier(source).replace('license:', '');
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

addEventListener('playerJoining', (source) => {
    const playerSource = source;
    const playerIdentifier = GetPlayerIdentifier(source).replace('license:', '');

    DB.select('users', ['walletCash', 'bankCash'], {identifier: playerIdentifier})
      .then((resp) => {
          const data = resp.pop();
          if (data) {
              const [walletCash, bankCash] = data.values[0];
              emitNet('skyemod:setCash', playerSource, walletCash, bankCash);
          } else {
              DB.insert('users', {identifier: playerIdentifier, walletCash: 0, bankCash: 0});
              emitNet('skyemod:setCash', playerSource, 0, 0);
          }
      });
});