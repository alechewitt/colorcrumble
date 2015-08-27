
// Shaders:
import vertexShader from "./vertex-shader.vert";
import fragmentShader from "./fragment-shader.frag";

export default class GraphicsContext {

    constructor(canvasId, desiredWidth, desiredHeight) {
        this.canvasId = canvasId;
        this.desiredWidthInCSSPixels = desiredWidth;
        this.desiredHeightInCSSPixels = desiredHeight;
        this.devicePixelRatio = window.devicePixelRatio || 1;

        this.gl = undefined;
        this.canvas = undefined;

        this.circleKeys = [];

        // Shader variables locations:
        this.attributeCoords = null;
        this.uniformWidth = null;
        this.uniformHeight = null;
        this.uniformColor = null;
        this.uniformTransform = null;

        // Circle coordinate data
        this.numVerticesPerCircle = 64;
        this.bufferCoordsCircle = null;

        this.init_();
    }

    init_() {
        this.checkAntialiasSupoport_();
        this.initCanvas_();
        let shaderProgram = this.createShaderProgram_(vertexShader(), fragmentShader());
        this.initGL_(shaderProgram);
    }

    /**
     * Check for antialias support, if not supported lets double the devicePixelRatio, in order to do it ourselves
     */
    checkAntialiasSupoport_() {
        // First check whether we have antialias support,
        let testCanvas = document.createElement("canvas");
        let testGl = testCanvas.getContext("webgl", {antialias: true}) ||
            testCanvas.getContext("experimental-webgl", {antialias: true});

        let contextAttribs = testGl.getContextAttributes();
        if (!contextAttribs.antialias) {
            // If no antialiasing, lets double the devicePixelRatio
            this.devicePixelRatio *= 2;
        }
    }

    initCanvas_() {
        let options = {
            alpha    : false,
            depth    : false,
            antialias: true
        };

        // == Real canvas
        this.canvas = document.getElementById(this.canvasId);

        // Set the CSS display size of the canvas.
        this.canvas.style.width = this.desiredWidthInCSSPixels + "px";
        this.canvas.style.height = this.desiredHeightInCSSPixels + "px";

        // Set the actual width of the canvas in real pixels
        this.canvas.width = this.desiredWidthInCSSPixels * this.devicePixelRatio;
        this.canvas.height = this.desiredHeightInCSSPixels * this.devicePixelRatio;

        this.gl = this.canvas.getContext("webgl", options) ||
            this.canvas.getContext("experimental-webgl", options);
    }

    createShaderProgram_(vertexShaderSource, fragmentShaderSource) {
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
    initGL_(shaderProg) {
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
     * Create the coordinates of a circle approximated as a
     * 32 vertex regular polygon with two coordinates for each vertex
     */
    createCircleBufferData(circleRadius) {
        // Float32Array to hold the coordinates
        let coords = new Float32Array(this.numVerticesPerCircle * 2);
        let k = 0;
        for (let i = 0; i < this.numVerticesPerCircle; i++) {
            let angle = i / this.numVerticesPerCircle * 2 * Math.PI;
            coords[k++] = circleRadius * Math.cos(angle); // x-coor of vertex
            coords[k++] = circleRadius * Math.sin(angle); // y-coord of vertex
        }

        this.bufferCoordsCircle = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bufferCoordsCircle);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, coords, this.gl.STATIC_DRAW);
    }

    /**
     * Re paint the canvas with values from our circles object
     */
    drawCircles(circles) {
        this.gl.clearColor(1, 1, 1, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        let circleKeysLen = this.circleKeys.length;
        for (let i = 0; i < circleKeysLen; i++) {
            let rowKey = this.circleKeys[i][0];
            let colKey = this.circleKeys[i][1];

            // Set the u_transform variable
            this.gl.uniformMatrix3fv(this.uniformTransform, false, circles[rowKey][colKey].getMat3());

            // Set u_color variable value:
            this.gl.uniform3fv(this.uniformColor, circles[rowKey][colKey].getColor());

            // Draw a circle
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bufferCoordsCircle);
            this.gl.vertexAttribPointer(this.attributeCoords, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, this.numVerticesPerCircle);
        }
    }

    getDevicePixelRatio() {
        return this.devicePixelRatio;
    }

    setCircleKeys(circleKeys) {
        this.circleKeys = circleKeys;
    }

    /**
     * Return the Canvas Width
     * @returns {*}
     */
    getWidth() {
        return this.canvas.width;
    }

    getHeight() {
        return this.canvas.height;
    }
}