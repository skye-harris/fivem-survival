export async function ServerRequest(event, target, ...args) {
    return new Promise((resolve,reject) => {
        const callback = (...args) => {
            removeEventListener(event, callback);
            resolve(args);
        };

        addEventListener(event, callback);
        emitNet(event,target,args);
    });
}
