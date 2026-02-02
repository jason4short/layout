/**
 * Shared utilities for shape labels (Paper, Frame, Symbol)
 * Provides consistent styling and hit testing for draggable labels.
 */

// Label styling constants (screen pixels)
export const LABEL_HEIGHT = 20;
export const LABEL_PADDING = 6;
export const LABEL_GAP = 4;
export const LABEL_RADIUS = 3;

// Colors
export const LABEL_COLOR_SELECTED = '#2563eb';
export const LABEL_COLOR_NORMAL = '#3b82f6';
export const LABEL_TEXT_COLOR = '#ffffff';

/**
 * Hit test a label using screen coordinates.
 * @param {Object} screenLabelBounds - {x, y, width, height} in screen coords
 * @param {number} screenX - Screen X coordinate to test
 * @param {number} screenY - Screen Y coordinate to test
 * @returns {boolean} True if point is inside label bounds
 */
export function hitTestLabel(screenLabelBounds, screenX, screenY) {
	if (!screenLabelBounds) return false;
	const b = screenLabelBounds;
	return screenX >= b.x && screenX <= b.x + b.width &&
	       screenY >= b.y && screenY <= b.y + b.height;
}

/**
 * Draw a label and return its bounds for hit testing.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Label text
 * @param {number} anchorX - Screen X anchor point
 * @param {number} anchorY - Screen Y anchor point (label draws above this)
 * @param {boolean} isSelected - Whether the shape is selected
 * @param {string} align - 'left' (label extends right) or 'right' (label extends left)
 * @returns {Object} Label bounds {x, y, width, height} for hit testing
 */
export function drawLabel(ctx, text, anchorX, anchorY, isSelected, align = 'left') {
	ctx.font = '12px sans-serif';
	const metrics = ctx.measureText(text);
	const labelWidth = metrics.width + LABEL_PADDING * 2;

	// Position label above anchor point
	const labelY = anchorY - LABEL_GAP - LABEL_HEIGHT;
	const labelX = align === 'right'
		? anchorX - labelWidth  // Right-align: label extends left from anchor
		: anchorX;              // Left-align: label extends right from anchor

	// Label background
	ctx.fillStyle = isSelected ? LABEL_COLOR_SELECTED : LABEL_COLOR_NORMAL;
	ctx.beginPath();
	ctx.roundRect(labelX, labelY, labelWidth, LABEL_HEIGHT, LABEL_RADIUS);
	ctx.fill();

	// Label text
	ctx.fillStyle = LABEL_TEXT_COLOR;
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'left';
	ctx.fillText(text, labelX + LABEL_PADDING, labelY + LABEL_HEIGHT / 2);

	// Return bounds for hit testing
	return {
		x: labelX,
		y: labelY,
		width: labelWidth,
		height: LABEL_HEIGHT
	};
}
