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
