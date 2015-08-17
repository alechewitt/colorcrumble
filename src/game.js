"use strict";

import colors from "./color-options.js";
import Circle from "./circle.js";

// Shaders:
import vertexShader from "./vertex-shader.vert";
import fragmentShader from "./fragment-shader.frag";

const erasedCircle = {
    erased: true,
    isErased: function() {
        return true
    }
};
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
        this.margin = 5 * this.devicePixelRatio;
        this.circlesPerRow = 0;
        this.numRows = 20;
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

        this.gl = this.canvas.getContext("webgl", options);
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
     * Create an array of arrays of circle's. Each sub array is a row of circles.
     * eg:
     * [
     *      [Circle, Circle... ],
     *      [Circle, Circle... ],
     *      ....
     * ]
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

    doMouseDown() {
        if (!this.animating) {
            this.animating = true;
            let x = event.clientX * this.devicePixelRatio;
            let y = event.clientY * this.devicePixelRatio;
            console.log("X: ", x);
            console.log("Y: ", y);
            // Row number = Floor( (x - margin) / (diameter + margin));
            let col = Math.floor((x - this.margin) / ((2 * this.circleRadius) + this.margin));
            let row = Math.floor((y-this.margin) / (( 2 * this.circleRadius) + this.margin));
            this.animateDisappearance(this.circles["row_" + row]["col_" + col], row, col);
        }

    }

    animateDisappearance(circle, circleRow, circleCol) {
        console.log("animating disppearance circleRow: ", circleRow);
        let self = this;
        if (circle.getScaleFactor() <= 0.1) {
            circle.erased = true;
            // Make all circles above fall down
            self.animateCirclesFalling(circleRow, circleCol);
        }
        else {
            circle.scale(0.8);
            window.requestAnimationFrame(function () {
                self.animateDisappearance(circle, circleRow, circleCol);
            });
        }
        this.drawCircles();
    }

    animateCirclesFalling(circleRow, circleCol) {
        let self = this;
        let totalFall = 0;
        let distanceToFall = (2 * this.circleRadius) + this.margin;
        let colKey = "col_" + circleCol;
        console.log("Distance to fall: ", distanceToFall);
        function fall() {
            console.log("Falling circleRow: ", circleRow);
            totalFall += 3;
            // For every row above our circle that has dissappeared:
            for (let row = 0; row < circleRow; row++) {
                if (! self.circles["row_" + row][colKey].erased) {
                    // Translate one pixel down:
                    self.circles["row_" + row][colKey].translate(0, 3);
                }
            }
            self.drawCircles();
            if (totalFall <= distanceToFall) {
                window.requestAnimationFrame(fall);
            }
            else {
                // We have finished animating Lets update the gridObj with the circles in their new correct places
                let lowestDeleted = 0;
                for (let row = circleRow; row >=1; row--) {
                    let rowUp = row - 1;
                    if (!self.circles["row_"+rowUp][colKey].erased) {
                        // Row above is not erased, so lets copy it down;
                        self.circles["row_" + row][colKey] = self.circles["row_"+rowUp][colKey];
                    }
                    else {
                        // Row above is erased so no more copying needed
                        lowestDeleted = row;
                        break;
                    }
                }

                console.log("Logging lowest deleted: ", lowestDeleted);
                for (let erasedRow = 0; erasedRow <=lowestDeleted; erasedRow ++) {
                    console.log("Erasing row: ", erasedRow);
                    console.log("Logging tobe erased row: ", self.circles["row_" + erasedRow]);

                    self.circles["row_" + erasedRow][colKey] = erasedCircle;
                }

                console.log("Logging final circles: ", self.circles);
                self.animating = false;
            }
        }
        fall();
    }


    drawCircles() {
        this.gl.clearColor(1, 1, 1, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);


        for (let i = 0; i < this.numRows; i++) {
            for (let k = 0; k < this.circlesPerRow; k++) {
                let rowKey = "row_" + i;
                let colKey = "col_" + k;
                if (this.circles[rowKey][colKey].isErased()) {
                    // This circle has been erased. Lets not draw it and continue to next one.
                    continue;
                }
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
