/**
 * Angle utility functions for arc-related geometry operations.
 * Consolidates angle normalization and range checking used across Arc, EllipticalArc, and TangentArc.
 */

const TWO_PI = Math.PI * 2;

/**
 * Normalize angle to [0, 2*PI) range.
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle in [0, 2*PI)
 */
export function normalizeAngle(angle) {
	angle = angle % TWO_PI;
	if (angle < 0) angle += TWO_PI;
	return angle;
}

/**
 * Normalize angle to [-PI, PI] range.
 * Useful for computing angular differences.
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle in [-PI, PI]
 */
export function normalizeAngleSigned(angle) {
	while (angle > Math.PI) angle -= TWO_PI;
	while (angle < -Math.PI) angle += TWO_PI;
	return angle;
}

/**
 * Check if an angle is within an arc's range (counterclockwise from start to end).
 * Handles wrap-around case where startAngle > endAngle.
 * @param {number} angle - Angle to test (radians)
 * @param {number} startAngle - Arc start angle (radians)
 * @param {number} endAngle - Arc end angle (radians)
 * @returns {boolean} True if angle is within the arc range
 */
export function isAngleInRange(angle, startAngle, endAngle) {
	const normAngle = normalizeAngle(angle);
	const normStart = normalizeAngle(startAngle);
	const normEnd = normalizeAngle(endAngle);

	if (normStart <= normEnd) {
		return normAngle >= normStart && normAngle <= normEnd;
	} else {
		// Wrap-around case: arc crosses 0/2PI
		return normAngle >= normStart || normAngle <= normEnd;
	}
}

/**
 * Calculate the midpoint angle of an arc.
 * Handles wrap-around case correctly.
 * @param {number} startAngle - Arc start angle (radians)
 * @param {number} endAngle - Arc end angle (radians)
 * @returns {number} Midpoint angle in [0, 2*PI)
 */
export function getMidAngle(startAngle, endAngle) {
	const normStart = normalizeAngle(startAngle);
	const normEnd = normalizeAngle(endAngle);

	if (normStart <= normEnd) {
		return (normStart + normEnd) / 2;
	} else {
		// Wrap-around: average crosses 0
		let mid = (normStart + normEnd + TWO_PI) / 2;
		if (mid >= TWO_PI) mid -= TWO_PI;
		return mid;
	}
}

/**
 * Calculate the angular sweep (span) from start to end angle.
 * Always returns a positive value in (0, 2*PI].
 * @param {number} startAngle - Arc start angle (radians)
 * @param {number} endAngle - Arc end angle (radians)
 * @returns {number} Angular sweep in radians
 */
export function getAngularSweep(startAngle, endAngle) {
	let sweep = endAngle - startAngle;
	if (sweep <= 0) sweep += TWO_PI;
	return sweep;
}

/**
 * Convert radians to degrees.
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function toDegrees(radians) {
	return radians * (180 / Math.PI);
}

/**
 * Convert degrees to radians.
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function toRadians(degrees) {
	return degrees * (Math.PI / 180);
}

/**
 * Determine the correct arc direction (start/end angles) so the arc curves toward a reference point.
 * Given two angles on a circle, there are two possible arcs - this picks the one whose midpoint
 * is closer to the reference point.
 *
 * @param {number} angle1 - First angle in radians
 * @param {number} angle2 - Second angle in radians
 * @param {Object} center - Arc center {x, y}
 * @param {number} radius - Arc radius
 * @param {Object} referencePoint - Point the arc should curve toward {x, y}
 * @returns {Object} {startAngle, endAngle} for the arc curving toward reference
 */
export function getArcDirectionToward(angle1, angle2, center, radius, referencePoint) {
	// Option A: angle1 -> angle2 (CCW)
	const midA = getMidAngle(angle1, angle2);
	const midPointA = {
		x: center.x + Math.cos(midA) * radius,
		y: center.y + Math.sin(midA) * radius
	};
	const distA = Math.hypot(midPointA.x - referencePoint.x, midPointA.y - referencePoint.y);

	// Option B: angle2 -> angle1 (the other way)
	const midB = getMidAngle(angle2, angle1);
	const midPointB = {
		x: center.x + Math.cos(midB) * radius,
		y: center.y + Math.sin(midB) * radius
	};
	const distB = Math.hypot(midPointB.x - referencePoint.x, midPointB.y - referencePoint.y);

	// Pick the direction where the midpoint is closer to the reference
	if (distA <= distB) {
		return { startAngle: angle1, endAngle: angle2 };
	} else {
		return { startAngle: angle2, endAngle: angle1 };
	}
}
