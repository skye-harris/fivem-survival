const callbacks = {};
let callbackId = 0;

AddEventHandler('u5_sqlite:lua:callbackResult', (callbackId, results) => {
    if (callbacks.hasOwnProperty(callbackId)) {
        const callback = callbacks[callbackId];
        delete callbacks[callbackId];

        callback(results);
    }
});

const DB = {
    playerIdentifierForSource(source) {
        return GetPlayerIdentifier(source).replace('license:', '');
    },

    select: async (table, columns = ['*'], where, rawWhere) => {
        return new Promise((resolve, reject) => {
            let cbId = callbackId;

            callbacks[cbId] = (args) => {
                delete callbacks[cbId];
                resolve(args);
            };

            emit('u5_sqlite:js:select', cbId, table, columns, where, rawWhere);
        })
    },

    insert: (table, columnValues = {}) => {
        emit('u5_sqlite:js:insert', table, columnValues);
    },

    update: (table, columnValues = {}, where, rawWhere) => {
        emit('u5_sqlite:js:update', table, columnValues, where, rawWhere);
    },

    delete: (table, where, rawWhere) => {
        emit('u5_sqlite:js:delete', table, where, rawWhere);
    },

    createTable: (table, columns) => {
        emit('u5_sqlite:js:createTable', table, columns);
    },

    createIndex: (table, columns, unique = false) => {
        const identifier = `idx_${unique ? 'unique_':''}${columns.join('_')}`;

        emit('u5_sqlite:js:executeRaw', `CREATE ${unique ? 'UNIQUE' : ''} INDEX IF NOT EXISTS ${identifier} ON users (${columns.join(', ')});`);
    }
}

export default DB;