"use strict";

export default class InputHandler {

    constructor(startCb, movementCb, endCb, devicePixelRatio) {
        this.devicePixelRatio = devicePixelRatio;

        this.movementStartCb = startCb;
        this.movementMoveCb = movementCb;
        this.movementEndCb = endCb;

        this.init();
    }


    init() {
        document.addEventListener("touchstart", this.touchStartListener.bind(this), false);
        document.addEventListener("mousedown", this.mouseDownListener.bind(this), false);

        document.addEventListener("mousemove", this.mouseMoveListener.bind(this), false);
        document.addEventListener("touchmove", this.touchMoveListener.bind(this), false);

        document.addEventListener("mouseup", this.mouseUpListener.bind(this), false);
        document.addEventListener("touchend", this.touchEndListener.bind(this), false);
    }

    touchStartListener(event) {
        // Prevent devices calling click start, and any other event that a touch may trigger
        event.preventDefault();

        let x = event.touches[0].clientX * this.devicePixelRatio;
        let y = event.touches[0].clientY * this.devicePixelRatio;
        this.movementStartCb(x, y);
    }

    mouseDownListener(event) {
        event.preventDefault();
        let x = event.clientX * this.devicePixelRatio;
        let y = event.clientY * this.devicePixelRatio;
        this.movementStartCb(x, y);
    }

    touchMoveListener(event) {
        // Prevent devices calling click start, and any other event that a touch may trigger
        event.preventDefault();

        let x = event.touches[0].clientX * this.devicePixelRatio;
        let y = event.touches[0].clientY * this.devicePixelRatio;
        this.movementMoveCb(x, y);

    }

    mouseMoveListener(event) {
        event.preventDefault();

        let x = event.clientX * this.devicePixelRatio;
        let y = event.clientY * this.devicePixelRatio;
        this.movementMoveCb(x, y);
    }

    touchEndListener(event) {
        // Prevent devices calling click start, and any other event that a touch may trigger
        event.preventDefault();
        console.log("Logging End Event: ", event);
        let x = event.changedTouches[0].clientX * this.devicePixelRatio;
        let y = event.changedTouches[0].clientY * this.devicePixelRatio;

        this.movementEndCb(x, y);
    }

    mouseUpListener(event) {
        event.preventDefault();
        let x = event.clientX * this.devicePixelRatio;
        let y = event.clientY * this.devicePixelRatio;

        this.movementEndCb(x, y);
    }
}