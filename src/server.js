addNetEventListener('skyemod:settime', (args) => {
    emitNet('skyemod:settime', -1, args);
});