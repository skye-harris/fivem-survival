import DB from "./server/DB";
import initBasicCash from "./server/basicCash";
import initUnionDepositoryHeist from "./server/Heist/UnionDepository";

DB.createTable('users', [
    ['id', 'INTEGER', 'PRIMARY KEY AUTOINCREMENT'],
    ['identifier', 'STRING'],
    ['walletCash', 'INTEGER'],
    ['bankCash', 'INTEGER'],
    ['lastModelHash', 'INTEGER'],
]);

DB.createIndex('users', ['identifier'], true);

initBasicCash();
initUnionDepositoryHeist();

addNetEventListener('skyemod:settime', (args) => {
    emitNet('skyemod:settime', -1, args);
});

addNetEventListener('skyemod:saveModelHash', (modelHash) => {
    const playerIdentifier = DB.playerIdentifierForSource(source);
    DB.update('users', {lastModelHash: modelHash}, {identifier: playerIdentifier});
    console.log(`Player model hash updated`);
});

addEventListener('playerJoining', (source) => {
    const playerIdentifier = DB.playerIdentifierForSource(source);
    const playerSource = source;
    console.log(`Player joining...`);

    DB.select('users', ['walletCash', 'bankCash', 'lastModelHash'], {identifier: playerIdentifier})
      .then((resp) => {
          const data = resp.pop();
          if (data) {
              const [walletCash, bankCash, lastModelHash] = data.values[0];
              emitNet('skyemod:loginData', playerSource, walletCash, bankCash, lastModelHash);
          } else {
              DB.insert('users', {identifier: playerIdentifier, walletCash: 0, bankCash: 0, lastModelHash: 0});
              emitNet('skyemod:loginData', playerSource, 0, 0, 0);
          }
          console.log(`Sent login data to player`);
      });
});