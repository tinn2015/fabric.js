/* eslint-disable no-var */
//@ts-nocheck
import { Point } from '../point.class';

(function(global) {
  var fabric = global.fabric;
  /**
   * PencilBrush class
   * @class fabric.PencilBrush
   * @extends fabric.BaseBrush
   */
  fabric.IntersectEraserBrush = fabric.util.createClass(fabric.BaseBrush, /** @lends fabric.PencilBrush.prototype */ {

    /**
     * The event modifier key that makes the brush draw a straight line.
     * If `null` or 'none' or any other string that is not a modifier key the feature is disabled.
     * @type {'altKey' | 'shiftKey' | 'ctrlKey' | 'none' | undefined | null}
     */
    straightLineKey: 'shiftKey',

    /**
     * Constructor
     * @param {fabric.Canvas} canvas
     * @return {fabric.PencilBrush} Instance of a pencil brush
     */
    initialize: function(canvas) {
      this.canvas = canvas;
      this._points = [];
      this.intersectObjects = []
    },

    /**
     * Invoked on mouse down
     * @param {Object} pointer
     */
    onMouseDown: function(pointer, options) {
      if (!this.canvas._isMainEvent(options.e)) {
        return;
      }
      this.canvas.clearContext(this.canvas.contextTop)
      this._prepareForDrawing(pointer);
      // capture coordinates immediately
      // this allows to draw dots (when movement never occurs)
      this._captureDrawingPath(pointer);
    },

    /**
     * Invoked on mouse move
     * @param {Object} pointer
     */
    onMouseMove: function(pointer, options) {
      if (!this.canvas._isMainEvent(options.e)) {
        return;
      }
      if (this.limitedToCanvasSize === true && this._isOutSideCanvas(pointer)) {
        return;
      }
      // check and 
      const needAdd = this._captureDrawingPath(pointer)
      if (!needAdd) return
      const points = JSON.parse(JSON.stringify(this._points))
      const objects = this.canvas.getObjects()
      const lastPoint = points[this._points.length - 2]
      console.log('onmousemove _points', pointer, lastPoint, points)
      const line = [[lastPoint.x, lastPoint.y], [pointer.x, pointer.y]]
      console.log('onmousemove line', line)
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        const {oid} = obj.qn
        const includeItem = this.intersectObjects.find((item) => item.qn.oid === oid)
        if (includeItem) continue
        // const absolute = false
        // const otherCoords = absolute ? obj.aCoords : obj.lineCoords,
        // const lines = obj._getImageLines(otherCoords);

        // if (obj.containsPoint(pointer, lines)) {
        //   console.log('obj.containsPoint', obj, line)
            
        // }
        if (obj.qn.t !== 'path' || (obj.qn.t === 'path' && (obj.checkPointHitPath3(line)))) {
            this.intersectObjects.push(obj)
            obj.set('opacity', 0.5)
            this.canvas.requestRenderAll()
        }
      }
      console.log('this.intersectObjects', this.intersectObjects)
    },

    /**
     * Invoked on mouse up
     */
    onMouseUp: function(options) {
      if (!this.canvas._isMainEvent(options.e)) {
        return true;
      }
      this._finalizeAndCheckIntersect();
      return false;
    },

    /**
     * @private
     * @param {Object} pointer Actual mouse position related to the canvas.
     */
    _prepareForDrawing: function(pointer) {

      var p = new Point(pointer.x, pointer.y);

      this._reset();
      this._addPoint(p);
    },

    /**
     * @private
     * @param {Point} point Point to be added to points array
     */
    _addPoint: function(point) {
      if (this._points.length > 1 && point.eq(this._points[this._points.length - 1])) {
        return false;
      }
      this._points.push(point);
      return true;
    },

    /**
     * Clear points array and set contextTop canvas style.
     * @private
     */
    _reset: function() {
      this._points = [];
      this.intersectObjects = []
    },

    /**
     * @private
     * @param {Object} pointer Actual mouse position related to the canvas.
     */
    _captureDrawingPath: function(pointer) {
      var pointerPoint = new Point(pointer.x, pointer.y);
      return this._addPoint(pointerPoint);
    },

    /**
     * Converts points to SVG path
     * @param {Array} points Array of points
     * @return {(string|number)[][]} SVG path commands
     */
     convertPointsToSVGPath: function (points, sync=true) {
        var correction = this.width / 1000;
        return fabric.util.getSmoothPathFromPoints(points, correction, sync);
      },


    /**
     * Creates fabric.Path object to add on canvas
     * @param {(string|number)[][]} pathData Path data
     * @return {fabric.Path} Path to add on canvas
     */
    createPath: function(pathData) {
      var path = new fabric.Path(pathData, {
        fill: null,
        stroke: this.color,
        strokeWidth: this.width,
        strokeLineCap: this.strokeLineCap,
        strokeMiterLimit: this.strokeMiterLimit,
        strokeLineJoin: this.strokeLineJoin,
        strokeDashArray: this.strokeDashArray,
      });
      if (this.shadow) {
        this.shadow.affectStroke = true;
        path.shadow = new fabric.Shadow(this.shadow);
      }

      return path;
    },

    /**
     * Decimate points array with the decimate value
     */
    decimatePoints: function(points, distance) {
      if (points.length <= 2) {
        return points;
      }
      var zoom = this.canvas.getZoom(), adjustedDistance = Math.pow(distance / zoom, 2),
          i, l = points.length - 1, lastPoint = points[0], newPoints = [lastPoint],
          cDistance;
      for (i = 1; i < l - 1; i++) {
        cDistance = Math.pow(lastPoint.x - points[i].x, 2) + Math.pow(lastPoint.y - points[i].y, 2);
        if (cDistance >= adjustedDistance) {
          lastPoint = points[i];
          newPoints.push(lastPoint);
        }
      }
      /**
       * Add the last point from the original line to the end of the array.
       * This ensures decimate doesn't delete the last point on the line, and ensures the line is > 1 point.
       */
      newPoints.push(points[l]);
      return newPoints;
    },

    /**
     * On mouseup after drawing the path on contextTop canvas
     * we use the points captured to create an new fabric path object
     * and add it to the fabric canvas.
     */
    _finalizeAndCheckIntersect: function() {
      // [bugfix] 在clear命令后删除橡皮擦选中的元素，导致被清屏又重新删除
      const currentObjectIds = this.canvas.getObjects().map(i => i.qn.oid)
      const existObjs = this.intersectObjects.filter(i => currentObjectIds.includes(i.qn.oid))
      if (!currentObjectIds.length || !existObjs.length) {
        this._reset()
        return
      }
      existObjs.forEach(obj => {
          obj.qn.sync = false
          obj.qn.noHistoryStack = true
      })
      existObjs.length && this.canvas.remove(...existObjs)
      existObjs.length && window.fabric.util.socket &&
        window.fabric.util.socket.sendCmd({
          cmd: "br", // br => batchRemove
          oids: existObjs.map((i: any) => i.qn.oid),
        });
        existObjs.length && fabric.util.history && fabric.util.history.push({
        type: "delete",
        objects: existObjs,
      });
      this.canvas.clearContext(this.canvas.contextTop)
      this.canvas.requestRenderAll()
      console.log('eraser points', this._points)
      this._reset()
    }
  });
})(typeof exports !== 'undefined' ? exports : window);
