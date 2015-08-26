"use strict";

import colors from "./color-options.js";
import Circle from "./circle.js";
import InputHandler from "./input-handler.js";

// Shaders:
import vertexShader from "./vertex-shader.vert";
import fragmentShader from "./fragment-shader.frag";

const ACCELERATION = 9.8;

// Pixels per meter
// Increase this will increase the apparent speed the circles fall down with
const SCALE_FACTOR = 500;

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
        this.circleKeys = [];

        // Shader variables locations:
        this.attributeCoords = null;
        this.uniformWidth = null;
        this.uniformHeight = null;
        this.uniformColor = null;
        this.uniformTransform = null;

        // Implementation Variables
        this.numVerticesPerCircle = 64;
        this.bufferCoordsCircle = null;

        // Game Variables
        this.margin = 7 * this.devicePixelRatio;
        this.circlesPerRow = 0;
        this.numRows = 0;
        this.circleRadius = 0.0;
        this.circles = {};

        this.moveAnimationIndex = 0;

        // Input Handler:
        this.inputHandler = new InputHandler(
            this.movementStart.bind(this),
            this.movementMove.bind(this),
            this.movementFinish.bind(this),
            this.devicePixelRatio
        );

        // In Game Variables
        this.animating = false;
        this.currentCircle = {
            circle: false,
            row   : false,
            col   : false,
            startX: false,
            startY: false
        };
        this.swappingCircle = {
            circle    : false,
            initialMat: false,
            row       : false,
            col       : false
        };
        this.currentMoveAnimationFrame = false;
    }

    init() {
        this.initCanvas();
        let shaderProgram = this.createShaderProgram(vertexShader(), fragmentShader());
        this.initGL(shaderProgram);
        this.calculateCirclesRadius();
        this.createCircleBufferData();
        this.createGameGridObj();
        this.drawCircles();
    }

    initCanvas() {
        let options = {
            alpha    : false,
            depth    : false,
            antialias: true
        };

        // == test for antialias support
        let testCanvas = document.createElement("canvas");
        let testGl = testCanvas.getContext("webgl", options) ||
            testCanvas.getContext("experimental-webgl", options);

        let contextAttribs = testGl.getContextAttributes();
        if (!contextAttribs.antialias) {
            // If no antialiasing, lets double the devicePixelRatio
            this.devicePixelRatio *= 2;
            this.inputHandler.setDevicePixelRatio(this.devicePixelRatio);
        }
        testCanvas = null;


        // Real canvas
        this.canvas = document.getElementById(this.canvasId);

        // set the display size of the canvas.
        this.canvas.style.width = this.desiredWidthInCSSPixels + "px";
        this.canvas.style.height = this.desiredHeightInCSSPixels + "px";

        this.canvas.width = this.desiredWidthInCSSPixels * this.devicePixelRatio;
        this.canvas.height = this.desiredHeightInCSSPixels * this.devicePixelRatio;

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

    /**
     * Get location of all the variables inside the shaders.
     * Then set the value of the uniform variables u_width and u_height - These are the same for all
     * the primitives we are going to draw.
     * @param shaderProg
     */
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
            let rowKey = "row_" + i;
            this.circles[rowKey] = {};
            for (let k = 0; k < this.circlesPerRow; k++) {
                let colKey = "col_" + k;
                // Random color:
                let colorInt = Math.floor(Math.random() * colors.length);

                // Create a new circle
                let circle = new Circle(colors[colorInt].color);
                circle.name = colors[colorInt].name + "___rowinitial_" + i + "___colinitial_" + k;
                circle.translate(xTranslation, yTranslation);
                circle.rowIndex = i;
                circle.colIndex = k;

                // Add it to our array of circles
                this.circles[rowKey][colKey] = circle;

                // Add this key to our array of stored keys
                this.circleKeys.push([rowKey, colKey]);

                // Increment the translation for the next circle:
                xTranslation += offset;
            }

            yTranslation += offset;
            xTranslation = this.margin + this.circleRadius;
        }
    }

    movementStart(x, y) {
        if (!this.animating) {
            // Row number = Floor( (y - margin) / (diameter + margin));
            let col = Math.floor((x - this.margin) / ((2 * this.circleRadius) + this.margin));
            this.currentCircle.col = col;
            let row = Math.floor((y - this.margin) / (( 2 * this.circleRadius) + this.margin));
            this.currentCircle.row = Math.floor((y - this.margin) / (( 2 * this.circleRadius) + this.margin));

            // Get the the circle that has been clicked:
            this.currentCircle.circle = this.circles["row_" + row]["col_" + col];
            this.currentCircle.startX = x;
            this.currentCircle.startY = y;
            this.currentCircle.initialMat = this.currentCircle.circle.getMat3();
            this.currentCircle.currentX = x;
            this.currentCircle.currentY = y;
            this.circleMoving = true;
            this.moveAnimationIndex = window.requestAnimationFrame(this.moveCircle.bind(this));
        }

    }

    movementMove(x, y) {
        if (!this.animating && this.circleMoving) {
            this.currentCircle.currentX = x;
            this.currentCircle.currentY = y;
        }

    }

    movementFinish(x, y) {
        if (!this.animating && this.circleMoving) {
            // Stop move method recursively calling itself;
            this.circleMoving = false;
            // Cancel any move animation that is currently in progress
            window.cancelAnimationFrame(this.moveAnimationIndex);

            // Maximum distance to move
            let maxDistanceToMove = (2 * this.circleRadius) + this.margin;
            let minDistanceToMove = maxDistanceToMove / 2;
            // Update New position in array
            let xDragged = x - this.currentCircle.startX;
            let yDragged = y - this.currentCircle.startY;
            if (Math.abs(xDragged) > minDistanceToMove || Math.abs(yDragged) > minDistanceToMove) {
                // Counter has been moved far enough to register a swap
                this.swappingCircle.circle.setMat3(this.currentCircle.initialMat);
                this.currentCircle.circle.setMat3(this.swappingCircle.initialMat);
                // Swap them in the circles object
                this.circles["row_" + this.currentCircle.row]["col_" + this.currentCircle.col] = this.swappingCircle.circle;
                this.circles["row_" + this.swappingCircle.row]["col_" + this.swappingCircle.col] = this.currentCircle.circle;
                let randomCircle;
                if (this.swappingCircle.row == this.currentCircle.row) {
                    randomCircle = this.circles["row_" + (this.swappingCircle.row + 1)]["col_" + this.swappingCircle.col];
                } else {
                    // columns are the same
                    randomCircle = this.circles["row_" + this.swappingCircle.row]["col_" + (this.swappingCircle.col + 1)];
                }
                this.drawCircles();
                //this.removeCircle(this.currentCircle.circle, this.swappingCircle.row, this.swappingCircle.col);
                //this.removeCircles([this.swappingCircle.circle, this.currentCircle.circle, randomCircle]);
                this.removeCircles([this.swappingCircle.circle, this.currentCircle.circle]);
            }
            else {
                // Put them back in their original places
                this.swappingCircle.circle.setMat3(this.swappingCircle.initialMat);
                this.currentCircle.circle.setMat3(this.currentCircle.initialMat);
                this.drawCircles();
            }
            // Reset current and swapping circles
            this.currentCircle = {
                circle: false,
                row   : false,
                col   : false,
                startX: false,
                startY: false
            };
            this.swappingCircle = {
                circle    : false,
                initialMat: false,
                row       : false,
                col       : false
            };
        }

    }

    moveCircle() {
        if (this.circleMoving) {
            this.moveAnimationIndex = window.requestAnimationFrame(this.moveCircle.bind(this));
        }

        let maxDistanceToMove = (2 * this.circleRadius) + this.margin;

        let xMovement = this.currentCircle.currentX - this.currentCircle.startX;
        let yMovement = this.currentCircle.currentY - this.currentCircle.startY;
        let swappingCircleCol;
        let swappingCircleRow;
        let xMovementSwappingCircle;
        let yMovementSwappingCircle;
        // Determine if this is a Vertical or Horizontal movement
        if (Math.abs(xMovement) >= Math.abs(yMovement)) {
            yMovement = 0;
            yMovementSwappingCircle = 0;
            xMovementSwappingCircle = xMovement * -1;
            swappingCircleRow = this.currentCircle.row;
            // Horizontal Movement;
            if (xMovement > 0) {
                //Movement to the right
                swappingCircleCol = this.currentCircle.col + 1;
                if (Math.abs(xMovement) > maxDistanceToMove) {
                    xMovementSwappingCircle = -1 * maxDistanceToMove;
                    xMovement = maxDistanceToMove;
                }
            }
            else {
                swappingCircleCol = this.currentCircle.col - 1;
                if (Math.abs(xMovement) > maxDistanceToMove) {
                    xMovementSwappingCircle = maxDistanceToMove;
                    xMovement = -1 * maxDistanceToMove;
                }
            }
        } else {
            // Vertical Movement
            xMovement = 0;
            xMovementSwappingCircle = 0;
            yMovementSwappingCircle = yMovement * -1;
            swappingCircleCol = this.currentCircle.col;
            if (yMovement > 0) {
                // We are moving the circle down
                swappingCircleRow = this.currentCircle.row + 1;
                if (Math.abs(yMovement) > maxDistanceToMove) {
                    yMovementSwappingCircle = -1 * maxDistanceToMove;
                    yMovement = maxDistanceToMove;
                }
            }
            else {
                swappingCircleRow = this.currentCircle.row - 1;
                if (Math.abs(yMovement) > maxDistanceToMove) {
                    yMovementSwappingCircle = maxDistanceToMove;
                    yMovement = -1 * maxDistanceToMove;
                }
            }
        }
        let swappingCircleRowKey = "row_" + swappingCircleRow;
        let swappingCircleColKey = "col_" + swappingCircleCol;
        if (this.circles.hasOwnProperty(swappingCircleRowKey) && this.circles[swappingCircleRowKey].hasOwnProperty(swappingCircleColKey)) {
            // There is a circle to swap with!
            // Update the moving circle
            this.currentCircle.circle.setMat3(this.currentCircle.initialMat);
            this.currentCircle.circle.translate(xMovement, yMovement);

            let swappingCircle = this.circles["row_" + swappingCircleRow]["col_" + swappingCircleCol];
            if (swappingCircle === this.swappingCircle.circle) {
                // Already moved a bit.Reset the Matrix
                swappingCircle.setMat3(this.swappingCircle.initialMat);
            } else {
                if (this.swappingCircle.circle) {
                    // There is already one here that we need to place back into it's original place
                    this.swappingCircle.circle.setMat3(this.swappingCircle.initialMat);
                }
                // First time
                this.swappingCircle.circle = swappingCircle;
                this.swappingCircle.initialMat = swappingCircle.getMat3();
                this.swappingCircle.row = swappingCircleRow;
                this.swappingCircle.col = swappingCircleCol;
            }

            swappingCircle.translate(xMovementSwappingCircle, yMovementSwappingCircle);
            this.drawCircles();
        }

    }

    removeCircles(circles) {
        this.animating = true;
        let self = this;
        //let topCircleMatrix = this.circles["row_0"]["col_" + col].getMat3();
        let fallingCircles;
        let distanceToFall = (2 * self.circleRadius) + self.margin;
        this.animateDisappearance(circles).
            then(function () {
                fallingCircles = self.updateCircleObjs(circles);
                //return self.recursiveDrop(fallingCircles, firstTime, 0, distanceToNextBallSurface, distanceToRest, 1);
                return self.recursiveDrop(fallingCircles);
            })
            .then(function () {
                console.log("All Columns are in their correct position");
                self.animating = false;
            });
        //}
    }


    /**
     * Shrink a circle and then paint. Method will continue call itself
     * until the circle is 25% of its original size
     * @param {<Circle>} circles
     * @param deferred
     * @returns {Promise}
     */
    animateDisappearance(circles, deferred = {}) {
        if (!deferred.hasOwnProperty("resolve")) {
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
        }
        let self = this;
        if (circles[0].getScaleFactor() <= 0.25) {
            deferred.resolve();
        }
        else {
            for (let circle of circles) {
                circle.scale(0.8);
            }
            this.drawCircles();
            window.requestAnimationFrame(function () {
                self.animateDisappearance(circles, deferred);
            });
        }
        return deferred.promise;
    }

    updateCircleObjs(circlesArray) {
        console.log("Updating circles object");
        /**
         * Map of objects containing
         * key: colIndex
         * value:
         * {
         *     numberCircles:    int
         *     topCircleRow:  int (The highes circle in this column that is being erased, this will be the lowest number)
         * }
         *
         */
        let colsAnimating = new Map();
        for (let circle of circlesArray) {
            if (colsAnimating.has(circle.colIndex)){
                // We already have a circle in this column
                let colInfo = colsAnimating.get(circle.colIndex);
                colInfo.numberCircles += 1;
                if (colInfo.topCircleRow > circle.rowIndex) {
                    colInfo.topCircleRow = circle.rowIndex;
                }
            }
            else {
                // No circle in this column yet lets create one
                let newColInfo = {
                    numberCircles:   1,
                    topCircleRow: circle.rowIndex
                };
                colsAnimating.set(circle.colIndex, newColInfo);
            }
        }
        // Each element in this array represents a column of circles to fall
        let fallingCols = [];
        //let initialMats = [];
        let oneCircleFall = (2 * this.circleRadius) + this.margin;
        // Now have Map of the columns
        for (let [colInt, colObj] of colsAnimating) {
            let overallDistanceToFall = oneCircleFall * colObj.numberCircles;
            //let overallDistanceToFall = oneCircleFall;
            console.log("[t] Logging overall distance to Fall: ", overallDistanceToFall);
            console.log("[t] margin: ", this.margin);
            console.log("[t] radius: ", this.circleRadius);
            console.log("distanceToFinish: ", (overallDistanceToFall / SCALE_FACTOR));
            console.log("distanceToSurface: ", ((overallDistanceToFall + this.margin) / SCALE_FACTOR));
            let column = {
                circles              : [],
                initialMats          : [],
                distanceToSurface    : (overallDistanceToFall + this.margin) / SCALE_FACTOR,
                distanceToFinish     : overallDistanceToFall / SCALE_FACTOR,
                overallDistanceToFall: overallDistanceToFall,
                bouncesLeft          : 1,
                initialVelocity      : 0,
                animationFinished    : false,
                initialTime          : new Date().getTime()
            };

            let colKey = "col_" + colInt;
            let lowestFallingCircleInt = colObj.topCircleRow - 1;
            // Update the circle object
            for (let row = lowestFallingCircleInt; row >= 0; row--) {
                let rowBelowIndex = row + colObj.numberCircles;
                let rowBelowKey = "row_" + rowBelowIndex;
                this.circles[rowBelowKey][colKey] = this.circles["row_" + row][colKey];
                this.circles[rowBelowKey][colKey].rowIndex = rowBelowIndex;
                column.circles.push(this.circles[rowBelowKey][colKey]);
                column.initialMats.push(this.circles[rowBelowKey][colKey].getMat3());
            }

            // Create the new circles for this row
            console.log("Creating new circles-- ");
            let amountToTranslate = -1 * oneCircleFall;
            let topCircleMat;
            if (colObj.topCircleRow === 0){
                topCircleMat = this.circles["row_0"][colKey].getMat3WithoutScaling();
            }
            else {
                topCircleMat = this.circles["row_" + colObj.numberCircles][colKey].getMat3WithoutScaling();
            }

            for (let rowIndex = colObj.numberCircles -1; rowIndex >= 0; rowIndex--) {
                console.log("Row index: ", rowIndex);
                // Get a new random color
                let colorInt = Math.floor(Math.random() * colors.length);
                let newColor = colors[colorInt].color;

                // Create a new circle to be added to the object at the top
                let newCircle = new Circle(newColor);
                newCircle.setMat3(topCircleMat);
                newCircle.translate(0, amountToTranslate);
                newCircle.colIndex = colInt;
                newCircle.rowIndex = rowIndex;
                this.circles["row_" + rowIndex][colKey] = newCircle;
                console.log("-- NEW CIRCLE --");
                console.log(newCircle);
                // Add to the circles to be animated downwards
                column.circles.push(newCircle);
                column.initialMats.push(newCircle.getMat3());

                // Increase the amount to translate
                amountToTranslate -= oneCircleFall;
            }
            fallingCols.push(column);
        }
        console.log("Before return Falling Circles: ", fallingCols);
        return fallingCols;
    }

    /**
     * Method will continually call
     * @param fallingColumns
     * @param deferred
     */
    recursiveDrop(fallingColumns, deferred = {}) {
        // Create a promise if we don't already have one
        console.log("Logging deferred: ", deferred);
        if (!deferred.hasOwnProperty("resolve")) {
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
        }

        let allColumnsFinishedAnimating = true;
        console.log("Logging all fallingColumns: ", fallingColumns);
        for (let column of fallingColumns) {
            if (column.animationFinished) {
                continue;
            }
            let timeNow = new Date().getTime();
            let deltaT = (timeNow - column.initialTime) / 1000;
            column.initialTime = timeNow;
            console.log("Distance calculated initialVelocity: ", column.initialVelocity);
            // s = ut + 0.5at^2
            let distance = (column.initialVelocity * deltaT) + (0.5 * ACCELERATION * Math.pow(deltaT, 2));
            let finalVelocity;
            console.log("Distance to travel: ", distance);
            console.log("Distance to surface: ", column.distanceToSurface);
            if (distance <= column.distanceToSurface) {
                column.distanceToSurface -= distance;
                column.distanceToFinish -= distance;
                let goingDown = distance > 0;
                if (column.bouncesLeft === 0 && goingDown && column.distanceToFinish <= 0) {
                    // This is now the nearest to where we stop it moving
                    console.log("-STOPPING-");
                    for (let i = 0; i <column.circles.length; i++) {
                        column.circles[i].setMat3(column.initialMats[i]);
                        column.circles[i].translate(0, column.overallDistanceToFall);
                    }
                } else {
                    finalVelocity = column.initialVelocity + (ACCELERATION * deltaT);
                    for (let circle of column.circles) {
                        circle.translate(0, distance * SCALE_FACTOR);
                    }
                    column.initialVelocity = finalVelocity;
                    allColumnsFinishedAnimating = false;
                }

            } else if (column.bouncesLeft > 0) {
                console.log("We are bouncing!");
                // This is a bounce
                column.bouncesLeft -= 1;
                // v^2 = u^2 + 2as
                let velocityBeforeBounce = Math.sqrt(Math.pow(column.initialVelocity, 2) + (2 * ACCELERATION * column.distanceToSurface));
                // v = u + at;
                let timeBeforeBounce = (velocityBeforeBounce - column.initialVelocity) / ACCELERATION;
                // speed after = coeficient of restitution * speed before bounce
                let velocityAfterBounce = -1 * COEF_RESTITUTION * velocityBeforeBounce;
                let timeAfterBounce = deltaT - timeBeforeBounce;
                // s = ut + 0.5at^2
                let distanceAboveBounce = (velocityAfterBounce * timeAfterBounce) + (0.5 * ACCELERATION * Math.pow(timeAfterBounce, 2));
                // v = u + at
                finalVelocity = velocityAfterBounce + (ACCELERATION * timeAfterBounce);

                for (let circle of column.circles) {
                    // Translate to bottom of bounce
                    circle.translate(0, column.distanceToSurface * SCALE_FACTOR);
                    // Then translate up again.
                    circle.translate(0, distanceAboveBounce * SCALE_FACTOR);
                }
                let totalDistanceTraveled = distanceAboveBounce + column.distanceToSurface;
                column.distanceToFinish = column.distanceToFinish - totalDistanceTraveled;
                column.distanceToSurface = column.distanceToSurface - totalDistanceTraveled;
                column.initialVelocity = finalVelocity;
                console.log("Logging new initial velocity: ", column.initialVelocity);
                allColumnsFinishedAnimating = false;
            }
            else {
                // We should never land here:
                // todo: determine if valid reason for landing here.
                console.log("Landed in a bad place!!");
                console.log("-STOPPING IN A BAD PLACE-");
                for (let i = 0; i <column.circles.length; i++) {
                    column.circles[i].setMat3(column.initialMats[i]);
                    column.circles[i].translate(0, column.overallDistanceToFall);
                }
            }
        }
        this.drawCircles();

        console.log("Finished?: ", allColumnsFinishedAnimating);
        if (allColumnsFinishedAnimating) {
            // All columns have finished animating. Lets resolve the promise
            deferred.resolve();
        }
        else {
            let self = this;
            console.log("Recursively calling Drop!");
            window.requestAnimationFrame(function(){
                self.recursiveDrop(fallingColumns, deferred);
            });
        }
        return deferred.promise;
    }

    /**
     * Re paint the canvas with values from our circles object
     */
    drawCircles() {
        this.gl.clearColor(1, 1, 1, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        let circleKeysLen = this.circleKeys.length;
        for (let i = 0; i < circleKeysLen; i++) {
            let rowKey = this.circleKeys[i][0];
            let colKey = this.circleKeys[i][1];

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
