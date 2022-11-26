//@ts-nocheck
import { fabric } from '../../HEADER'
import './animate'; // optional animation
import './animate_color'; // optional animation
import './anim_ease'; // optional easing
import './dom_event'; // optional interaction
import './dom_misc';
import './dom_request';
import './dom_style';
import * as arrayUtils from './lang_array';
import './lang_class';
import './lang_object';
import './lang_string';
import './misc/misc';
import './path';

fabric.util.array = arrayUtils;

const {
    cos,
    sin,
    getElementOffset,
    removeFromArray,
    toFixed,
    transformPoint,
    invertTransform,
    getNodeCanvas,
    createCanvasElement,
    toDataURL,
    multiplyTransformMatrices,
    applyTransformToObject,
    degreesToRadians,
    enlivenObjects,
    enlivenObjectEnlivables,
    cleanUpJsdomNode,
    loadImage,
    setImageSmoothing,
    getById,
    addClass,
    parsePreserveAspectRatioAttribute,
    findScaleToFit,
    findScaleToCover,
    stylesFromArray,
    stylesToArray,
    hasStyleChanged,
    getPathSegmentsInfo,
    getPointOnPath,
    string: {
        graphemeSplit,
        capitalize,
        escapeXml
    },
    projectStrokeOnPoints,
    array: {
        min,
        max
    },
    makePathSimpler,
    parsePath,
    joinPath,
    getBoundsOfCurve,
    limitDimsByArea,
    capValue: clamp,
    populateWithProperties,
    qrDecompose,
    saveObjectTransform,
    resetObjectTransform,
    object: {
        clone,
        extend
    },
    matrixToSVG,
    sizeAfterTransform,
    animate,
    animateColor,
    requestAnimFrame,
    cancelAnimFrame,
    rotateVector,
    getRandomInt,
    getSmoothPathFromPoints,
    parseUnit,
    toArray,
    request,
    addListener,
    removeListener,
    isTouchEvent,
    sendPointToPlane,
    radiansToDegrees,
    setStyle,
    calcRotateMatrix,
    makeBoundingBoxFromPoints,
    composeMatrix,
    rotatePoint,
} = fabric.util;
export {
    cos,
    sin,
    getElementOffset,
    removeFromArray,
    toFixed,
    transformPoint,
    invertTransform,
    getNodeCanvas,
    createCanvasElement,
    toDataURL,
    multiplyTransformMatrices,
    applyTransformToObject,
    degreesToRadians,
    enlivenObjects,
    enlivenObjectEnlivables,
    cleanUpJsdomNode,
    loadImage,
    setImageSmoothing,
    getById,
    addClass,
    parsePreserveAspectRatioAttribute,
    findScaleToFit,
    findScaleToCover,
    stylesFromArray,
    stylesToArray,
    hasStyleChanged,
    getPathSegmentsInfo,
    getPointOnPath,
    graphemeSplit,
    capitalize,
    escapeXml,
    projectStrokeOnPoints,
    min,
    max,
    makePathSimpler,
    parsePath,
    joinPath,
    getBoundsOfCurve,
    limitDimsByArea,
    clamp,
    populateWithProperties,
    qrDecompose,
    saveObjectTransform,
    resetObjectTransform,
    clone,
    extend,
    matrixToSVG,
    sizeAfterTransform,
    animate,
    animateColor,
    requestAnimFrame,
    cancelAnimFrame,
    rotateVector,
    getRandomInt,
    getSmoothPathFromPoints,
    parseUnit,
    toArray,
    request,
    addListener,
    removeListener,
    isTouchEvent,
    sendPointToPlane,
    radiansToDegrees,
    setStyle,
    calcRotateMatrix,
    makeBoundingBoxFromPoints,
    composeMatrix,
    rotatePoint
};

export const isNumber = (data: number) => {
    if (typeof data !== 'number') {
        return false
    }
    if (Number.isNaN(data)) {
        return false
    }
    return true
}

export const getSyncOptions = (obj: any) => {
    const syncProps = ['width', 'height', 'cornerColor', 'fill', 'qn', 'left', 'top', 'height', 'stroke', 'strokeWidth', 'radius', 'x1', 'x2', 'y1', 'y2', 'strokeLineCap', 'zoomX', 'zoomY', 'scaleX', 'scaleY']
    const options = {}
    Object.keys(obj).forEach(key => {
    if (syncProps.includes(key)) {
        options[key] = obj[key]
    }
    })
    return options
}