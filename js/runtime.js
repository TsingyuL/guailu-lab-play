// Canonical game composition. Browser preview, WeChat, simulations and
// integration tests import this file so prototype patches cannot silently
// diverge by entry point or require order.
const {Game}=require('./game');
require('./ui-theme');
require('./driving-skills');
require('./ui-skills');
require('./ui-light');
require('./ui-reference');
require('./monsters');

const createRuntimeGame=platform=>new Game(platform);
module.exports={Game,createRuntimeGame};
