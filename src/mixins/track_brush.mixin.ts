/* eslint-disable no-var */
//@ts-nocheck
import { Point } from '../point.class';
import { getSyncOptions } from '../util/index';

(function (global) {
  var fabric = global.fabric

  /**
   * 通过轨迹选中
   */
  fabric.TrackBrush = fabric.util.createClass(
    fabric.PencilBrush,
    /** @lends fabric.EraserBrush.prototype */ {
      type: 'track',

      /**
       *
       * @param {Point} pointer
       * @param {fabric.IEvent} options
       * @returns
       */
      onMouseDown: function (pointer, options) {
        if (!this.canvas._isMainEvent(options.e)) {
          return;
        }
        // this.canvas.isTrackBrush = true
        this._prepareForDrawing(pointer);
        // capture coordinates immediately
        // this allows to draw dots (when movement never occurs)
        // this._captureDrawingPath(pointer);

        // this._render();
      },

      onMouseUp: function(options) {
        if (!this.canvas._isMainEvent(options.e)) {
          return true;
        }
        this.drawStraightLine = false;
        this.oldEnd = undefined;
        this._finalizeAndAddPath();
        // this.canvas.isTrackBrush = false
        this.canvas.selection = true
        this.canvas.isDrawingMode = false
        this.canvas.clearContext(this.canvas.contextTop);
        return false;
      },


      /**
       * Creates fabric.Path object
       * @override
       * @private
       * @param {(string|number)[][]} pathData Path data
       * @return {fabric.Path} Path to add on canvas
       * @returns
       */
      createPath: function (pathData) {
        var path = this.callSuper('createPath', pathData);
        return path;
      },

      /**
       * On mouseup after drawing the path on contextTop canvas
       * we use the points captured to create an new fabric path object
       * and add it to every intersected erasable object.
       */
      _finalizeAndAddPath: function (e) {
        var ctx = this.canvas.contextTop, canvas = this.canvas;
        ctx.closePath();

        // clear
        canvas.clearContext(canvas.contextTop);

        var pathData = this._points && this._points.length > 1 ?
          this.convertPointsToSVGPath(this._points, false) :
          null;
        var path = this.createPath(pathData);

        //  needed for `intersectsWithObject`
        path.setCoords();

        var _this = this;

        // todo: get selectObjects on trackBrush move
        const selectObjects = canvas._objects.filter(function (obj) {
            if (obj.qn.t === 'path') {
                return _this.checkPathIntersect(path, obj)
            } else if (obj.intersectsWithObject(path, false, true)) {
                return true
            } else {
                return false
            }
        })
        console.log('selectObjects', selectObjects)
        canvas.discardActiveObject();
        if (selectObjects.length) {
          var sel = new fabric.ActiveSelection(selectObjects, {
            canvas: canvas,
          });
          canvas.setActiveObject(sel);
        }
        
        canvas.requestRenderAll();
      },

      /**
       * 检查两个path相交
       * @param path1 
       * @param path2 
       */
      checkPathIntersect(path1, path2) {
        let isIntersect = false
        for (let i = 0; i < path1.path.length; i++) {
            const item1 = JSON.parse(JSON.stringify(path1.path[i]))
            const point1 = item1.splice(1,3)
            for (let j = 0; j < path2.path.length; j++) {
                const item2 = JSON.parse(JSON.stringify(path2.path[j]))
                const point2 = item2.splice(1,3)
                console.log(Math.abs(point1[0] - point2[0]), Math.abs(point1[1] - point2[1]))
                if (Math.abs(point1[0] - point2[0]) < 20 && Math.abs(point1[1] - point2[1]) < 20) {
                    isIntersect = true
                    break
                }
            }
        }
        console.log('====isIntersect====', isIntersect)
        return isIntersect
      }
    }
  );

  /** ERASER_END */
})(typeof exports !== 'undefined' ? exports : window);
