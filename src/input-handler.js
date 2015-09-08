"use strict";

export default class InputHandler {

    constructor(startCb, movementCb, endCb, devicePixelRatio, canvas) {
        this.devicePixelRatio = devicePixelRatio;
        this.canvas = canvas;

        this.movementStartCb = startCb;
        this.movementMoveCb = movementCb;
        this.movementEndCb = endCb;

        // Calculate the top of the canvas
        let canvasRect = canvas.getBoundingClientRect();
        this.marginTop = canvasRect.top;

        this.init();
    }


    init() {
        this.canvas.addEventListener("touchstart", this.touchStartListener.bind(this), false);
        this.canvas.addEventListener("mousedown", this.mouseDownListener.bind(this), false);

        this.canvas.addEventListener("mousemove", this.mouseMoveListener.bind(this), false);
        this.canvas.addEventListener("touchmove", this.touchMoveListener.bind(this), false);

        this.canvas.addEventListener("mouseup", this.mouseUpListener.bind(this), false);
        this.canvas.addEventListener("touchend", this.touchEndListener.bind(this), false);
        this.canvas.addEventListener("touchleave", this.touchEndListener.bind(this), false);
        this.canvas.addEventListener("touchcancel", this.touchEndListener.bind(this), false);
    }

    setDevicePixelRatio(devicePixelRatio) {
        this.devicePixelRatio = devicePixelRatio;
    }

    touchStartListener(event) {
        // Prevent devices calling click start, and any other event that a touch may trigger
        event.preventDefault();

        let x = event.touches[0].clientX * this.devicePixelRatio;
        let y = (event.touches[0].clientY - this.marginTop) * this.devicePixelRatio;
        this.movementStartCb(x, y);
    }

    mouseDownListener(event) {
        event.preventDefault();
        let x = event.clientX * this.devicePixelRatio;
        let y = (event.clientY - this.marginTop) * this.devicePixelRatio;
        this.movementStartCb(x, y);
    }

    touchMoveListener(event) {
        // Prevent devices calling click start, and any other event that a touch may trigger
        event.preventDefault();

        let x = event.touches[0].clientX * this.devicePixelRatio;
        let y = (event.touches[0].clientY - this.marginTop) * this.devicePixelRatio;
        this.movementMoveCb(x, y);

    }

    mouseMoveListener(event) {
        event.preventDefault();

        let x = event.clientX * this.devicePixelRatio;
        let y = (event.clientY - this.marginTop) * this.devicePixelRatio;
        this.movementMoveCb(x, y);
    }

    touchEndListener(event) {
        // Prevent devices calling click start, and any other event that a touch may trigger
        event.preventDefault();
        console.log("Logging End Event: ", event);
        let x = event.changedTouches[0].clientX * this.devicePixelRatio;
        let y = (event.changedTouches[0].clientY - this.marginTop) * this.devicePixelRatio;

        this.movementEndCb(x, y);
    }

    mouseUpListener(event) {
        event.preventDefault();
        let x = event.clientX * this.devicePixelRatio;
        let y = (event.clientY - this.marginTop) * this.devicePixelRatio;

        this.movementEndCb(x, y);
    }
}