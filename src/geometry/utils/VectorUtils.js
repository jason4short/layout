/**
 * Vector utility functions for 2D geometry operations.
 * Consolidates vector math used across Geometry base class and GeometryUtils.
 */

/**
 * Create a vector from one point to another.
 * @param {Object} startPoint - {x, y}
 * @param {Object} endPoint - {x, y}
 * @returns {Object} Vector {x, y}
 */
export function vectorBetweenPoints(startPoint, endPoint) {
	return {
		x: endPoint.x - startPoint.x,
		y: endPoint.y - startPoint.y
	};
}

/**
 * Calculate dot product of two vectors.
 * @param {Object} vectorA - {x, y}
 * @param {Object} vectorB - {x, y}
 * @returns {number} Dot product
 */
export function dotProduct(vectorA, vectorB) {
	return (vectorA.x * vectorB.x) + (vectorA.y * vectorB.y);
}

/**
 * Calculate cross product (z-component) of two 2D vectors.
 * Useful for determining winding direction.
 * @param {Object} vectorA - {x, y}
 * @param {Object} vectorB - {x, y}
 * @returns {number} Cross product z-component
 */
export function crossProduct(vectorA, vectorB) {
	return vectorA.x * vectorB.y - vectorA.y * vectorB.x;
}

/**
 * Calculate squared length of a vector.
 * Preferred for comparisons to avoid sqrt.
 * @param {Object} vector - {x, y}
 * @returns {number} Squared length
 */
export function lengthSquared(vector) {
	return dotProduct(vector, vector);
}

/**
 * Calculate length of a vector.
 * @param {Object} vector - {x, y}
 * @returns {number} Vector length
 */
export function length(vector) {
	return Math.sqrt(lengthSquared(vector));
}

/**
 * Calculate squared distance between two points.
 * Preferred for comparisons to avoid sqrt.
 * @param {Object} p1 - {x, y}
 * @param {Object} p2 - {x, y}
 * @returns {number} Squared distance
 */
export function distanceSquared(p1, p2) {
	const dx = p1.x - p2.x;
	const dy = p1.y - p2.y;
	return (dx * dx) + (dy * dy);
}

/**
 * Calculate distance between two points.
 * @param {Object} p1 - {x, y}
 * @param {Object} p2 - {x, y}
 * @returns {number} Distance
 */
export function distance(p1, p2) {
	return Math.sqrt(distanceSquared(p1, p2));
}

/**
 * Normalize a vector to unit length.
 * Returns zero vector if input is degenerate.
 * @param {Object} vector - {x, y}
 * @returns {Object} Unit vector {x, y}
 */
export function normalize(vector) {
	const lenSq = lengthSquared(vector);
	if (lenSq < 1e-20) {
		return { x: 0, y: 0 };
	}
	const invLen = 1 / Math.sqrt(lenSq);
	return {
		x: vector.x * invLen,
		y: vector.y * invLen
	};
}

/**
 * Scale a vector by a scalar.
 * @param {Object} vector - {x, y}
 * @param {number} scalar - Scale factor
 * @returns {Object} Scaled vector {x, y}
 */
export function scale(vector, scalar) {
	return {
		x: vector.x * scalar,
		y: vector.y * scalar
	};
}

/**
 * Add two vectors.
 * @param {Object} v1 - {x, y}
 * @param {Object} v2 - {x, y}
 * @returns {Object} Sum vector {x, y}
 */
export function add(v1, v2) {
	return {
		x: v1.x + v2.x,
		y: v1.y + v2.y
	};
}

/**
 * Subtract v2 from v1.
 * @param {Object} v1 - {x, y}
 * @param {Object} v2 - {x, y}
 * @returns {Object} Difference vector {x, y}
 */
export function subtract(v1, v2) {
	return {
		x: v1.x - v2.x,
		y: v1.y - v2.y
	};
}

/**
 * Get perpendicular vector (rotate 90 degrees counterclockwise).
 * @param {Object} vector - {x, y}
 * @returns {Object} Perpendicular vector {x, y}
 */
export function perpendicular(vector) {
	return { x: -vector.y, y: vector.x };
}

/**
 * Calculate angle between two unit vectors (in radians).
 * @param {Object} v1 - Unit vector {x, y}
 * @param {Object} v2 - Unit vector {x, y}
 * @returns {number} Angle in radians
 */
export function angleBetween(v1, v2) {
	const dot = dotProduct(v1, v2);
	return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * Project a vector onto a direction vector.
 * Returns scalar "t" representing distance along direction.
 * @param {Object} vectorToProject - {x, y}
 * @param {Object} directionVector - {x, y}
 * @returns {number} Scalar projection
 */
export function projectScalar(vectorToProject, directionVector) {
	const dirLenSq = lengthSquared(directionVector);
	if (dirLenSq < 1e-20) {
		return 0;
	}
	return dotProduct(vectorToProject, directionVector) / dirLenSq;
}

/**
 * Project a vector onto a direction vector, returning the projected vector.
 * @param {Object} vectorToProject - {x, y}
 * @param {Object} directionVector - {x, y}
 * @returns {Object} Projected vector {x, y}
 */
export function projectVector(vectorToProject, directionVector) {
	const t = projectScalar(vectorToProject, directionVector);
	return scale(directionVector, t);
}

/**
 * Clamp a number to an inclusive range.
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

/**
 * Linear interpolation between two points.
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {number} t - Parameter (0 = p1, 1 = p2)
 * @returns {Object} Interpolated point {x, y}
 */
export function lerp(p1, p2, t) {
	return {
		x: p1.x + t * (p2.x - p1.x),
		y: p1.y + t * (p2.y - p1.y)
	};
}

/**
 * Find the closest point on a line segment to a given point.
 * @param {Object} point - Point to project {x, y}
 * @param {Object} segmentStart - Segment start {x, y}
 * @param {Object} segmentEnd - Segment end {x, y}
 * @param {boolean} returnT - If true, return {point, t} instead of just point
 * @returns {Object} Closest point, or {point, t} if returnT is true
 */
export function closestPointOnSegment(point, segmentStart, segmentEnd, returnT = false) {
	const segmentVector = vectorBetweenPoints(segmentStart, segmentEnd);
	const pointFromStart = vectorBetweenPoints(segmentStart, point);

	let t = projectScalar(pointFromStart, segmentVector);
	t = clamp(t, 0, 1);

	const closestPoint = {
		x: segmentStart.x + t * segmentVector.x,
		y: segmentStart.y + t * segmentVector.y
	};

	if (returnT) {
		return { point: closestPoint, t };
	}
	return closestPoint;
}
