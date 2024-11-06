const callbacks = {};

export async function ClientRequest(event, ...args) {
    if (!callbacks.hasOwnProperty(event)) {
        onNet(event, (...args) => {
            if (callbacks.hasOwnProperty(event) && callbacks[event] !== null) {
                callbacks[event](args);
                callbacks[event] = null;
            }
        });
    }

    return new Promise((resolve,reject) => {
        callbacks[event] = (args) => {
            resolve(args);
        };

        emitNet(event,args);
    });
}
