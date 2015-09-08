
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

        // Shader Attribute Locations locations:
        this.attributeCoords = null;
        this.attributeTextureCoords = null;

        // Shader Uniform locations
        this.uniformWidth = null;
        this.uniformHeight = null;
        this.uniformColor = null;
        this.uniformTransform = null;
        this.uniformTexture = null;


        // a VBO to hold the texture coordinates
        this.textureCoordsBuffer = null;

        // A texture object to hold the texture image.
        this.textureObject = null;

        // Circle coordinate data
        this.numVerticesPerCircle = 32;
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
            alpha    : true,
            //alpha    : false,
            depth    : false,
            antialias: true,
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

        // Get uniform variables location
        this.uniformWidth = this.gl.getUniformLocation(shaderProg, "u_width");
        this.uniformHeight = this.gl.getUniformLocation(shaderProg, "u_height");
        this.uniformColor = this.gl.getUniformLocation(shaderProg, "u_color");
        this.uniformTransform = this.gl.getUniformLocation(shaderProg, "u_transform");

        // Texture coords attribute location
        this.attributeTextureCoords = this.gl.getAttribLocation(shaderProg, "a_texCoords");
        this.gl.enableVertexAttribArray(this.attributeTextureCoords);

        // Texture uniform variable location
        this.uniformTexture = this.gl.getUniformLocation(shaderProg, "u_texture");

        // Set the value for the uniform width and height variables:
        this.gl.uniform1f(this.uniformWidth, this.canvas.width);
        this.gl.uniform1f(this.uniformHeight, this.canvas.height);
    }

    /**
     * Load all the counters inside the counter array
     * @param counters
     */
    loadTextures(counters) {
        let self = this;
        let deferred = {};
        deferred.promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        let texturePromises = [];
        for (let counter of counters) {
            texturePromises.push(new Promise(function(resolve, reject){
                let img = new Image();  //  A DOM image element to represent the image.
                counter.textureObject = self.gl.createTexture();
                img.onload = function() {
                    // This function will be called after the image loads successfully.
                    // We have to bind the texture object to the TEXTURE_2D target before
                    // loading the image into the texture object.
                    self.gl.bindTexture(self.gl.TEXTURE_2D, counter.textureObject);
                    self.gl.texImage2D(self.gl.TEXTURE_2D, 0 , self.gl.RGBA, self.gl.RGBA, self.gl.UNSIGNED_BYTE, img);
                    self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_S, self.gl.CLAMP_TO_EDGE);
                    self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_WRAP_T, self.gl.CLAMP_TO_EDGE);
                    //self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MIN_FILTER, self.gl.NEAREST);
                    //self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MAG_FILTER, self.gl.NEAREST);

                    self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MIN_FILTER, self.gl.LINEAR_MIPMAP_LINEAR);
                    //self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MIN_FILTER, self.gl.LINEAR_MIPMAP_NEAREST);
                    //self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MAG_FILTER, self.gl.LINEAR);

                    //self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MIN_FILTER, self.gl.LINEAR);
                    //self.gl.texParameteri(self.gl.TEXTURE_2D, self.gl.TEXTURE_MAG_FILTER, self.gl.LINEAR);
                    self.gl.generateMipmap(self.gl.TEXTURE_2D);
                    resolve();
                };
                img.onerror = function(e,f) {
                    console.error("texture unable to load");
                    reject();
                };
                img.src = counter.textureUrl;  // Start loading of the image.
            }));

        }
        Promise.all(texturePromises).
            then(function() {
                deferred.resolve();
            }).
            catch(function() {
                deferred.reject();
            });

        return deferred.promise;

    }

    /**
     * Create the coordinates of a circle approximated as a
     * 32 vertex regular polygon with two coordinates for each vertex
     */
    createCircleBufferData(circleRadius) {
        // Float32Array to hold the coordinates
        this.coords = new Float32Array(this.numVerticesPerCircle * 2);
        this.texCoords = new Float32Array(this.numVerticesPerCircle * 2);

        let k = 0;
        let j = 0;
        for (let i = 0; i < this.numVerticesPerCircle; i++) {
            let angle = i / this.numVerticesPerCircle * 2 * Math.PI;
            this.coords[k++] = circleRadius * Math.cos(angle); // x-coor of vertex
            this.coords[k++] = circleRadius * Math.sin(angle); // y-coord of vertex

            this.texCoords[j++] = (Math.cos(i*2*Math.PI/this.numVerticesPerCircle)+1)/2;
            this.texCoords[j++] = (Math.sin(i*2*Math.PI/this.numVerticesPerCircle)+1)/2;
        }

        this.bufferCoordsCircle = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bufferCoordsCircle);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.coords, this.gl.STATIC_DRAW);

        this.textureCoordsBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordsBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.texCoords, this.gl.STATIC_DRAW);

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

            let circle = circles[rowKey][colKey];

            // Set the u_transform variable
            this.gl.uniformMatrix3fv(this.uniformTransform, false, circle.getMat3());

            // Set u_color variable value:
            this.gl.uniform3fv(this.uniformColor, circle.getColor());

            // Set the coordinates attribute buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.bufferCoordsCircle);
            this.gl.vertexAttribPointer(this.attributeCoords, 2, this.gl.FLOAT, false, 0, 0);

            // Set the texture coordinates buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordsBuffer);
            this.gl.vertexAttribPointer(this.attributeTextureCoords, 2, this.gl.FLOAT, false, 0, 0);

            // Set the texture object to the default texture unit:
            this.gl.bindTexture(this.gl.TEXTURE_2D, circle.getTextureObj());

            // Draw the circle:
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