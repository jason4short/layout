/**
 * OutlineText - Text rendered as vector outlines for laser cutting
 * Uses opentype.js to convert text to bezier paths
 */

import { Geometry, Shape, PenStyle, SnapType } from './Geometry.js';
import { Rectangle } from './Rectangle.js';
import { Line } from './Line.js';
import { Spline } from './Spline.js';
import * as TransformUtils from './utils/TransformUtils.js';
import fontManager from '../core/FontManager.js';
import { outlineTextSchema } from './InspectorSchemas.js';
import { serializeOutlineText, deserializeOutlineText } from './GeometrySerializers.js';

export class OutlineText extends Geometry {
	constructor(params = []) {
		super();

		this.geometry = Shape.OUTLINE_TEXT;
		this.type = Shape.PLAIN;
		this.penStyle = PenStyle.VISIBLE;

		// Position (baseline left)
		this.x = params[0] || 0;
		this.y = params[1] || 0;

		// Text content
		this.text = params[2] || 'Text';

		// Font properties
		this.fontSize = params[3] || 20;
		this.fontFamily = params[4] || 'Roboto';
		this.fontWeight = 'normal';
		this.fontStyle = 'normal';

		// Cached opentype path (regenerated on property change)
		this.cachedPath = null;
		this.cachedFont = null;
		this.fontLoaded = false;

		// Start loading font
		this.loadFont();
	}

	/**
	 * Load the font asynchronously
	 */
	async loadFont() {
		try {
			this.cachedFont = await fontManager.loadFont(
				this.fontFamily,
				this.fontWeight,
				this.fontStyle
			);
			this.fontLoaded = true;
			this.invalidateCache();
			this.update();
		} catch (err) {
			console.error('Failed to load font:', err);
		}
	}

	/**
	 * Invalidate cached path (call when properties change)
	 */
	invalidateCache() {
		this.cachedPath = null;
	}

	/**
	 * Get or generate the opentype path
	 */
	getPath() {
		if (!this.cachedFont || !this.fontLoaded) {
			return null;
		}

		if (!this.cachedPath) {
			// opentype uses Y-up, canvas uses Y-down
			// Generate path at origin, we'll transform during draw
			this.cachedPath = fontManager.getTextPath(
				this.cachedFont,
				this.text,
				0,
				0,
				this.fontSize
			);
		}

		return this.cachedPath;
	}

	/**
	 * Update bounds based on text path
	 */
	update() {
		if (!this.cachedFont || !this.fontLoaded || !this.text) {
			// Default bounds while font loads
			this.bounds = new Rectangle(
				this.x,
				this.y - this.fontSize,
				this.fontSize * this.text.length * 0.6,
				this.fontSize
			);
			return;
		}

		const bbox = fontManager.getTextBounds(
			this.cachedFont,
			this.text,
			0,
			0,
			this.fontSize
		);

		// opentype outputs canvas-ready coordinates
		this.bounds = new Rectangle(
			this.x + bbox.x1,
			this.y + bbox.y1,
			bbox.x2 - bbox.x1,
			bbox.y2 - bbox.y1
		);
	}

	/**
	 * Clone this shape
	 */
	clone() {
		const c = new OutlineText([
			this.x,
			this.y,
			this.text,
			this.fontSize,
			this.fontFamily
		]);
		c.fontWeight = this.fontWeight;
		c.fontStyle = this.fontStyle;
		c.penStyle = this.penStyle;
		c.colorToken = this.colorToken;
		c.groupId = this.groupId;
		return c;
	}

	/**
	 * Copy properties from another OutlineText
	 */
	copyFrom(other) {
		this.x = other.x;
		this.y = other.y;
		this.text = other.text;
		this.fontSize = other.fontSize;
		this.fontFamily = other.fontFamily;
		this.fontWeight = other.fontWeight;
		this.fontStyle = other.fontStyle;
		this.penStyle = other.penStyle;
		this.colorToken = other.colorToken;
		this.invalidateCache();
		this.loadFont();
	}

	/**
	 * Get snap points
	 */
	getSnapPOIs() {
		return [
			{ x: this.x, y: this.y, type: SnapType.ENDPOINT },
			{ x: this.bounds.x, y: this.bounds.y, type: SnapType.CORNER },
			{ x: this.bounds.x + this.bounds.width, y: this.bounds.y, type: SnapType.CORNER },
			{ x: this.bounds.x, y: this.bounds.y + this.bounds.height, type: SnapType.CORNER },
			{ x: this.bounds.x + this.bounds.width, y: this.bounds.y + this.bounds.height, type: SnapType.CORNER }
		];
	}

	/**
	 * Get selectable point indices
	 */
	getSelectableIndices() {
		return [0];  // Only anchor point is draggable
	}

	/**
	 * Update control point position
	 */
	updateControlPoint(index, newX, newY) {
		if (index === 0) {
			this.x = newX;
			this.y = newY;
		}
		this.update();
	}

	/**
	 * Get control point type
	 */
	getControlPointType(index) {
		return 'move';
	}

	/**
	 * Hit test for selection
	 */
	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		// Simple bounds check for now
		if (mouse.x >= this.bounds.x - pixelTolerance &&
			mouse.x <= this.bounds.x + this.bounds.width + pixelTolerance &&
			mouse.y >= this.bounds.y - pixelTolerance &&
			mouse.y <= this.bounds.y + this.bounds.height + pixelTolerance) {
			return { x: mouse.x, y: mouse.y, distance: 0 };
		}

