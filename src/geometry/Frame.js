import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
import {Transform} from './Transform.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';

/**
 * Frame - A rectangular container that establishes a local coordinate system.
 *
 * Shapes assigned to a Frame (via frameId) use frame-local coordinates:
 * - Frame origin (x, y) is where local (0, 0) maps to in world space
 * - Shape at local (10, 20) in a Frame at (100, 200) appears at world (110, 220)
 *
 * When isSymbolSource=true, the Frame acts as a symbol definition.
 * Symbol instances reference the Frame and render its shapes at a different position.
 */
export class Frame extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.FRAME;

		// Transform defines the frame's coordinate system
		this.transform = new Transform();
		this.transform.setPosition(params[0] || 0, params[1] || 0);

		// Frame dimensions (in frame-local space, so always start at 0,0)
		this.width = params[2] || 100;
		this.height = params[3] || 100;
		this.label = params[4] || 'Frame';

		// Symbol source flag
		this.isSymbolSource = false;

		// Parent frame for nested frames (future)
		this.parent = null;

		this.update();
	}

	// Position accessors that delegate to transform
	get x() { return this.transform.x; }
	set x(value) { this.transform.x = value; this.update(); }

	get y() { return this.transform.y; }
	set y(value) { this.transform.y = value; this.update(); }

	update() {
		this.bounds.x = this.x;
		this.bounds.y = this.y;
		this.bounds.width = this.width;
		this.bounds.height = this.height;
	}

	clone() {
		const f = new Frame([this.x, this.y, this.width, this.height, this.label]);
		f.type = this.type;
		f.isSymbolSource = this.isSymbolSource;
		f.groupId = this.groupId;
		f.penStyle = this.penStyle;
		f.colorToken = this.colorToken;
		f.transform.copyFrom(this.transform);
		return f;
	}

	copyFrom(other) {
		this.transform.copyFrom(other.transform);
		this.width = other.width;
		this.height = other.height;
		this.label = other.label;
		this.isSymbolSource = other.isSymbolSource;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	/**
	 * Convert world coordinates to frame-local coordinates.
	 * Accepts either (x, y) or ({x, y}) point object.
	 */
	worldToLocal(worldX, worldY) {
		// Support both (x, y) and ({x, y}) signatures
		if (typeof worldX === 'object') {
			return this.transform.applyInverse(worldX);
		}
		return this.transform.applyInverse({ x: worldX, y: worldY });
	}

	/**
	 * Convert frame-local coordinates to world coordinates.
	 * Accepts either (x, y) or ({x, y}) point object.
	 */
	localToWorld(localX, localY) {
		// Support both (x, y) and ({x, y}) signatures
		if (typeof localX === 'object') {
			return this.transform.apply(localX);
		}
		return this.transform.apply({ x: localX, y: localY });
	}

	/**
	 * Convert a world-space delta to frame-local delta.
	 */
	worldToLocalDelta(dx, dy) {
		return this.transform.applyInverseDelta(dx, dy);
	}

	/**
	 * Convert a frame-local delta to world-space delta.
	 */
	localToWorldDelta(dx, dy) {
		return this.transform.applyDelta(dx, dy);
	}

	// Only the label area is interactive - returns a single POI at label position
	getSnapPOIs() {
		// Label is positioned at top-left, slightly above the frame
		return [
			{ x: this.x, y: this.y }  // 0: label/top-left corner
		];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		// Only the label area is interactive
		// Label is positioned above the frame's top-left corner
		// Approximate label bounds in world coords (label is ~15px tall, variable width)
		const labelHeight = pixelTolerance * 2;  // Use tolerance as rough world-space size
		const labelWidth = pixelTolerance * 8;   // Approximate label width

		const labelBounds = {
			x: this.x,
			y: this.y - labelHeight,
			width: labelWidth,
			height: labelHeight
		};

		// Check if mouse is in label area
		if (mouse.x >= labelBounds.x && mouse.x <= labelBounds.x + labelBounds.width &&
			mouse.y >= labelBounds.y && mouse.y <= labelBounds.y + labelBounds.height) {
			const hitPoint = new Point(this.x, this.y);
			hitPoint.distance = 0;
			return hitPoint;
		}

		return null;
	}

	translate(dx, dy) {
		this.transform.translate(dx, dy);
		this.update();
	}

	scale(anchorX, anchorY, factor) {
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;
		this.width = this.width * Math.abs(factor);
		this.height = this.height * Math.abs(factor);
		this.update();
	}

	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		this.update();
	}

	mirror(x1, y1, x2, y2) {
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;
		this.update();
	}

	// Update control point - label (0) moves the frame
	updateControlPoint(index, newX, newY) {
		if (index === 0) {
			// Label/top-left - move the frame
			this.transform.setPosition(newX, newY);
		}
		this.update();
	}

	getInspectorSchema() {
		// TODO: Create frameSchema in InspectorSchemas.js
		return {
			name: this.isSymbolSource ? this.label : 'Frame',
			sections: [
				{
					title: 'Dimensions',
					fields: [
						{ key: 'width', label: 'Width', type: 'number', precision: 1, step: 10, min: 10 },
						{ key: 'height', label: 'Height', type: 'number', precision: 1, step: 10, min: 10 }
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
					title: 'Symbol',
					fields: [
						{ key: 'label', label: 'Name', type: 'string' }
					]
				}
			]
		};
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			transform: this.transform.toJSON(),
			width: this.width,
			height: this.height,
			label: this.label,
			isSymbolSource: this.isSymbolSource,
			penStyle: this.penStyle,
			colorToken: this.colorToken
		};
	}

	static fromJSON(data) {
		// Support both old format (x, y) and new format (transform)
		const x = data.transform ? data.transform.x : data.x;
		const y = data.transform ? data.transform.y : data.y;
		const frame = new Frame([x, y, data.width, data.height, data.label]);
		frame.type = data.type;
		frame.isSymbolSource = data.isSymbolSource || false;
		if (data.penStyle) frame.penStyle = data.penStyle;
		if (data.colorToken) frame.colorToken = data.colorToken;
		return frame;
	}

	draw(ctx, renderer) {
		const topLeft = renderer.toScreen(this.x, this.y);
		const width = renderer.toScreenScale(this.width);
		const height = renderer.toScreenScale(this.height);

		// Background fill (very light)
		ctx.fillStyle = 'rgba(245, 245, 250, 0.5)';
		ctx.fillRect(topLeft.x, topLeft.y, width, height);

		// Border
		ctx.strokeStyle = this.selected ? '#2563eb' : '#9ca3af';
		ctx.lineWidth = this.selected ? 1.5 : 1;
		ctx.setLineDash([]);
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);

		// Label at top
		if (this.label) {
			ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'bottom';

			const labelX = topLeft.x + 4;
			const labelY = topLeft.y - 4;

			// Label background
			const metrics = ctx.measureText(this.label);
			ctx.fillStyle = this.selected ? '#2563eb' : '#6b7280';
			ctx.fillRect(labelX - 2, labelY - 12, metrics.width + 4, 14);

			// Label text
			ctx.fillStyle = '#ffffff';
			ctx.fillText(this.label, labelX, labelY);
		}
	}

	// Frames don't draw handles like other shapes
	drawHandles(ctx, renderer) {
		// No handles - frame is dragged by its border/content
	}
}
