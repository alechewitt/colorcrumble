"use strict";

import colors from "./color-options.js";
import Circle from "./circle.js";

// Shaders:
import vertexShader from "./vertex-shader.vert";
import fragmentShader from "./fragment-shader.frag";

const ACCELERATION = 9.8;

// Pixels per meter
// Increase this will increase the apparent speed the circles fall down with
const SCALE_FACTOR = 800;

// How Much energy is preserved when the circles bounce off each other.
const COEF_RESTITUTION = 0.5;

export default class Game {

    constructor(canvasId, canvasWidth, canvasHeight) {
        this.canvasId = canvasId;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.desiredWidthInCSSPixels = canvasWidth;
        this.desiredHeightInCSSPixels = canvasHeight;

        this.canvas = null;
        this.gl = null;

        // Shader variables locations:
        this.attributeCoords = null;
        this.uniformWidth = null;
        this.uniformHeight = null;
        this.uniformColor = null;
        this.uniformTransform = null;

        // Implementation Variables
        this.numVerticesPerCircle = 32;
        this.bufferCoordsCircle = null;

        // Game Variables
        this.margin = 7 * this.devicePixelRatio;
        this.circlesPerRow = 0;
        this.numRows = 0;
        this.circleRadius = 0.0;
        this.circles = {};

        this.animating = false;
    }

    init() {
        this.initCanvas();
        let shaderProgram = this.createShaderProgram(vertexShader(), fragmentShader());
        this.initGL(shaderProgram);
        this.calculateCirclesRadius();
        this.createCircleBufferData();
        this.createGameGridObj();
        this.drawCircles();
        this.addEventHandlers();
    }

    initCanvas() {
        this.canvas = document.getElementById(this.canvasId);

        // set the display size of the canvas.
        this.canvas.style.width = this.desiredWidthInCSSPixels + "px";
        this.canvas.style.height = this.desiredHeightInCSSPixels + "px";

        // set the size of the drawingBuffer
        this.canvas.width = this.desiredWidthInCSSPixels * this.devicePixelRatio;
        this.canvas.height = this.desiredHeightInCSSPixels * this.devicePixelRatio;

        let options = {
            alpha    : false,
            depth    : false,
            antialias: true
        };

        this.gl = this.canvas.getContext("webgl", options) ||
            this.canvas.getContext("experimental-webgl", options);
    }

