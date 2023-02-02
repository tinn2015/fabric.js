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
  fabric.FreeDrawBrush = fabric.util.createClass(fabric.BaseBrush, /** @lends fabric.PencilBrush.prototype */ {

    /**
     * Discard points that are less than `decimate` pixel distant from each other
     * @type Number
     * @default 0.4
     */
    decimate: 0.4,

    /**
     * Draws a straight line between last recorded point to current pointer
     * Used for `shift` functionality
     *
     * @type boolean
     * @default false
     */
    drawStraightLine: false,

    /**
     * The event modifier key that makes the brush draw a straight line.
     * If `null` or 'none' or any other string that is not a modifier key the feature is disabled.
     * @type {'altKey' | 'shiftKey' | 'ctrlKey' | 'none' | undefined | null}
     */
    straightLineKey: 'shiftKey',

    svgPaths: [],

    svgPathIndex: 0,

    batchUpdateSvgPathNum: 0,

    lastPoint: [],

    /**
     * Constructor
     * @param {fabric.Canvas} canvas
     * @return {fabric.PencilBrush} Instance of a pencil brush
     */
    initialize: function(canvas) {
      this.canvas = canvas;
      this._points = [];
      this.svgPaths = []
    },

    needsFullRender: function () {
      return this.callSuper('needsFullRender') || this._hasStraightLine;
    },

    /**
     * Invoked inside on mouse down and mouse move
     * @param {Object} pointer
     */
    _drawSegment: function (ctx, p1, p2) {
      var midPoint = p1.midPointFrom(p2);
      ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
      this._addSvgPath(['Q', p1.x, p1.y, midPoint.x, midPoint.y]);
      return midPoint;
    },

    /**
     * Invoked on mouse down
     * @param {Object} pointer
     */
    onMouseDown: function(pointer, options) {
      if (!this.canvas._isMainEvent(options.e)) {
        return;
      }
      // this.canvas.clearContext(this.canvas.contextTop);
      this.lastPoint = [pointer.x, pointer.y, new Date().getTime()]
      this.drawStraightLine = options.e[this.straightLineKey];
      this._prepareForDrawing(pointer);
      // capture coordinates immediately
      // this allows to draw dots (when movement never occurs)
      this._captureDrawingPath(pointer);

      this._addSvgPath(['M', pointer.x, pointer.y]);

      this._render();
    },

    /**
     * Invoked on mouse move
     * @param {Object} pointer
     */
    onMouseMove: function(pointer, options) {
      if (!this.canvas._isMainEvent(options.e)) {
        return;
      }
      this.drawStraightLine = options.e[this.straightLineKey];
      if (this.limitedToCanvasSize === true && this._isOutSideCanvas(pointer)) {
        return;
      }

      var cur = new Date().getTime()
      document.getElementById('tip')?.innerText = `${cur - this.lastPoint[2]}`
      this.lastPoint = [pointer.x, pointer.y, cur]

      if (this._captureDrawingPath(pointer) && this._points.length > 1) {
        if (this.needsFullRender()) {
          // redraw curve
          // clear top canvas
          this.canvas.clearContext(this.canvas.contextTop);
          this._render();
        }
        else {
          var points = this._points, length = points.length, ctx = this.canvas.contextTop;
          // draw the curve update
          this._saveAndTransform(ctx);
          if (this.oldEnd) {
            ctx.beginPath();
            ctx.moveTo(this.oldEnd.x, this.oldEnd.y);
          }
          this.oldEnd = this._drawSegment(ctx, points[length - 2], points[length - 1], true);
          ctx.stroke();
          ctx.restore();
          // this._drawSegment(ctx, points[length - 2], points[length - 1], true)
        }
      }
    },

    /**
     * Invoked on mouse up
     */
    onMouseUp: function(options) {
      if (!this.canvas._isMainEvent(options.e)) {
        return true;
      }
      var cur = new Date().getTime()
      document.getElementById('tip')?.innerText = `${cur - this.lastPoint[2]}`
      this.lastPoint = [options.e.x, options.e.y, cur]

      this.drawStraightLine = false;
      this.oldEnd = undefined;
      
      console.log('mouseup', options)
      this._addSvgPath(['L', options.pointer.x, options.pointer.y]);
      
      this._finalizeAndAddPath();
      // this._addSvgPath(null, 'end')
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
      this.canvas.contextTop.moveTo(p.x, p.y);
    },

    /**
     * @private
     * @param {Point} point Point to be added to points array
     */
    _addPoint: function(point) {
      if (this._points.length > 1 && point.eq(this._points[this._points.length - 1])) {
        return false;
      }
      if (this.drawStraightLine && this._points.length > 1) {
        this._hasStraightLine = true;
        this._points.pop();
      }
      this._points.push(point);
      return true;
    },

    _addSvgPath: function (svgPath, flag) {
      /**
       *
       * 批量绘制方案
       *
       */

      //绘制结束
      // if (flag === 'end') {
      //   this._drawPath(this.svgPaths, flag);
      //   this.svgPathIndex = 0;
      //   return;
      // }
      // // 第一次直接绘制
      // if (!this.svgPaths.length || this.svgPaths.length < this.batchUpdateSvgPathNum) {
      //   this.svgPaths.push(svgPath);
      //   this._drawPath(this.svgPaths, flag);
      //   return;
      // }
      // else {
      //   this.svgPaths.push(svgPath);
      // }

      // // 依据新增点数执行绘制
      // var svgPathsLen = this.svgPaths.length;
      // if (svgPathsLen - this.svgPathIndex >= this.batchUpdateSvgPathNum) {
      //   this.svgPathIndex = this.svgPaths.length;
      //   this._drawPath(this.svgPaths);
      // }
      // qn modified
      if (!this.svgPaths.length) {
        // fabric.freeDrawObject 挂载当前path的qn
        fabric.freeDrawObject = fabric.util.genQn({t: 'fp'})
      }
      this.svgPaths.push(svgPath)
      // 生成path的时候socket同步
      fabric.util.socket && fabric.util.socket.draw({qn: fabric.freeDrawObject, index: this.svgPaths.length, path:svgPath});
    },

    /**
     * Clear points array and set contextTop canvas style.
     * @private
     */
    _reset: function() {
      this._points = [];
      this.svgPaths = []
      this._setBrushStyles(this.canvas.contextTop);
      this._setShadow();
      this._hasStraightLine = false;
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
     * Draw a smooth path on the topCanvas using quadraticCurveTo
     * @private
     * @param {CanvasRenderingContext2D} [ctx]
     */
    _render: function(ctx) {
      var i, len,
          p1 = this._points[0],
          p2 = this._points[1];
      ctx = ctx || this.canvas.contextTop;
      this._saveAndTransform(ctx);
      ctx.beginPath();
      //if we only have 2 points in the path and they are the same
      //it means that the user only clicked the canvas without moving the mouse
      //then we should be drawing a dot. A path isn't drawn between two identical dots
      //that's why we set them apart a bit
      if (this._points.length === 2 && p1.x === p2.x && p1.y === p2.y) {
        var width = this.width / 1000;
        p1 = new Point(p1.x, p1.y);
        p2 = new Point(p2.x, p2.y);
        p1.x -= width;
        p2.x += width;
      }
      ctx.moveTo(p1.x, p1.y);

      for (i = 1, len = this._points.length; i < len; i++) {
        // we pick the point between pi + 1 & pi + 2 as the
        // end point and p1 as our control point.
        this._drawSegment(ctx, p1, p2);
        p1 = this._points[i];
        p2 = this._points[i + 1];
      }
      // Draw last line as a straight line while
      // we wait for the next point to be able to calculate
      // the bezier control point
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.restore();
    },

    /**
     * Converts points to SVG path
     * @param {Array} points Array of points
     * @return {(string|number)[][]} SVG path commands
     */
    convertPointsToSVGPath: function (points) {
      var correction = this.width / 1000;
      return fabric.util.getSmoothPathFromPoints(points, correction);
    },

    /**
     * @private
     * @param {(string|number)[][]} pathData SVG path commands
     * @returns {boolean}
     */
    _isEmptySVGPath: function (pathData) {
      var pathString = fabric.util.joinPath(pathData);
      return pathString === 'M 0 0 Q 0 0 0 0 L 0 0';
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
    _finalizeAndAddPath: function() {
      fabric._drawPathStamp = Date.now()
      var ctx = this.canvas.contextTop;
      ctx.closePath();
      // if (this.decimate) {
      //   this._points = this.decimatePoints(this._points, this.decimate);
      // }
      // var _pathData = this.convertPointsToSVGPath(this._points);
      // console.log('convertPointsToSVGPath', _pathData)
      var pathData = this.svgPaths

      if (this._isEmptySVGPath(pathData)) {
        // do not create 0 width/height paths, as they are
        // rendered inconsistently across browsers
        // Firefox 4, for example, renders a dot,
        // whereas Chrome 10 renders nothing
        this.canvas.requestRenderAll();
        return;
      }
      var path = this.createPath(pathData);
      this.canvas.fire('before:path:created', { path: path });
      this.canvas.add(path);
      // 再下一帧中删除上层画布的path， 预期改善最后一笔的延迟
      fabric._freePathOnTopCanvas = true
      this.canvas.renderCanvasByOne(this.canvas.contextContainer, path)
      // this.canvas.requestRenderAll();

      path.setCoords();
      this._resetShadow();
      // this.canvas.clearContext(this.canvas.contextTop);

      // console.log('history push, shape 添加历史栈')
      // // path 添加历史栈
      // !path.qn.noHistoryStack && fabric.util.history && fabric.util.history.push({
      //   type: 'add',
      //   objects: [path]
      // })
      // fire event 'path' created
      this.canvas.fire('path:created', { path: path });
    },

    // 批量重新createPath
    _drawPath: function(svgPaths, flag) {
      console.time('====drawPath====');
      // console.log('pathData', pathData);
      // var pathData = this.svgPaths;
      // if (this._isEmptySVGPath(pathData)) {
      //   // do not create 0 width/height paths, as they are
      //   // rendered inconsistently across browsers
      //   // Firefox 4, for example, renders a dot,
      //   // whereas Chrome 10 renders nothing
      //   this.canvas.requestRenderAll();
      //   return;
      // }
      if (flag === 'end') {
        // this.canvas.requestRenderAll();
        // fabric._tempFreePath._cacheCanvas = null;
        // fabric._tempFreePath._cacheContext = null;
        fabric._tempFreePath = null;
        return;
      }
      if (fabric._tempFreePath) {
        fabric._tempFreePath._cacheCanvas = null;
        fabric._tempFreePath._cacheCanvas = null;
        fabric._tempFreePath.canvas = null;
        this.canvas.remove(fabric._tempFreePath);
        fabric._tempFreePath = null;
      }
      // this.canvas.clearContext(this.canvas.contextTop);
      var path = this.createPath(svgPaths);
      this.canvas.fire('before:path:created', { path: path });
      console.log('==draw add path==', path);
      this.canvas.add(path);
      this.canvas.requestRenderAll();
      // path.setCoords();
      // this._resetShadow();
      // path._render(this.canvas.contextContainer);
      if (flag !== 'end') {
        fabric._tempFreePath = path;
        // 绘制完成
        // debugger;
        // console.log('====绘制完成====');
        // this._drawPath(this.svgPaths);
      }
      else {
        path.setCoords();
        this._resetShadow();
      }

      // fire event 'path' created
      this.canvas.fire('path:created', { path: path });
    },
  });
})(typeof exports !== 'undefined' ? exports : window);
