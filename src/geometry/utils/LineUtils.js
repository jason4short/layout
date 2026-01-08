/**
 * Line-specific geometry utility functions.
 * Used by tools like Fillet, Chamfer, Trim, Extend.
 */

import * as VectorUtils from './VectorUtils.js';

/**
 * Find intersection point of two lines (extended infinitely).
 * @param {Object} line1 - Line with start and end points
 * @param {Object} line2 - Line with start and end points
 * @returns {Object|null} Intersection point {x, y} or null if parallel
 */
export function lineIntersection(line1, line2) {
	const x1 = line1.start.x, y1 = line1.start.y;
	const x2 = line1.end.x, y2 = line1.end.y;
	const x3 = line2.start.x, y3 = line2.start.y;
	const x4 = line2.end.x, y4 = line2.end.y;

	const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

	if (Math.abs(denom) < 1e-10) {
		return null; // Parallel lines
	}

	const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

	return {
		x: x1 + t * (x2 - x1),
		y: y1 + t * (y2 - y1)
	};
}

/**
 * Project a point onto an infinite line (not clamped to segment).
 * @param {Object} point - Point to project {x, y}
 * @param {Object} line - Line with start and end points
 * @returns {Object} Closest point on infinite line {x, y}
 */
export function projectPointOntoLine(point, line) {
	const ax = line.start.x, ay = line.start.y;
	const bx = line.end.x, by = line.end.y;

	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;

	if (lenSq < 1e-10) return { x: ax, y: ay };

	const t = ((point.x - ax) * dx + (point.y - ay) * dy) / lenSq;

	return {
		x: ax + t * dx,
		y: ay + t * dy
	};
}

/**
 * Get unit direction vector along a line.
 * @param {Object} line - Line with start and end points
 * @param {boolean} reverse - If true, returns opposite direction
 * @returns {Object} Unit direction vector {x, y}
 */
export function lineDirection(line, reverse = false) {
	const dx = line.end.x - line.start.x;
	const dy = line.end.y - line.start.y;
	const len = Math.sqrt(dx * dx + dy * dy);

	if (len < 1e-10) return { x: 1, y: 0 };

	const sign = reverse ? -1 : 1;
	return {
		x: sign * dx / len,
		y: sign * dy / len
	};
}

/**
 * Get unit direction along a line, pointing toward a reference point.
 * @param {Object} line - Line with start and end points
 * @param {Object} fromPoint - Point on line to measure from
 * @param {Object} towardPoint - Point to direct toward
 * @returns {Object} Unit direction vector {x, y}
 */
export function lineDirectionToward(line, fromPoint, towardPoint) {
	const dir = lineDirection(line);

	const toTarget = {
		x: towardPoint.x - fromPoint.x,
		y: towardPoint.y - fromPoint.y
	};

	const dot = dir.x * toTarget.x + dir.y * toTarget.y;

	if (dot >= 0) {
		return dir;
	} else {
		return { x: -dir.x, y: -dir.y };
	}
}

/**
 * Get unit direction along a line, pointing away from a reference point.
 * @param {Object} line - Line with start and end points
 * @param {Object} fromPoint - Point to direct away from
 * @returns {Object} Unit direction vector {x, y}
 */
export function lineDirectionAwayFrom(line, fromPoint) {
	const distToStart = VectorUtils.distance(line.start, fromPoint);
	const distToEnd = VectorUtils.distance(line.end, fromPoint);

	let dir;
	if (distToStart > distToEnd) {
		dir = { x: line.start.x - fromPoint.x, y: line.start.y - fromPoint.y };
	} else {
		dir = { x: line.end.x - fromPoint.x, y: line.end.y - fromPoint.y };
	}

	return VectorUtils.normalize(dir);
}

/**
 * Get perpendicular (normal) vector to a line.
 * Returns unit vector pointing left of line direction (start→end).
 * @param {Object} line - Line with start and end points
 * @returns {Object} Unit normal vector {x, y}
 */
