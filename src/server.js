import {ServerRequest} from "./util/ServerRequest";
import {sleep, throttle} from "./util/util";

addNetEventListener('skyemod:settime', (args) => {
    emitNet('skyemod:settime', -1, args);
});
