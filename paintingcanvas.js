"use strict";

Vue.component('painting-canvas', {
    props: {
        width: {
            type: Number,
            default: 640,
        },
        height: {
            type: Number,
            default: 480
        },
        pens: {
            type: Array,
            default: []
        },
        src: {
            type: String,
            default: ""
        },
        minInk: {
            type: Number,
            default: 1
        },
        maxInk: {
            type: Number,
            default: 10
        },
        maxDistance: {
            type: Number,
            default: 100
        },
        maxTime: {
            type: Number,
            default: 100
        }
    },
    template: `<canvas v-bind:style="canvasStyle" 
                v-on:mousemove="mousemove"
                v-on:mousedown="mousedown"
                v-on:mouseup="mouseup"
                v-on:touchstart.prevent="touchstart"
                v-on:touchend.prevent="touchend"
                v-on:touchmove.prevent="touchmove"
                v-bind:width="width"
                v-bind:height="height"
                ref="canvas"
                ></canvas>`,
    data: function () {
        return {
            "ctx": 0,
            "canvas": undefined,
            "canvasStyle": {
                "touch-action": "none",
                "display": "block",
                "object-fit": "contain",
                "width": "100%",
                "height": "100%",
                "border": "none",
                "padding": "initial",
                "box-sizing": "border-box"
            }
        };
    },
    watch: {
        src: {
            handler(newVal, oldVal) {
                this.setImage(newVal);
            },
            immediate: false
        }
    },
    methods: {
        setImage(src) {
            let ctx = this.ctx;
            let pens = this.pens;
            return new Promise((resolve, reject) => {
                let myImage = new Image();
                ctx.clearRect(0, 0, this.width, this.height);
                myImage.src = src;
                myImage.onload = () => {
                    ctx.drawImage(myImage, 0, 0);
                    pens.forEach((pen) => {
                        pen.active = false;
                        pen.point = false;
                    });
                    resolve();
                };
            });
        },
        getImage(format, quality) {
            return this.canvas.toDataURL(format, quality);
        },
        calcCoordinates(event) {
            let r = this.canvas.getBoundingClientRect();

            let aspectratiocanvas = this.height / this.width;
            let aspectratioclient = r.height / r.width;

            if (aspectratioclient > aspectratiocanvas) {
                // igual ancho, pero el alto del cliente es mayor que el del canvas.
                // ==> corregir coordenada y.
                let ratio = this.width / r.width;
                let height = this.height / ratio;
                let y = r.y + (r.height - height) / 2
                return [
                    (event.clientX - r.x) * ratio,
                    (event.clientY - y) * ratio
                ];
            } else {
                // igual alto, pero el ancho del cliente es mayor que el del canvas.
                // ==> corregir coordenada x.
                let ratio = this.height / r.height;
                let width = this.width / ratio;
                let x = r.x + (r.width - width) / 2
                return [
                    (event.clientX - x) * ratio,
                    (event.clientY - r.y) * ratio
                ];
            }
        },
        drawPoint(color, x, y, lineWidth) {
            this.ctx.beginPath();
            this.ctx.lineWidth = lineWidth;
            this.ctx.strokeStyle = color;
            this.ctx.fillStyle = color;
            this.ctx.arc(x + 0.5, y + 0.5, this.ctx.lineWidth * 0.5, 0, 2 * Math.PI);
            this.ctx.fill();
        },
        drawStroke(color, x0, y0, x1, y1, lineWidth) {
            this.ctx.beginPath();
            this.ctx.lineWidth = lineWidth;
            this.ctx.strokeStyle = color;
            this.ctx.fillStyle = color;
            this.ctx.moveTo(x0 + 0.5, y0 + 0.5);
            this.ctx.lineTo(x1 + 0.5, y1 + 0.5);
            this.ctx.stroke();
        },
        startPen(pen, XY, timeStamp) {
            pen.active = true;
            pen.point = true;
            pen.timeStamp = timeStamp;
            pen.timeLapse = 0;
            [pen.x1, pen.y1] = XY;
            [pen.x0, pen.y0] = XY;
        },
        stopPen(pen, XY, timeStamp, force) {
            pen.active = false;
            this.steadyPen(pen, XY, timeStamp, force);
        },
        steadyPen(pen, XY, timeStamp, force) {
            if (pen.point) {
                pen.point = false;
                pen.timeLapse = timeStamp - pen.timeStamp;
                pen.timeStamp = timeStamp;
                [pen.x0, pen.y0] = [pen.x1, pen.y1];
                [pen.x1, pen.y1] = XY;
                let lineWidth = (pen.timeLapse < this.maxTime ?
                    (this.maxInk - this.minInk) * pen.timeLapse / this.maxTime + this.minInk :
                    this.maxInk) * (force || 0.5) * 2;
                this.drawPoint(pen.color, pen.x1, pen.y1, lineWidth);
                this.$emit('pen', { pen: "steady", x: pen.x1, y: pen.y1, color: pen.color, lineWidth: lineWidth });
            }
        },
        movePen(pen, XY, timeStamp, force) {
            if (pen.active) {
                pen.point = false;
                pen.timeLapse = timeStamp - pen.timeStamp;
                pen.timeStamp = timeStamp;
                [pen.x0, pen.y0] = [pen.x1, pen.y1];
                [pen.x1, pen.y1] = XY;
                let distance = Math.sqrt((pen.x0 - pen.x1) ** 2 + (pen.y0 - pen.y1) ** 2);
                let lineWidth = (distance < this.maxDistance ?
                    this.maxInk - (this.maxInk - this.minInk) * distance / this.maxDistance :
                    this.maxInk) * (force || 0.5) * 2;
                this.drawStroke(pen.color, pen.x0, pen.y0, pen.x1, pen.y1, lineWidth);
                this.$emit('pen', { pen: "move", x0: pen.x0, y0: pen.y0, x1: pen.x1, y1: pen.y1, color: pen.color, lineWidth: lineWidth });
            }
        },
        mousedown(event) {
            if (event.button == 0)
                this.startPen(this.pens[navigator.maxTouchPoints], this.calcCoordinates(event), event.timeStamp);
        },
        mouseup(event) {
            if (event.button == 0)
                this.stopPen(this.pens[navigator.maxTouchPoints], this.calcCoordinates(event), event.timeStamp);
        },
        mousemove(event) {
            if (event.buttons & 1)
                this.movePen(this.pens[navigator.maxTouchPoints], this.calcCoordinates(event), event.timeStamp);
        },
        touchstart(event) {
            for (let i = 0; i < event.changedTouches.length; i++) {
                let touch = event.changedTouches[i];
                this.startPen(this.pens[touch.identifier], this.calcCoordinates(touch), event.timeStamp);
            }
        },
        touchend(event) {
            for (let i = 0; i < event.changedTouches.length; i++) {
                let touch = event.changedTouches[i];
                this.stopPen(this.pens[touch.identifier], this.calcCoordinates(touch), event.timeStamp, touch.force);
            }
        },
        touchmove(event) {
            for (let i = 0; i < event.changedTouches.length; i++) {
                let touch = event.changedTouches[i];
                console.log(touch);
                this.movePen(this.pens[touch.identifier], this.calcCoordinates(touch), event.timeStamp, touch.force);
            }
        }
    },
    mounted() {

        this.canvas = this.$refs.canvas;

        while (this.pens.length > 0) {
            this.pens.pop();
        }
        for (let i = 0; i <= navigator.maxTouchPoints; i++) {
            this.pens.push({
                active: false,
                point: false,
                timeStamp: 0,
                timeLapse: 0,
                color: "#" + Math.trunc(Math.random() * 256 * 256 * 256).toString(16),// "#000000",
                x0: 0,
                y0: 0,
                x1: 0,
                y1: 0
            });
        }
        this.ctx = this.canvas.getContext("2d");
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.lineWidth = 1;
        this.ctx.miterLimit = 10;
        this.ctx.strokeStyle = "#000000";
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(this.width - 1, this.height - 1);
        this.ctx.moveTo(this.width - 1, 0);
        this.ctx.lineTo(0, this.height - 1);
        this.ctx.rect(0, 0, this.width, this.height);
        this.ctx.stroke();
    }
})
