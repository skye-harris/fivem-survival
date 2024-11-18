export async function ClientRequest(event, ...args) {
    return new Promise((resolve,reject) => {
        const callback = (...args) => {
            removeEventListener(event, callback);
            resolve(...args);
        };

        addNetEventListener(event, callback);
        emitNet(event,...args);
    });
}
