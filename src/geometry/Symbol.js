import { Shape, Geometry } from './Geometry.js';
import { Rectangle } from './Rectangle.js';
import {symbolSchema} from './InspectorSchemas.js';

/**
 * Symbol Definition - a reusable template of shapes
 */
export class SymbolDefinition {
	constructor(name, shapes = [], anchorX = 0, anchorY = 0) {
		this.name = name;
		this.id = `sym_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		this.created = Date.now();

		// Store shapes relative to anchor point
		this.shapes = [];
		this.anchorX = anchorX;
		this.anchorY = anchorY;

		// Deep clone shapes and offset to anchor
		for (const shape of shapes) {
			const clone = shape.clone();
			clone.translate(-anchorX, -anchorY);
			clone.selected = false;
			this.shapes.push(clone);
		}

		this.updateBounds();
	}

	updateBounds() {
		if (this.shapes.length === 0) {
			this.bounds = new Rectangle(0, 0, 0, 0);
			return;
		}

		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;

		for (const shape of this.shapes) {
			if (shape.bounds) {
				minX = Math.min(minX, shape.bounds.x);
				minY = Math.min(minY, shape.bounds.y);
				maxX = Math.max(maxX, shape.bounds.x + shape.bounds.width);
				maxY = Math.max(maxY, shape.bounds.y + shape.bounds.height);
			}
		}

		this.bounds = new Rectangle(minX, minY, maxX - minX, maxY - minY);
	}

	// Serialize for storage
	toJSON() {
		return {
			name: this.name,
			id: this.id,
			created: this.created,
			anchorX: this.anchorX,
			anchorY: this.anchorY,
			shapes: this.shapes.map(s => s.toJSON())
		};
	}

	// Deserialize - needs shape factory from FileManager
	static fromJSON(json, shapeFactory) {
		const def = new SymbolDefinition(json.name, [], json.anchorX, json.anchorY);
		def.id = json.id;
		def.created = json.created;

		// Recreate shapes using factory
		def.shapes = [];
		for (const shapeData of json.shapes) {
			const shape = shapeFactory(shapeData);
			if (shape) {
				def.shapes.push(shape);
			}
		}

		def.updateBounds();
		return def;
	}
}

/**
 * Symbol Instance - a placed reference to a symbol definition
 */
export class SymbolInstance extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.SYMBOL;

		// params: [x, y, definitionId, rotation, scaleX, scaleY]
		this.x = params[0] || 0;
		this.y = params[1] || 0;
		this.definitionId = params[2] || null;
		this.rotation = params[3] || 0;
		this.scaleX = params[4] !== undefined ? params[4] : 1;
		this.scaleY = params[5] !== undefined ? params[5] : 1;

		// Reference to actual definition (set by library)
		this._definition = null;

		this.update();
	}

	// Get/set definition
	get definition() {
		return this._definition;
	}

	set definition(def) {
		this._definition = def;
		this.update();
	}

	update() {
		if (!this._definition) {
			this.bounds.x = this.x;
			this.bounds.y = this.y;
			this.bounds.width = 20;
			this.bounds.height = 20;
			return;
		}

		// Transform definition bounds
		const defBounds = this._definition.bounds;
		const cos = Math.cos(this.rotation);
		const sin = Math.sin(this.rotation);

		// Calculate transformed bounding box (simplified - axis-aligned)
		const w = Math.abs(defBounds.width * this.scaleX * cos) + Math.abs(defBounds.height * this.scaleY * sin);
		const h = Math.abs(defBounds.width * this.scaleX * sin) + Math.abs(defBounds.height * this.scaleY * cos);

		this.bounds.x = this.x + defBounds.x * this.scaleX - w/2;
		this.bounds.y = this.y + defBounds.y * this.scaleY - h/2;
		this.bounds.width = w;
		this.bounds.height = h;
	}

	clone() {
		const inst = new SymbolInstance([
			this.x, this.y, this.definitionId,
			this.rotation, this.scaleX, this.scaleY
		]);
		inst._definition = this._definition;
		inst.penStyle = this.penStyle;
		inst.groupId = this.groupId;
		return inst;
	}

	copyFrom(other) {
		this.x = other.x;
		this.y = other.y;
		this.definitionId = other.definitionId;
		this.rotation = other.rotation;
		this.scaleX = other.scaleX;
		this.scaleY = other.scaleY;
		this._definition = other._definition;
		this.update();
	}

	// Transform a point from definition space to world space
	transformPoint(px, py) {
		const cos = Math.cos(this.rotation);
		const sin = Math.sin(this.rotation);

		// Scale, then rotate, then translate
		const sx = px * this.scaleX;
		const sy = py * this.scaleY;

		return {
			x: this.x + sx * cos - sy * sin,
			y: this.y + sx * sin + sy * cos
		};
	}

	// Transform a point from world space to definition space
	inverseTransformPoint(wx, wy) {
		const cos = Math.cos(-this.rotation);
		const sin = Math.sin(-this.rotation);

		// Inverse: translate, then rotate, then scale
		const dx = wx - this.x;
		const dy = wy - this.y;

		const rx = dx * cos - dy * sin;
		const ry = dx * sin + dy * cos;

		return {
			x: rx / this.scaleX,
			y: ry / this.scaleY
		};
	}

	// Snap points: include POIs from all shapes in the definition
	getSnapPOIs() {
		const pois = [
			{ x: this.x, y: this.y }  // anchor point first
		];

		if (!this._definition) {
			return pois;
		}

		// Get POIs from each shape in the definition and transform them
		for (const shape of this._definition.shapes) {
			const shapePOIs = shape.getSnapPOIs();
			for (const poi of shapePOIs) {
				const transformed = this.transformPoint(poi.x, poi.y);
				// Copy snap type if present
				if (poi.type) {
					transformed.type = poi.type;
				}
				pois.push(transformed);
			}
		}

		return pois;
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		if (!this._definition) {
			return null;
		}

		// Transform mouse to definition space
		const localMouse = this.inverseTransformPoint(mouse.x, mouse.y);

		// Scale the tolerance to definition space
		const localTolerance = pixelTolerance / Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY));

		// Create a local mouse rect
		const localMouseRect = {
			x: localMouse.x - localTolerance,
			y: localMouse.y - localTolerance,
			width: localTolerance * 2,
			height: localTolerance * 2,
			intersects: (other) => {
				return !(localMouseRect.x > other.x + other.width ||
						 localMouseRect.x + localMouseRect.width < other.x ||
						 localMouseRect.y > other.y + other.height ||
						 localMouseRect.y + localMouseRect.height < other.y);
			}
		};

		// Check each shape in the definition
		let closest = null;
		let closestDist = Infinity;

		for (const shape of this._definition.shapes) {
			const snap = shape.getGeoSnap(localMouse, localMouseRect, localTolerance);
			if (snap && snap.distance < closestDist) {
				closest = snap;
				closestDist = snap.distance;
			}
		}

		if (closest) {
			// Transform result back to world space
			const worldPoint = this.transformPoint(closest.x, closest.y);
			return {
				x: worldPoint.x,
				y: worldPoint.y,
				distance: closest.distance * Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY))
			};
		}

		return null;
	}

	translate(dx, dy) {
		this.x += dx;
		this.y += dy;
		this.update();
	}

	scale(anchorX, anchorY, factor) {
		this.x = anchorX + (this.x - anchorX) * factor;
		this.y = anchorY + (this.y - anchorY) * factor;
		this.scaleX *= factor;
		this.scaleY *= factor;
		this.update();
	}

	rotate(anchorX, anchorY, angle) {
		// Rotate position around anchor
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const dx = this.x - anchorX;
		const dy = this.y - anchorY;
		this.x = anchorX + dx * cos - dy * sin;
		this.y = anchorY + dx * sin + dy * cos;

		// Add to rotation
		this.rotation += angle;
		this.update();
	}

	mirror(x1, y1, x2, y2) {
		// Mirror position
		const dx = x2 - x1;
		const dy = y2 - y1;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len === 0) return;

		const nx = dx / len;
		const ny = dy / len;

		const px = this.x - x1;
		const py = this.y - y1;
		const dot = px * nx + py * ny;

		this.x = x1 + 2 * dot * nx - px;
		this.y = y1 + 2 * dot * ny - py;

		// Mirror rotation
		const lineAngle = Math.atan2(dy, dx);
		this.rotation = 2 * lineAngle - this.rotation;

		// Flip scale
		this.scaleX *= -1;

		this.update();
	}

	updateControlPoint(index, newX, newY) {
		if (index === 4) {
			// Move anchor point
			this.x = newX;
			this.y = newY;
		}
		this.update();
	}

	// Explode symbol into individual shapes (for converting to regular geometry)
	explode() {
		if (!this._definition) return [];

		const shapes = [];

		for (const defShape of this._definition.shapes) {
			const shape = defShape.clone();

			// Apply instance transform to each shape
			// First scale, then rotate, then translate
			shape.scale(0, 0, this.scaleX); // Simplified - assumes uniform scale

			// Rotate around origin
			if (this.rotation !== 0) {
				shape.rotate(0, 0, this.rotation);
			}

			// Translate to instance position
			shape.translate(this.x, this.y);

			shapes.push(shape);
		}

		return shapes;
	}

	// Get transformed shapes for rendering (lightweight, reuses definition shapes)
	getShapesForRender() {
		if (!this._definition) return [];

		const shapes = [];

		for (const defShape of this._definition.shapes) {
			const shape = defShape.clone();

			// Apply instance transform: scale, rotate, translate
			if (this.scaleX !== 1 || this.scaleY !== 1) {
				shape.scale(0, 0, this.scaleX); // Note: assumes uniform for now
			}

			if (this.rotation !== 0) {
				shape.rotate(0, 0, this.rotation);
			}

			shape.translate(this.x, this.y);

			// Inherit selection state from symbol instance
			shape.selected = this.selected;

			// Mark as coming from a symbol (for renderer reference)
			shape._symbolInstance = this;

			shapes.push(shape);
		}

		return shapes;
	}

	getInspectorSchema() {
		return symbolSchema(this);
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			x: this.x,
			y: this.y,
			definitionId: this.definitionId,
			rotation: this.rotation,
			scaleX: this.scaleX,
			scaleY: this.scaleY
		};
	}

	static fromJSON(data) {
		const inst = new SymbolInstance([
			data.x, data.y, data.definitionId,
			data.rotation, data.scaleX, data.scaleY
		]);
		inst.type = data.type;
		if (data.penStyle) inst.penStyle = data.penStyle;
		return inst;
	}
}