export function lineNormal(line) {
	const dir = lineDirection(line);
	return { x: -dir.y, y: dir.x };
}

/**
 * Signed perpendicular distance from a point to an infinite line.
 * Positive = left side of line (start→end), Negative = right side.
 * @param {Object} point - Point {x, y}
 * @param {Object} line - Line with start and end points
 * @returns {number} Signed distance
 */
export function signedDistanceToLine(point, line) {
	const dx = line.end.x - line.start.x;
	const dy = line.end.y - line.start.y;
	const len = Math.sqrt(dx * dx + dy * dy);

	if (len < 1e-10) return VectorUtils.distance(point, line.start);

	return ((point.x - line.start.x) * dy - (point.y - line.start.y) * dx) / len;
}

/**
 * Check if two scalar values are in the same direction from a reference.
 * Helper for determining which side of an intersection a point is on.
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} from - Reference value
 * @param {number} to - Target value
 * @returns {boolean} True if directions align
 */
export function vectorAlign(start, end, from, to) {
	return Math.sign(end - start) === Math.sign(to - from);
}

/**
 * Trim a line at trimPoint, keeping the side where clickPt is.
 * @param {Object} line - Line to trim (modified in place)
 * @param {Object} intersection - Intersection point
 * @param {Object} clickPt - Click point (determines which side to keep)
 * @param {Object} trimPoint - New endpoint
 */
export function trimLineKeepClickSide(line, intersection, clickPt, trimPoint) {
	let test;

	if (line.start.x === line.end.x) {
		test = vectorAlign(line.start.y, line.end.y, intersection.y, clickPt.y);
	} else {
		test = vectorAlign(line.start.x, line.end.x, intersection.x, clickPt.x);
	}

	if (test) {
		// Click is closer to end - keep end, replace start
		line.start.x = trimPoint.x;
		line.start.y = trimPoint.y;
	} else {
		line.end.x = trimPoint.x;
		line.end.y = trimPoint.y;
	}
}

/**
 * Get parametric t value for a point on a line.
 * t=0 is start, t=1 is end.
 * @param {Object} point - Point on line {x, y}
 * @param {Object} line - Line with start and end points
 * @returns {number} Parametric t value
 */
export function getParametricT(point, line) {
	const lineVec = {
		x: line.end.x - line.start.x,
		y: line.end.y - line.start.y
	};
	const pointVec = {
		x: point.x - line.start.x,
		y: point.y - line.start.y
	};
	const lineLengthSq = lineVec.x * lineVec.x + lineVec.y * lineVec.y;
	if (lineLengthSq === 0) return 0;
	return (pointVec.x * lineVec.x + pointVec.y * lineVec.y) / lineLengthSq;
}

/**
 * Get point at parametric position t on a line.
 * @param {number} t - Parametric position (0 = start, 1 = end)
 * @param {Object} line - Line with start and end points
 * @returns {Object} Point at t {x, y}
 */
export function getPointAtT(t, line) {
	return {
		x: line.start.x + t * (line.end.x - line.start.x),
		y: line.start.y + t * (line.end.y - line.start.y)
	};
}

/**
 * Calculate the angle of a line segment in degrees (0-360).
 * @param {Object} line - Line with start and end points
 * @returns {number} Angle in degrees
 */
export function getAngleDeg(line) {
	const dx = line.end.x - line.start.x;
	const dy = line.end.y - line.start.y;
	// canvas is flipped Y
	const angleRad = Math.atan2(-dy, dx);
	let angleDeg = angleRad * (180 / Math.PI);
	if (angleDeg < 0) angleDeg += 360;
	return angleDeg;
}


/**
 * Calculate the length of a line segment.
 * @param {Object} line - Line with start and end points
 * @returns {number} Length
 */
export function lineLength(line) {
	return VectorUtils.distance(line.start, line.end);
}
