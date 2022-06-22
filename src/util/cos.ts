import type { TDegree, TRadian } from '../typedefs';
import { halfPI } from '../constants';

/**
 * Calculate the cos of an angle, avoiding returning floats for known results
 * This function is here just to avoid getting 0.999999999999999 when dealing
 * with numbers that are really 1 or 0.
 * @static
 * @memberOf fabric.util
 * @param {TRadian} angle the angle
 * @return {Number} the cosin value for angle.
 */
export const cos = (angle: TRadian): number => {
  if (angle === 0) { return 1; }
  var angleSlice = Math.abs(angle) / halfPI;
  if (angle < 0) {
    // cos(a) = cos(-a)
    angle = -angle;
  }
  switch (angleSlice) {
    case 1: case 3: return 0;
    case 2: return -1;
  }
  return Math.cos(angle);
};

cos(3.14 as TDegree)
cos(3.14 as TRadian)
cos(3.14)