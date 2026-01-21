import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';

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
		this.penStyle = other.penStyle;
		this.update();
	}

	// Snap points: corners, center, edge midpoints (using display dimensions)
	getSnapPOIs() {
		const w = this.getDisplayWidth();
		const h = this.getDisplayHeight();
		return [
			{ x: this.x, y: this.y },                    // top-left
			{ x: this.x + w, y: this.y },                // top-right
			{ x: this.x + w, y: this.y + h },            // bottom-right
			{ x: this.x, y: this.y + h },                // bottom-left
			{ x: this.x + w / 2, y: this.y + h / 2 },    // center
			{ x: this.x + w / 2, y: this.y },            // top-mid
			{ x: this.x + w, y: this.y + h / 2 },        // right-mid
			{ x: this.x + w / 2, y: this.y + h },        // bottom-mid
			{ x: this.x, y: this.y + h / 2 }             // left-mid
		];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		// Quick reject
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		const w = this.getDisplayWidth();
		const h = this.getDisplayHeight();

		// Check if mouse is inside the paper (for selection/dragging)
		if (mouse.x >= this.x && mouse.x <= this.x + w &&
			mouse.y >= this.y && mouse.y <= this.y + h) {
			// Return the mouse point as a hit (distance 0 means inside)
			const hitPoint = new Point(mouse.x, mouse.y);
			hitPoint.distance = 0;
			return hitPoint;
		}

		// Check distance to each edge for snapping near edges
		const edges = [
			{ x1: this.x, y1: this.y, x2: this.x + w, y2: this.y },         // top
			{ x1: this.x + w, y1: this.y, x2: this.x + w, y2: this.y + h }, // right
			{ x1: this.x, y1: this.y + h, x2: this.x + w, y2: this.y + h }, // bottom
			{ x1: this.x, y1: this.y, x2: this.x, y2: this.y + h }          // left
		];

		let closestPoint = null;
		let closestDist = Infinity;

		for (const edge of edges) {
			const start = { x: edge.x1, y: edge.y1 };
			const end = { x: edge.x2, y: edge.y2 };
			const point = VectorUtils.closestPointOnSegment(mouse, start, end);
			const dist = VectorUtils.distance(mouse, point);

			if (dist < closestDist && dist < pixelTolerance) {
				closestDist = dist;
				closestPoint = new Point(point.x, point.y);
				closestPoint.distance = dist;
			}
		}

		return closestPoint;
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

	// Update control point by index (only center for movement)
	// POI indices: 0=TL, 1=TR, 2=BR, 3=BL, 4=center, 5-8=edge midpoints
	updateControlPoint(index, newX, newY) {
		if (index === 4) {
			// Center - move the paper
			const w = this.getDisplayWidth();
			const h = this.getDisplayHeight();
			const cx = this.x + w / 2;
			const cy = this.y + h / 2;
			this.x += newX - cx;
			this.y += newY - cy;
		}
		// Corners (0-3) no longer resize - use inspector to change size/scale
		this.update();
	}

	getInspectorSchema() {
		const sizeOptions = Object.entries(PaperSizes).map(([key, size]) => ({
			value: key.toLowerCase(),
			label: `${size.name} (${size.width} × ${size.height} mm)`
		}));
		sizeOptions.push({ value: 'custom', label: 'Custom' });

		return {
			name: 'Paper',
			sections: [
				{
					title: 'Size',
					fields: [
						{
							key: 'paperSize',
							label: 'Preset',
							type: 'select',
							options: sizeOptions,
							set: (v) => {
								this.paperSize = v;
								const preset = PaperSizes[v.toUpperCase()];
								if (preset) {
									this.width = preset.width;
									this.height = preset.height;
								}
							}
						},
						{
							key: 'width',
							label: 'Width',
							type: 'number',
							precision: 1,
							step: 1,
							min: 10,
							suffix: ' mm'
						},
						{
							key: 'height',
							label: 'Height',
							type: 'number',
							precision: 1,
							step: 1,
							min: 10,
							suffix: ' mm'
						}
					]
				},
				{
					title: 'Position',
					fields: [
						{ key: 'x', label: 'X', type: 'number', precision: 2, step: 1 },
						{ key: 'y', label: 'Y', type: 'number', precision: 2, step: 1 }
					]
				},
				{
					title: 'Export',
					fields: [
						{
							key: 'scale',
							label: 'Scale',
							type: 'number',
							precision: 0,
							step: 10,
							min: 10,
							max: 1000,
							suffix: '%'
						}
					]
				}
			]
		};
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
			paperSize: this.paperSize,
			scale: this.scale
		};
	}

	static fromJSON(data) {
		const paper = new Paper([data.x, data.y, data.width, data.height, data.paperSize, data.scale]);
		paper.type = data.type;
		if (data.penStyle) paper.penStyle = data.penStyle;
		return paper;
	}

	draw(ctx, renderer) {
		// Scale factor: 50% scale means paper displays 2x size (inverse)
		const displayScale = 100 / (this.scale || 100);
		const displayWidth = this.width * displayScale;
		const displayHeight = this.height * displayScale;

		const topLeft = renderer.toScreen(this.x, this.y);
		const width = renderer.toScreenScale(displayWidth);
		const height = renderer.toScreenScale(displayHeight);

		// Border
		ctx.strokeStyle = this.selected ? '#2563eb' : '#CCCCCC';
		ctx.lineWidth = this.selected ? 1 : 0.5;
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);
	}
}
