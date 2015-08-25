"use strict";

export default class Circle {

    constructor(color) {
        /**
         * Represents a 2d transformation matrix in column major orientation:
         *
         *   a  b  0
         *   c  d  0
         *   e  f  1
         *
         * This represents a transformation of the coordinates (x, y) to
         * ( a*x + c*y + e, b*x + d*y + e )
         */
        this.transMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: 0,
            f: 0
        };

        this.color = color;
        this.name = "";
        this.rowIndex = 0;
        this.colIndex = 0;
    }

    getMat3() {
        return [
            this.transMatrix.a, this.transMatrix.b, 0,
            this.transMatrix.c, this.transMatrix.d, 0,
            this.transMatrix.e, this.transMatrix.f, 0
        ];
    }

    getMat3WithoutScaling() {
        return [
            1, 0, 0,
            0, 1, 0,
            this.transMatrix.e, this.transMatrix.f, 0
        ];
    }

    // An array in the same format that getMat3 returns
    setMat3(matrix) {
        this.transMatrix.a = matrix[0];
        this.transMatrix.b = matrix[1];
        this.transMatrix.c = matrix[3];
        this.transMatrix.d = matrix[4];
        this.transMatrix.e = matrix[6];
        this.transMatrix.f = matrix[7];
    }

    getColor() {
        return this.color;
    }


    translate(dx, dy) {
        this.transMatrix.e += dx;
        this.transMatrix.f += dy;
    }


    scale(scaleFactor) {
        this.transMatrix.a *= scaleFactor;
        this.transMatrix.b *= scaleFactor;
        this.transMatrix.c *= scaleFactor;
        this.transMatrix.d *= scaleFactor;
    }


    getScaleFactor() {
        return this.transMatrix.a;
    }


    getCenterX() {
        return this.transMatrix.e;
    }

    getCenterY() {
        return this.transMatrix.f;
    }

}
