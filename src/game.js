"use strict";

import counters from "./counters.js";
import GraphicsContext from "./graphics-context.js";
import Circle from "./circle.js";
import InputHandler from "./input-handler.js";


const ACCELERATION = 9.8;

// Pixels per meter
// Increase this will increase the apparent speed the circles fall down with
const SCALE_FACTOR = 500;

// How Much energy is preserved when the circles bounce off each other.
const COEF_RESTITUTION = 0.5;

export default class Game {

    constructor(canvasId, canvasWidth, canvasHeight) {
        this.graphicsCtx = new GraphicsContext(canvasId, canvasWidth, canvasHeight);
        this.devicePixelRatio = this.graphicsCtx.getDevicePixelRatio();

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

        // Initialisation:
        this.calculateCirclesRadius();
        this.graphicsCtx.createCircleBufferData(this.circleRadius);
        let circleKeys = this.createGameGridObj();
        this.graphicsCtx.setCircleKeys(circleKeys);

        //this.graphicsCtx.drawCircles(this.circles);
        let self = this;
        setTimeout(function(){
            self.graphicsCtx.drawCircles(self.circles);
        }, 500);
        //setTimeout(function(){
        //    self.checkForMatches();
        //}, 500);
    }

    /**
     * Calculates the width in pixels of our circular counters
     */
    calculateCirclesRadius() {
        // We want the circles to be about 25 px in diameter on an standard monitor
        // On a high definition monitor, the circles pixel radius is to be larger.
        let circleRadiusAvg = 25 * this.devicePixelRatio;

        // Calculate number circles per row
        let spacePerCircle = (this.graphicsCtx.getWidth() - this.margin) / ((circleRadiusAvg * 2) + this.margin);
        this.circlesPerRow = Math.floor(spacePerCircle);

        // Calculate circle sizes
        let remainingSpace = this.graphicsCtx.getWidth() - ((this.circlesPerRow * this.margin) + this.margin);
        this.circleRadius = (remainingSpace / this.circlesPerRow) / 2;

        // Calculate number rows
        let floatNumRows = (this.graphicsCtx.getHeight() - this.margin) / ((this.circleRadius * 2) + this.margin);
        this.numRows = Math.ceil(floatNumRows);

        console.log("Circle radius: ", this.circleRadius);
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
        let circleKeys = [];
        for (let i = 0; i < this.numRows; i++) {
            let rowKey = "row_" + i;
            this.circles[rowKey] = {};
            for (let k = 0; k < this.circlesPerRow; k++) {
                let colKey = "col_" + k;
                // Random counter:
                let counterInt = Math.floor(Math.random() * counters.length);
                let counter = counters[counterInt];

                // Create a new circle
                let circle = new Circle(counter);
                //circle.name = colors[colorInt].group + "___rowinitial_" + i + "___colinitial_" + k;
                circle.translate(xTranslation, yTranslation);
                circle.rowIndex = i;
                circle.colIndex = k;

                // Add it to our array of circles
                this.circles[rowKey][colKey] = circle;

                // Add this key to our array of stored keys
                circleKeys.push([rowKey, colKey]);

                // Increment the translation for the next circle:
                xTranslation += offset;
            }

            yTranslation += offset;
            xTranslation = this.margin + this.circleRadius;
        }
        return circleKeys;
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
                this.currentCircle.circle.rowIndex = this.swappingCircle.row;
                this.currentCircle.circle.colIndex = this.swappingCircle.col;

                this.swappingCircle.circle.rowIndex = this.currentCircle.row;
                this.swappingCircle.circle.colIndex = this.currentCircle.col;

                this.graphicsCtx.drawCircles(this.circles);
                //this.removeCircles([this.swappingCircle.circle, this.currentCircle.circle]);
                let self = this;
                self.checkForMatches();
            }
            else {
                // Put them back in their original places
                this.swappingCircle.circle.setMat3(this.swappingCircle.initialMat);
                this.currentCircle.circle.setMat3(this.currentCircle.initialMat);
                this.graphicsCtx.drawCircles(this.circles);
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
            this.graphicsCtx.drawCircles(this.circles);
        }
    }

    /**
     * Method checks Whole board for matches, upon finding will animate
     */
    checkForMatches() {
        // Loop through rows
        let self = this;
        let totalMatches = 0;
        this.checkRowsForMatch(0)
            .then(function (rowsTotalMatches) {
                totalMatches += rowsTotalMatches;
                return self.checkColsForMatch(0);
            })
            .then(function (colTotalMatches) {
                totalMatches += colTotalMatches;
                //console.log("TOTAL ROWS + COLS = ", totalMatches);
                if (totalMatches != 0) {
                    // There could be more matches in there
                    self.checkForMatches();
                }
            });

    }

    checkRowsForMatch() {
        let deferred = {};
        deferred.promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        let numberMatches = 0;
        let removeCircles = false;
        let matchedCircles = [];
        for (let row = 0; row < this.numRows; row++) {
            let rowKey = "row_" + row;
            for (let col = 0; col < this.circlesPerRow - 1; col++) {
                let circleOne = this.circles[rowKey]["col_" + col];
                let circleTwo = this.circles[rowKey]["col_" + (col + 1)];
                if (circleOne.getGroup() == circleTwo.getGroup()) {
                    if (numberMatches === 0) {
                        matchedCircles = [circleOne, circleTwo];
                    } else {
                        matchedCircles.push(circleTwo);
                    }
                    // The two circles match
                    numberMatches += 1;
                    if (numberMatches >= 2) {
                        removeCircles = true;
                    }

                } else {
                    // No match, lets see if previous matches have more than 3 circles
                    if (numberMatches >= 2) {
                        // We have enough for a match
                        removeCircles = true;
                        // todo: possibly remove this, then we can erase ultiple on the same row at the same time?
                        break;
                    }
                    else {
                        numberMatches = 0;
                        matchedCircles = [];
                    }
                }
            }
            if (removeCircles) {
                // We have enough
                let self = this;
                this.removeCircles(matchedCircles)
                    .then(function () {
                        // Re check the board for more matches
                        self.checkRowsForMatch()
                            .then(function (childrenTotalMatches) {
                                let matchesSoFar = childrenTotalMatches + 1;
                                deferred.resolve(matchesSoFar);
                            });
                    });
                break
            }
            else{
                numberMatches = 0;
                matchedCircles = [];
            }
        }
        if (!removeCircles) {
            // Whole pass complete with no matches in the rows found
            deferred.resolve(0)
        }
        return deferred.promise;
    }

    checkColsForMatch() {
        let deferred = {};
        deferred.promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        let numberMatches = 0;
        let removingCircles = false;
        let matchedCircles = [];
        for (let colIndex = 0; colIndex < this.circlesPerRow; colIndex++) {
            let colKey = "col_" + colIndex;
            for (let row = 0; row < this.numRows - 1; row++) {
                let circleOne = this.circles["row_" + row][colKey];
                let circleTwo = this.circles["row_" + (row + 1)][colKey];
                if (circleOne.getGroup() == circleTwo.getGroup()) {
                    if (numberMatches === 0) {
                        matchedCircles = [circleOne, circleTwo];
                    } else {
                        matchedCircles.push(circleTwo);
                    }
                    // The two circles match
                    numberMatches += 1;
                }
                else {
                    // No match, lets see if previous matches have more than 3 circles
                    if (numberMatches >= 2) {
                        // We have enough
                        let self = this;
                        this.removeCircles(matchedCircles)
                            .then(function () {
                                // Re check the board for more matches
                                self.checkColsForMatch().
                                    then(function(childrenColsMatches){
                                        let matchesSoFar = childrenColsMatches + 1;
                                        // We have finished this animation and all of its children animations
                                        deferred.resolve(matchesSoFar);
                                    });
                            });
                        removingCircles = true;
                        break
                    }
                    else {
                        numberMatches = 0;
                        matchedCircles = [];
                    }
                }
            }
            if (removingCircles) {
                break;
            }
            else {
                // Reset the number of matches before going on to the next column
                numberMatches = 0;
                matchedCircles = [];
            }
        }
        if (!removingCircles) {
            deferred.resolve(0)
        }
        return deferred.promise;
    }

    removeCircles(circles) {
        let deferred = {};
        deferred.promise = new Promise(function(resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });

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
                self.animating = false;
                deferred.resolve();
            });
        return deferred.promise;
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
            this.graphicsCtx.drawCircles(this.circles);
            window.requestAnimationFrame(function () {
                self.animateDisappearance(circles, deferred);
            });
        }
        return deferred.promise;
    }

    updateCircleObjs(circlesArray) {
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
            let amountToTranslate = -1 * oneCircleFall;
            let topCircleMat;
            if (colObj.topCircleRow === 0){
                topCircleMat = this.circles["row_0"][colKey].getMat3WithoutScaling();
            }
            else {
                topCircleMat = this.circles["row_" + colObj.numberCircles][colKey].getMat3WithoutScaling();
            }

            for (let rowIndex = colObj.numberCircles -1; rowIndex >= 0; rowIndex--) {
                // Get a new random counter
                let counterInt = Math.floor(Math.random() * counters.length);
                let counter = counters[counterInt];

                // Create a new circle to be added to the object at the top
                let newCircle = new Circle(counter);
                newCircle.setMat3(topCircleMat);
                newCircle.translate(0, amountToTranslate);
                newCircle.colIndex = colInt;
                newCircle.rowIndex = rowIndex;
                this.circles["row_" + rowIndex][colKey] = newCircle;
                // Add to the circles to be animated downwards
                column.circles.push(newCircle);
                column.initialMats.push(newCircle.getMat3());

                // Increase the amount to translate
                amountToTranslate -= oneCircleFall;
            }
            fallingCols.push(column);
        }
        return fallingCols;
    }

    /**
     * Method will continually call
     * @param fallingColumns
     * @param deferred
     */
    recursiveDrop(fallingColumns, deferred = {}) {
        // Create a promise if we don't already have one
        if (!deferred.hasOwnProperty("resolve")) {
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
        }

        let allColumnsFinishedAnimating = true;
        for (let column of fallingColumns) {
            if (column.animationFinished) {
                continue;
            }
            let timeNow = new Date().getTime();
            let deltaT = (timeNow - column.initialTime) / 1000;
            column.initialTime = timeNow;
            // s = ut + 0.5at^2
            let distance = (column.initialVelocity * deltaT) + (0.5 * ACCELERATION * Math.pow(deltaT, 2));
            let finalVelocity;
            if (distance <= column.distanceToSurface) {
                column.distanceToSurface -= distance;
                column.distanceToFinish -= distance;
                let goingDown = distance > 0;
                if (column.bouncesLeft === 0 && goingDown && column.distanceToFinish <= 0) {
                    // This is now the nearest to where we stop it moving
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
                allColumnsFinishedAnimating = false;
            }
            else {
                // We should never land here:
                // todo: determine if valid reason for landing here.
                for (let i = 0; i <column.circles.length; i++) {
                    column.circles[i].setMat3(column.initialMats[i]);
                    column.circles[i].translate(0, column.overallDistanceToFall);
                }
            }
        }
        this.graphicsCtx.drawCircles(this.circles);

        if (allColumnsFinishedAnimating) {
            // All columns have finished animating. Lets resolve the promise
            deferred.resolve();
        }
        else {
            let self = this;
            window.requestAnimationFrame(function(){
                self.recursiveDrop(fallingColumns, deferred);
            });
        }
        return deferred.promise;
    }
}
