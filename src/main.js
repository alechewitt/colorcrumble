"use strict";

import Game from "./game.js";

// Main Entry point which sets up the game
window.onload = function() {
    let game = new Game("gameCanvas", window.innerWidth, window.innerHeight);
    game.init();
};
