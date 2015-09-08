"use strict";

import Game from "./game.js";

// Main Entry point which sets up the game
window.onload = function() {
    var scoreUpdateCallback = function(score) {
        document.getElementById("score").innerHTML = score;
    };

    let game = new Game(
        "gameCanvas",
        window.innerWidth,
        window.innerHeight,
        scoreUpdateCallback
    );

    window.GAME = game;

};
