"use strict";

import Game from "./game.js";

// Main Entry point which sets up the game
window.onload = function() {
    console.log("window.innerWidth: ", window.innerWidth);
    let game = new Game("gameCanvas", window.innerWidth, window.innerHeight);
    //game.init();

    window.GAME = game;

};