		return null;
	}

	/**
	 * Translate the shape
	 */
	translate(dx, dy) {
		this.x += dx;
		this.y += dy;
		this.update();
	}

	/**
	 * Scale the shape
	 */
	scale(anchorX, anchorY, factor) {
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;
		this.fontSize *= Math.abs(factor);
		this.invalidateCache();
		this.update();
	}

	/**
	 * Rotate the shape
	 */
	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		// Note: text rotation would require storing a rotation angle
		// For now, just move the anchor point
		this.update();
	}

	/**
	 * Mirror the shape
	 */
	mirror(x1, y1, x2, y2) {
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;
		this.update();
	}

	/**
	 * Break apart into individual shapes (Lines and Splines)
	 * opentype outputs canvas-ready coordinates (Y-down)
	 */
	breakApart() {
		const shapes = [];
		const path = this.getPath();

		if (!path || !path.commands) {
			return shapes;
		}

		let currentX = 0;
		let currentY = 0;
		let startX = 0;
		let startY = 0;

		for (const cmd of path.commands) {
			switch (cmd.type) {
				case 'M':
					// Move to
					currentX = this.x + cmd.x;
					currentY = this.y + cmd.y;
					startX = currentX;
					startY = currentY;
					break;

				case 'L':
					// Line to
					const lineEndX = this.x + cmd.x;
					const lineEndY = this.y + cmd.y;
					if (currentX !== lineEndX || currentY !== lineEndY) {
						const line = new Line([currentX, currentY, lineEndX, lineEndY]);
						line.penStyle = this.penStyle;
						line.colorToken = this.colorToken;
						shapes.push(line);
					}
					currentX = lineEndX;
					currentY = lineEndY;
					break;

				case 'C':
					// Cubic bezier
					const spline = new Spline([
						currentX, currentY,
						this.x + cmd.x1, this.y + cmd.y1,
						this.x + cmd.x2, this.y + cmd.y2,
						this.x + cmd.x, this.y + cmd.y
					]);
					spline.penStyle = this.penStyle;
					spline.colorToken = this.colorToken;
					shapes.push(spline);
					currentX = this.x + cmd.x;
					currentY = this.y + cmd.y;
					break;

				case 'Q':
					// Quadratic bezier - convert to cubic
					const qEndX = this.x + cmd.x;
					const qEndY = this.y + cmd.y;
					const qCtrlX = this.x + cmd.x1;
					const qCtrlY = this.y + cmd.y1;

					// Convert quadratic to cubic control points
					const cp1x = currentX + 2/3 * (qCtrlX - currentX);
					const cp1y = currentY + 2/3 * (qCtrlY - currentY);
					const cp2x = qEndX + 2/3 * (qCtrlX - qEndX);
					const cp2y = qEndY + 2/3 * (qCtrlY - qEndY);

					const qSpline = new Spline([
						currentX, currentY,
						cp1x, cp1y,
						cp2x, cp2y,
						qEndX, qEndY
					]);
					qSpline.penStyle = this.penStyle;
					qSpline.colorToken = this.colorToken;
					shapes.push(qSpline);
					currentX = qEndX;
					currentY = qEndY;
					break;

				case 'Z':
					// Close path - line back to start
					if (currentX !== startX || currentY !== startY) {
						const closeLine = new Line([currentX, currentY, startX, startY]);
						closeLine.penStyle = this.penStyle;
						closeLine.colorToken = this.colorToken;
						shapes.push(closeLine);
					}
					currentX = startX;
					currentY = startY;
					break;
			}
		}

		return shapes;
	}

	/**
	 * Get inspector schema
	 */
	getInspectorSchema() {
		return outlineTextSchema(this);
	}

	/**
	 * Serialize to JSON
	 */
	toJSON() {
		return serializeOutlineText(this);
	}

	/**
	 * Deserialize from JSON
	 */
	static fromJSON(data) {
		return deserializeOutlineText(data, OutlineText);
	}

	/**
	 * Draw the outline text
	 */
	draw(ctx, renderer) {
		const path = this.getPath();

		if (!path) {
			// Font not loaded yet - draw placeholder
			const screenPos = renderer.toScreen(this.x, this.y);
			ctx.strokeStyle = this.selected ? '#FF0000' : '#999';
			ctx.lineWidth = 1;
			ctx.setLineDash([2, 2]);
			ctx.strokeRect(
				screenPos.x,
				screenPos.y,
				renderer.toScreenScale(this.fontSize * this.text.length * 0.6),
				renderer.toScreenScale(this.fontSize)
			);
			ctx.setLineDash([]);
			return;
		}

		// Apply pen style
		renderer.applyPenStyle(ctx, this);

		// Get screen position of anchor point
		const screenPos = renderer.toScreen(this.x, this.y);
		const scale = renderer.toScreenScale(1);

		// Save context and apply zoom transform
		ctx.save();
		ctx.translate(screenPos.x, screenPos.y);
		ctx.scale(scale, scale);  // Apply zoom (opentype outputs canvas-ready coords)

		// Draw the path at origin (transform handles positioning)
		ctx.beginPath();

		for (const cmd of path.commands) {
			switch (cmd.type) {
				case 'M':
					ctx.moveTo(cmd.x, cmd.y);
					break;
				case 'L':
					ctx.lineTo(cmd.x, cmd.y);
					break;
				case 'C':
					ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
					break;
				case 'Q':
					ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
					break;
				case 'Z':
					ctx.closePath();
					break;
			}
		}

		ctx.stroke();
		ctx.restore();
		renderer.resetPenStyle(ctx);
	}
}
