/**
 * Geometry utilities index.
 * Re-exports all utility modules for convenient importing.
 */

export * as AngleUtils from './AngleUtils.js';
export * as VectorUtils from './VectorUtils.js';
export * as TransformUtils from './TransformUtils.js';
export * as LineUtils from './LineUtils.js';
export * as CircleUtils from './CircleUtils.js';

// Also export individual commonly-used functions for convenience
export {
	normalizeAngle,
	normalizeAngleSigned,
	isAngleInRange,
	getMidAngle,
	getAngularSweep,
	toDegrees,
	toRadians
} from './AngleUtils.js';

export {
	distance,
	distanceSquared,
	distFast,
	normalize,
	dotProduct,
	crossProduct,
	add,
	subtract,
	scale,
	length,
	lengthSquared,
	perpendicular,
	angleBetween,
	getAngleDeg,
	closestPointOnSegment,
	lerp,
	clamp
} from './VectorUtils.js';

export {
	rotatePoint,
	scalePoint,
	mirrorPoint,
	translatePoint,
	rotatePointInPlace,
	scalePointInPlace,
	mirrorPointInPlace,
	translatePointInPlace,
	getMirrorLineAngle,
	mirrorAngle
} from './TransformUtils.js';

export {
	lineIntersection,
	projectPointOntoLine,
	lineDirection,
	lineDirectionToward,
	lineDirectionAwayFrom,
	lineNormal,
	signedDistanceToLine,
	trimLineKeepClickSide,
	getParametricT,
	getPointAtT,
	getAngleDeg,
	lineLength
} from './LineUtils.js';

export {
	circleCircleIntersection,
	circleLineOffsetIntersection,
	tangentPointOnArc,
	getPointAtAngle,
	getAngleToPoint,
	getTangentAngle,
	trimArcKeepClickSide,
	calculateArcFrom3Points,
	arcLength,
	circumference,
	projectPointOntoCircle
} from './CircleUtils.js';