    createShaderProgram(vertexShaderSource, fragmentShaderSource) {
        // Compile Vertex Shader:
        let vsh = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(vsh, vertexShaderSource);
        this.gl.compileShader(vsh);
        if (!this.gl.getShaderParameter(vsh, this.gl.COMPILE_STATUS)) {
            throw "Error in vertex shader: " + this.gl.getShaderInfoLog(vsh);
        }

        // Compile Fragment Shader
        let fsh = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(fsh, fragmentShaderSource);
        this.gl.compileShader(fsh);
        if (!this.gl.getShaderParameter(fsh, this.gl.COMPILE_STATUS)) {
            throw "Error in Fragment Shader: " + this.gl.getShaderInfoLog(fsh);
        }

        // Create Program and attach the compiled shaders
        let prog = this.gl.createProgram();
        this.gl.attachShader(prog, vsh);
        this.gl.attachShader(prog, fsh);
        this.gl.linkProgram(prog);
        if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
            throw "LInk error in program: " + this.gl.getProgramInfoLog(prog);
        }
        return prog;
    }

    initGL(shaderProg) {
        this.gl.useProgram(shaderProg);

        this.attributeCoords = this.gl.getAttribLocation(shaderProg, "a_coords");
        this.gl.enableVertexAttribArray(this.attributeCoords);

        // Get uniform letiables location
        this.uniformWidth = this.gl.getUniformLocation(shaderProg, "u_width");
        this.uniformHeight = this.gl.getUniformLocation(shaderProg, "u_height");
        this.uniformColor = this.gl.getUniformLocation(shaderProg, "u_color");
        this.uniformTransform = this.gl.getUniformLocation(shaderProg, "u_transform");

        // Set the value for the uniform width and height letiables:
        this.gl.uniform1f(this.uniformWidth, this.canvas.width);
        this.gl.uniform1f(this.uniformHeight, this.canvas.height);
    }

    /**
     * Calculates the width in pixels of our circular counters
     */
    calculateCirclesRadius() {
        // We want the circles to be about 25 px in diameter on an standard monitor
        // On a high definition monitor, the circles pixel radius is to be larger.
        let circleRadiusAvg = 25 * this.devicePixelRatio;

        // Calculate number circles per row
        let spacePerCircle = (this.canvas.width - this.margin) / ((circleRadiusAvg * 2) + this.margin);
        this.circlesPerRow = Math.floor(spacePerCircle);

        // Calculate circle sizes
        let remainingSpace = this.canvas.width - ((this.circlesPerRow * this.margin) + this.margin);
        this.circleRadius = (remainingSpace / this.circlesPerRow) / 2;

        // Calculate number rows
        let floatNumRows = (this.canvas.height - this.margin) / ((this.circleRadius * 2) + this.margin);
        this.numRows = Math.ceil(floatNumRows);

        console.log("Circle radius: ", this.circleRadius);
    }

    /**
     * Create the coordinates of a circle approximated as a
     * 32 vertex regular polygon with two coordinates for each vertex
     */
    createCircleBufferData() {
        // Float32Array to hold the coordinates
        let coords = new Float32Array(this.numVerticesPerCircle * 2);
        let k = 0;
        for (let i = 0; i < this.numVerticesPerCircle; i++) {
            let angle = i / this.numVerticesPerCircle * 2 * Math.PI;
            coords[k++] = this.circleRadius * Math.cos(angle); // x-coor of vertex
            coords[k++] = this.circleRadius * Math.sin(angle); // y-coord of vertex
        }

        this.bufferCoordsCircle = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bufferCoordsCircle);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, coords, this.gl.STATIC_DRAW);
    }

    /**
     * Create an object with the circles in row then column.
     * eg:
     * {
     *      "row_0": {"col_0": Circle,  "col_1": Circle ... },
     *      "row_1": {"col_0": Circle,  "col_1": Circle ... }
     *      ....
     * }
     */
    createGameGridObj() {
        let offset = this.margin + (this.circleRadius * 2);

        let yTranslation = this.margin + this.circleRadius;
        let xTranslation = this.margin + this.circleRadius;
        for (let i = 0; i < this.numRows; i++) {
            this.circles["row_" + i] = {};
            for (let k = 0; k < this.circlesPerRow; k++) {

                // Random color:
                let colorInt = Math.floor(Math.random() * colors.length);

                // Create a new circle
                let circle = new Circle(colors[colorInt].color);
                circle.name = colors[colorInt].name + "___rowinitial_" + i + "___colinitial_" + k;
                circle.translate(xTranslation, yTranslation);

                // Add it to our array of circles
                this.circles["row_" + i]["col_" + k] = circle;

                // Increment the translation for the next circle:
                xTranslation += offset;
            }

            yTranslation += offset;
            xTranslation = this.margin + this.circleRadius;
        }
    }

    addEventHandlers() {
        this.canvas.addEventListener("mousedown", this.doMouseDown.bind(this), false);
    }

    doMouseDown(event) {
        if (!this.animating) {
            this.animating = true;
            let x = event.clientX * this.devicePixelRatio;
            let y = event.clientY * this.devicePixelRatio;

            // Row number = Floor( (x - margin) / (diameter + margin));
            let col = Math.floor((x - this.margin) / ((2 * this.circleRadius) + this.margin));
            let row = Math.floor((y - this.margin) / (( 2 * this.circleRadius) + this.margin));
            let circle = this.circles["row_" + row]["col_" + col];
            let self = this;
            let topCircleMatrix = this.circles["row_0"]["col_" + col].getMat3();
            let fallingCircles;
            let savedMats;
            let distanceToFall = (2 * self.circleRadius) + self.margin;
            this.animateDisappearance(circle).
                then(function () {
                    [fallingCircles, savedMats] = self.updateCirclesObj(row, col, topCircleMatrix);

                    let distanceToNextBallSurface = (distanceToFall + self.margin) / SCALE_FACTOR;
                    let distanceToRest = distanceToFall / SCALE_FACTOR;
                    let firstTime = new Date().getTime();
                    return self.recursiveDrop(fallingCircles, firstTime, 0, distanceToNextBallSurface, distanceToRest, 1);
                })
                .then(function () {
                    // Finished animating to as near as possible
                    for (let i = 0; i < savedMats.length; i++) {
                        fallingCircles[i].setMat3(savedMats[i]);
                        fallingCircles[i].translate(0, distanceToFall);
                    }
                    self.drawCircles();
                    self.animating = false;
                });
        }
    }


    animateDisappearance(circle, deferred = {}) {
        if (!deferred.hasOwnProperty("resolve")) {
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
        }
        let self = this;
        if (circle.getScaleFactor() <= 0.25) {
            deferred.resolve();
        }
        else {
            circle.scale(0.8);
            this.drawCircles();
            window.requestAnimationFrame(function () {
                self.animateDisappearance(circle, deferred);
            });
        }
        return deferred.promise;
    }

    updateCirclesObj(circleRow, circleCol, topCircleMatrix) {
        let self = this;
        let colKey = "col_" + circleCol;
        let distanceToFall = (2 * this.circleRadius) + this.margin;
        let fallingCircles = [];
        let savedMats = [];
        // Update circles grid object with the circles positions to be.
        for (let row = circleRow; row >= 1; row--) {
            let rowUp = row - 1;
            self.circles["row_" + row][colKey] = self.circles["row_" + rowUp][colKey];
            fallingCircles.push(self.circles["row_" + row][colKey]);
            savedMats.push(self.circles["row_" + row][colKey].getMat3());
        }

        // == Create the new circles ==
        // random color for new circle not same as color underneath
        let newColor;
        while (true) {
            let colorInt = Math.floor(Math.random() * colors.length);
            newColor = colors[colorInt].color;
            if (newColor !== self.circles["row_1"][colKey].getColor()) {
                break;
            }
        }
        // Create a new circle to be added to the object at the top
        let newCircle = new Circle(newColor);
        newCircle.setMat3(topCircleMatrix);
        newCircle.translate(0, -1 * distanceToFall);
        this.circles["row_0"][colKey] = newCircle;
        // Add to the circles to be animated downwards
        fallingCircles.push(newCircle);
        savedMats.push(newCircle.getMat3());

        return [fallingCircles, savedMats];
    }

    /**
     * Method will continually call
     * @param fallingCircles
     * @param initialTime
     * @param initialVelocity
     * @param distanceToSurface
     * @param distanceToFinish
     * @param bouncesLeft
     * @param deferred
     */
    recursiveDrop(fallingCircles, initialTime, initialVelocity, distanceToSurface, distanceToFinish, bouncesLeft, deferred = {}) {
        let self = this;
        // Create a promise if we don't already have one
        if (!deferred.hasOwnProperty("resolve")) {
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
        }
        let timeNow = new Date().getTime();
        let deltaT = (timeNow - initialTime) / 1000;
        // s = ut + 0.5at^2
        let distance = (initialVelocity * deltaT) + (0.5 * ACCELERATION * Math.pow(deltaT, 2));
        let finalVelocity;
        if (distance <= distanceToSurface) {
            distanceToSurface -= distance;
            distanceToFinish -= distance;
            finalVelocity = initialVelocity + (ACCELERATION * deltaT);
            for (let circle of fallingCircles) {
                circle.translate(0, distance * SCALE_FACTOR);
            }
            this.drawCircles();
            let goingDown = distance > 0;
            if (bouncesLeft === 0 && goingDown && distanceToFinish <= 0) {
                // This is now the nearest to where we stop it moving
                window.requestAnimationFrame(deferred.resolve);
            } else {
                window.requestAnimationFrame(function () {
                    self.recursiveDrop(fallingCircles, timeNow, finalVelocity, distanceToSurface, distanceToFinish, bouncesLeft, deferred);
                });
            }

        } else if (bouncesLeft > 0) {
            // This is a bounce
            bouncesLeft -= 1;
            // v^2 = u^2 + 2as
            let velocityBeforeBounce = Math.sqrt(Math.pow(initialVelocity, 2) + (2 * ACCELERATION * distanceToSurface));
            // v = u + at;
            let timeBeforeBounce = (velocityBeforeBounce - initialVelocity) / ACCELERATION;
            // speed after = coeficient of restitution * speed before bounce
            let velocityAfterBounce = -1 * COEF_RESTITUTION * velocityBeforeBounce;
            let timeAfterBounce = deltaT - timeBeforeBounce;
            // s = ut + 0.5at^2
            let distanceAboveBounce = (velocityAfterBounce * timeAfterBounce) + (0.5 * ACCELERATION * Math.pow(timeAfterBounce, 2));
            // v = u + at
            finalVelocity = velocityAfterBounce + (ACCELERATION * timeAfterBounce);

            for (let circle of fallingCircles) {
                // Translate to bottom of bounce
                circle.translate(0, distanceToSurface * SCALE_FACTOR);
                // Then translate up again.
                circle.translate(0, distanceAboveBounce * SCALE_FACTOR);
            }
            let totalDistanceTraveled = distanceAboveBounce + distanceToSurface;
            distanceToFinish = distanceToFinish - totalDistanceTraveled;
            distanceToSurface = distanceToSurface - totalDistanceTraveled;
            this.drawCircles();
            window.requestAnimationFrame(function () {
                self.recursiveDrop(fallingCircles, timeNow, finalVelocity, distanceToSurface, distanceToFinish, bouncesLeft, deferred);
            });
        }
        else {
            // We should never land here:
            // todo: determine if valid reason for landing here.
            window.requestAnimationFrame(deferred.resolve);
        }

        return deferred.promise;


    }


    drawCircles() {
        this.gl.clearColor(1, 1, 1, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);


        for (let i = 0; i < this.numRows; i++) {
            for (let k = 0; k < this.circlesPerRow; k++) {
                let rowKey = "row_" + i;
                let colKey = "col_" + k;
                // Set the u_transform variable
                this.gl.uniformMatrix3fv(this.uniformTransform, false, this.circles[rowKey][colKey].getMat3());

                // Set u_color variable value:
                this.gl.uniform3fv(this.uniformColor, this.circles[rowKey][colKey].getColor());
                // Draw a circle
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bufferCoordsCircle);
                this.gl.vertexAttribPointer(this.attributeCoords, 2, this.gl.FLOAT, false, 0, 0);
                this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, this.numVerticesPerCircle);
            }
        }
    }
}
