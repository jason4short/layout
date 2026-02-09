import {Shape, Geometry} from './Geometry.js';
import * as TransformUtils from './utils/TransformUtils.js';
import {paperSchema} from './InspectorSchemas.js';
import {serializePaper, deserializePaper} from './GeometrySerializers.js';
import units from '../core/Units.js';
import * as LabelUtils from './utils/LabelUtils.js';

// Standard paper sizes in mm
export const PaperSizes = Object.freeze({
	LETTER: { name: 'Letter', width: 215.9, height: 279.4 },
	LEGAL: { name: 'Legal', width: 215.9, height: 355.6 },
	TABLOID: { name: 'Tabloid', width: 279.4, height: 431.8 },
	A4: { name: 'A4', width: 210, height: 297 },
	A3: { name: 'A3', width: 297, height: 420 },
	A2: { name: 'A2', width: 420, height: 594 },
	A1: { name: 'A1', width: 594, height: 841 },
	A0: { name: 'A0', width: 841, height: 1189 }
});

export class Paper extends Geometry
{
	constructor(params)
	{
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.PAPER;

		// params: [x, y, width, height, paperSize, scale]
		this.x = params[0];
		this.y = params[1];
		this.width = params[2];
		this.height = params[3];
		this.paperSize = params[4] || 'custom';
		this.scale = params[5] !== undefined ? params[5] : 100; // Print scale percentage

		// Paper doesn't use pen styles or colors
		this.penStyle = null;
		this.colorToken = null;

		// Screen-space label bounds (updated during draw)
		this.screenLabelBounds = null;

		this.update();
	}

	// Get display dimensions (scaled for on-screen display)
	// 50% scale = 2x display size (inverse relationship)
	getDisplayScale() {
		return 100 / (this.scale || 100);
	}

	getDisplayWidth() {
		return this.width * this.getDisplayScale();
	}

	getDisplayHeight() {
		return this.height * this.getDisplayScale();
	}

	// Get dimension string for label (e.g., "11" x 17"" or "279 x 432 mm")
	getDimensionString() {
		const w = units.format(this.width, undefined, false);
		const h = units.format(this.height, undefined, false);
		const unitLabel = units.getUnit();
		return `${w} x ${h} ${unitLabel}`;
	}

	/**
	 * Get the display label for this paper.
	 * Paper displays its dimensions as the label (not editable).
	 * @returns {string} Formatted dimension string
	 */
	getLabel() {
		return this.getDimensionString();
	}

	/**
	 * Paper is NOT a container - it's a print reference area.
	 * Shapes are not "inside" a Paper; it just defines a printable region.
	 * Use Frame for containing shapes in a local coordinate system.
	 * @returns {boolean} Always false
	 */
	isContainer() {
		return false;
	}

	// Hit test the label using screen coordinates
	hitTestLabel(screenX, screenY) {
		return LabelUtils.hitTestLabel(this.screenLabelBounds, screenX, screenY);
	}

	update() {
		// Bounds use display dimensions for hit testing
		this.bounds.x = this.x;
		this.bounds.y = this.y;
		this.bounds.width = this.getDisplayWidth();
		this.bounds.height = this.getDisplayHeight();
	}

	clone() {
		const p = new Paper([this.x, this.y, this.width, this.height, this.paperSize, this.scale]);
		p.type = this.type;
		p.groupId = this.groupId;
		return p;
	}

	copyFrom(other) {
		this.x = other.x;
		this.y = other.y;
		this.width = other.width;
		this.height = other.height;
		this.paperSize = other.paperSize;
		this.scale = other.scale;
		this.type = other.type;
		this.geometry = other.geometry;
		this.update();
	}

	// Paper is not part of the snap system - returns empty array
	getSnapPOIs() {
		return [];
	}

	// Paper is not part of the snap system - always returns null
	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		return null;
	}

	// Translate the paper
	translate(dx, dy) {
		this.x += dx;
		this.y += dy;
		this.update();
	}

	// Scale relative to anchor point
	scale(anchorX, anchorY, factor) {
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;
		this.width = this.width * Math.abs(factor);
		this.height = this.height * Math.abs(factor);
		this.paperSize = 'custom'; // No longer a standard size
		this.update();
	}

	// Rotate around anchor (paper becomes custom after rotation)
	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		// Note: Paper doesn't support rotation of its own orientation
		this.update();
	}

	// Mirror across line
	mirror(x1, y1, x2, y2) {
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;
		this.update();
	}

	// Paper doesn't use control points - drag via translate()
	updateControlPoint(index, newX, newY) {
		// No-op: Paper uses translate() for movement
	}

	getInspectorSchema() {
		return paperSchema(this);
	}

	toJSON() {
		return serializePaper(this);
	}

	static fromJSON(data) {
		return deserializePaper(data, Paper);
	}

	draw(ctx, renderer) {
		// Scale factor: 50% scale means paper displays 2x size (inverse)
		const displayScale = 100 / (this.scale || 100);
		const displayWidth = this.width * displayScale;
		const displayHeight = this.height * displayScale;

		const topLeft = renderer.toScreen(this.x, this.y);
		const width = renderer.toScreenScale(displayWidth);
		const height = renderer.toScreenScale(displayHeight);

		// Paper fill (subtle light background)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
		ctx.fillRect(topLeft.x, topLeft.y, width, height);

		// Paper border (always light gray, not selectable)
		ctx.strokeStyle = '#CCCCCC';
		ctx.lineWidth = 0.5;
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);

		// Draw label above paper
		const text = this.getLabel();
		this.screenLabelBounds = LabelUtils.drawLabel(ctx, text, topLeft.x, topLeft.y, this.selected);
	}
}
