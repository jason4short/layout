import { Shape, Geometry, SnapType } from './Geometry.js';
import { Rectangle } from './Rectangle.js';
import * as LabelUtils from './utils/LabelUtils.js';
import data from '../data/Data.js';
import { BreakApartInstanceCommand } from '../core/Commands.js';
import undoManager from '../core/UndoManager.js';
import stage from '../core/Stage.js';

/**
 * Symbol Instance - a reference to a source Frame displayed at a different position.
 *
 * Source shapes are stored in world coordinates (at the source frame's position).
 * Instances calculate an offset from the source frame to render shapes at a new location.
 * This enables live updates: editing source shapes immediately reflects in all instances.
 */
export class SymbolInstance extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.SYMBOL;

		// params: [sourceFrameId, x, y]
		this.sourceFrameId = params[0] || null;
		this.x = params[1] || 0;
		this.y = params[2] || 0;

		// Library reference (for instances from linked libraries)
		this.libraryDocId = null;
		this.libraryFrameId = null;

		// Screen-space label bounds (updated during draw)
		this.screenLabelBounds = null;

		this.update();
	}

	/**
	 * Get the source Frame.
	 * For local symbols: looks up by sourceFrameId in data.
	 * For library symbols: looks up cached frame from SymbolLibrary.
	 */
	getSourceFrame() {
		if (this.libraryDocId && this.libraryFrameId) {
			const entry = data.libraryCache.get(`${this.libraryDocId}:${this.libraryFrameId}`);
			return entry ? entry.frame : null;
		}
		if (!this.sourceFrameId) return null;
		return data.getFrame(this.sourceFrameId);
	}

	/**
	 * Get the shapes belonging to the source Frame.
	 * For local symbols: looks up by sourceFrameId in data.
	 * For library symbols: looks up cached shapes from SymbolLibrary.
	 */
	getSourceShapes() {
		if (this.libraryDocId && this.libraryFrameId) {
			const entry = data.libraryCache.get(`${this.libraryDocId}:${this.libraryFrameId}`);
			return entry ? entry.shapes : [];
		}
		if (!this.sourceFrameId) return [];
		return data.getFrameShapes(this.sourceFrameId);
	}

	/**
	 * Whether this instance references a linked library symbol.
	 */
	isLibraryInstance() {
		return !!(this.libraryDocId && this.libraryFrameId);
	}

	/**
	 * Get offset from source frame to instance position.
	 * With local coords model:
	 * - Source shapes are in frame-local coords
	 * - Instance position is in world coords
	 * - To render: localToWorld(sourceShape) then translate by offset
	 *
	 * For translation-only: offset = instancePos - framePos
	 * Result = localShapeCoords + framePos + offset = localShapeCoords + instancePos
	 */
	getOffset() {
		const frame = this.getSourceFrame();
		if (!frame) return { x: 0, y: 0 };
		return {
			x: this.x - frame.x,
			y: this.y - frame.y
		};
	}

	/**
	 * Update bounds based on source shapes + instance position.
	 * Source shapes are in FRAME-LOCAL coords.
	 * Instance bounds are in WORLD coords at instance position.
	 */
	update() {
		const sourceShapes = this.getSourceShapes();
		const sourceFrame = this.getSourceFrame();

		if (!sourceFrame || sourceShapes.length === 0) {
			this.bounds.x = this.x;
			this.bounds.y = this.y;
			this.bounds.width = 20;
			this.bounds.height = 20;
			return;
		}

		// Calculate bounds from source shapes (in local coords)
		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;

		for (const shape of sourceShapes) {
			const b = shape.bounds;
			minX = Math.min(minX, b.x);
			minY = Math.min(minY, b.y);
			maxX = Math.max(maxX, b.x + b.width);
			maxY = Math.max(maxY, b.y + b.height);
		}

		// Instance bounds = source bounds + instance position
		this.bounds.x = minX + this.x;
		this.bounds.y = minY + this.y;
		this.bounds.width = maxX - minX;
		this.bounds.height = maxY - minY;
	}

	/**
	 * Get the display label for this symbol instance.
	 * Uses the source frame's label, or 'Instance' if no source frame.
	 * @returns {string} Label text
	 */
	getLabel() {
		const frame = this.getSourceFrame();
		return frame ? frame.label : 'Instance';
	}

	/**
	 * SymbolInstance is NOT a container - it references shapes from a source Frame.
	 * The shapes are rendered at the instance's position but belong to the source Frame.
	 * @returns {boolean} Always false
	 */
	isContainer() {
		return false;
	}

	// Hit test the label using screen coordinates
	hitTestLabel(screenX, screenY) {
		return LabelUtils.hitTestLabel(this.screenLabelBounds, screenX, screenY);
	}

	// Draw the symbol label (when selected or part of selected group)
	draw(ctx, renderer) {
		const isSelected = this.selected || data.isGroupSelected(this.groupId);
		if (!isSelected) return;

		const text = this.getLabel();

		// Calculate label position at top-right of bounds
		const topRight = renderer.toScreen(this.bounds.x + this.bounds.width, this.bounds.y);
		this.screenLabelBounds = LabelUtils.drawLabel(ctx, text, topRight.x, topRight.y, isSelected, 'right');
	}

	clone() {
		const inst = new SymbolInstance([
			this.sourceFrameId,
			this.x,
			this.y
		]);
		inst.libraryDocId = this.libraryDocId;
		inst.libraryFrameId = this.libraryFrameId;
		inst.penStyle = this.penStyle;
		inst.colorToken = this.colorToken;
		return inst;
	}

	copyFrom(other) {
		this.sourceFrameId = other.sourceFrameId;
		this.libraryDocId = other.libraryDocId;
		this.libraryFrameId = other.libraryFrameId;
		this.x = other.x;
		this.y = other.y;
		this.update();
	}

	/**
	 * Get snap points of interest.
	 * Source POIs are in FRAME-LOCAL coords.
	 * Transform to world coords at instance position.
	 */
	getSnapPOIs() {
		const pois = [];
		const sourceShapes = this.getSourceShapes();
		const sourceFrame = this.getSourceFrame();

		if (!sourceFrame) return pois;

		for (const shape of sourceShapes) {
			const shapePOIs = shape.getSnapPOIs();
			for (const poi of shapePOIs) {
				// Source POIs are in frame-local coords
				// Convert to world at instance position
				// For translation-only: worldPOI = localPOI + instance.x/y
				pois.push({
					x: poi.x + this.x,
					y: poi.y + this.y,
					type: poi.type,
					shape: this  // Reference back to instance for selection
				});
			}
		}

		return pois;
	}

	/**
	 * Get geometric snap point (closest point on geometry).
	 * Source shapes are in FRAME-LOCAL coords.
	 * Transform mouse to source space, check shapes, transform result back.
	 */
	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		// Quick reject using bounds
		if (mouseRect && !this.bounds.intersects(mouseRect)) {
			return null;
		}

		const sourceShapes = this.getSourceShapes();
		const sourceFrame = this.getSourceFrame();

		if (sourceShapes.length === 0 || !sourceFrame) {
			return null;
		}

		// Transform mouse position to source frame's local space
		// For translation-only: localMouse = worldMouse - instance.x/y
		const localMouse = {
			x: mouse.x - this.x,
			y: mouse.y - this.y
		};

		// Create local mouse rect for bounds checking
		const localMouseRect = mouseRect ? {
			x: mouseRect.x - this.x,
			y: mouseRect.y - this.y,
			width: mouseRect.width,
			height: mouseRect.height,
			intersects: function(other) {
				return !(this.x > other.x + other.width ||
						 this.x + this.width < other.x ||
						 this.y > other.y + other.height ||
						 this.y + this.height < other.y);
			}
		} : null;

		// Check each source shape (in local coords)
		let closest = null;
		let closestDist = Infinity;

		for (const shape of sourceShapes) {
			const snap = shape.getGeoSnap(localMouse, localMouseRect, pixelTolerance);
			if (snap) {
				const dist = snap.distance !== undefined ? snap.distance :
					Math.sqrt((localMouse.x - snap.x) ** 2 + (localMouse.y - snap.y) ** 2);
				if (dist < closestDist) {
					closest = snap;
					closestDist = dist;
				}
			}
		}

		if (closest) {
			// Transform result back to world coords at instance position
			return {
				x: closest.x + this.x,
				y: closest.y + this.y,
				distance: closestDist,
				shape: this  // Reference back to instance
			};
		}

		return null;
	}

	/**
	 * Move the instance.
	 */
	translate(dx, dy) {
		this.x += dx;
		this.y += dy;
		this.update();
	}

	/**
	 * Scale instance position relative to anchor.
	 */
	scale(anchorX, anchorY, factor) {
		this.x = anchorX + (this.x - anchorX) * factor;
		this.y = anchorY + (this.y - anchorY) * factor;
		this.update();
	}

	/**
	 * Rotate instance position around anchor.
	 */
	rotate(anchorX, anchorY, angle) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const dx = this.x - anchorX;
		const dy = this.y - anchorY;
		this.x = anchorX + dx * cos - dy * sin;
		this.y = anchorY + dx * sin + dy * cos;
		this.update();
	}

	/**
	 * Mirror instance position.
	 */
	mirror(x1, y1, x2, y2) {
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

		this.update();
	}

	/**
	 * Instances have no control points.
	 */
	updateControlPoint(index, newX, newY) {
		// Move the whole instance
		this.x = newX;
		this.y = newY;
		this.update();
	}

	/**
	 * Get shapes for rendering.
	 * Source shapes are in FRAME-LOCAL coords.
	 * Transform: local → world via source frame, then offset to instance position.
	 */
	getShapesForRender() {
		const sourceShapes = this.getSourceShapes();
		const sourceFrame = this.getSourceFrame();
		const shapes = [];

		if (!sourceFrame) return shapes;

		for (const srcShape of sourceShapes) {
			const shape = srcShape.clone();

			// Source shapes are in frame-local coords
			// Convert to world coords using source frame, then translate to instance position
			// For translation-only: worldCoords = localCoords + frame.x/y
			// Then translate by (instance.x - frame.x, instance.y - frame.y)
			// Net effect: worldCoords = localCoords + instance.x/y
			shape.translate(this.x, this.y);

			// Clear frameId since these are now world coords for rendering
			shape.frameId = null;

			// Inherit selection state from instance
			shape.selected = this.selected;

			// Mark as coming from this instance (for hit detection)
			shape._instanceRef = this;

			shapes.push(shape);
		}

		return shapes;
	}

	/**
	 * Break apart into a regular group.
	 * Source shapes are in FRAME-LOCAL coords.
	 * Returns cloned shapes converted to WORLD coords at instance position.
	 */
	explode() {
		const sourceShapes = this.getSourceShapes();
		const sourceFrame = this.getSourceFrame();
		const shapes = [];

		if (!sourceFrame) return shapes;

		for (const srcShape of sourceShapes) {
			const shape = srcShape.clone();
			// Convert from frame-local to world at instance position
			// For translation-only: world = local + instance.x/y
			shape.translate(this.x, this.y);
			shape.frameId = null;  // Remove frame association (now world coords)
			shape.groupId = null;  // Will be assigned by createGroup
			shapes.push(shape);
		}

		return shapes;
	}

	/**
	 * Serialize for storage.
	 */
	toJSON() {
		const json = {
			geometry: this.geometry,
			sourceFrameId: this.sourceFrameId,
			x: this.x,
			y: this.y,
			penStyle: this.penStyle,
			colorToken: this.colorToken
		};
		if (this.libraryDocId) json.libraryDocId = this.libraryDocId;
		if (this.libraryFrameId) json.libraryFrameId = this.libraryFrameId;
		return json;
	}

	/**
	 * Deserialize from storage.
	 */
	static fromJSON(json) {
		const inst = new SymbolInstance([
			json.sourceFrameId,
			json.x,
			json.y
		]);
		inst.libraryDocId = json.libraryDocId || null;
		inst.libraryFrameId = json.libraryFrameId || null;
		inst.penStyle = json.penStyle;
		inst.colorToken = json.colorToken;
		return inst;
	}

	getInspectorSchema() {
		const frame = this.getSourceFrame();
		const symbolName = frame ? frame.label : 'Instance';
		const isLibrary = this.isLibraryInstance();

		const sections = [
			{
				title: 'Position',
				fields: [
					{ key: 'x', label: 'X', type: 'number', precision: 2, step: 1 },
					{ key: 'y', label: 'Y', type: 'number', precision: 2, step: 1 }
				]
			}
		];

		// Local symbols: editable name. Library symbols: read-only info + edit button.
		if (isLibrary) {
			const lib = data.linkedLibraries.find(l => l.docId === this.libraryDocId);
			const docId = this.libraryDocId;
			sections.push({
				title: 'Library',
				fields: [
					{ key: 'symbolName', label: 'Symbol', type: 'readonly', get: () => symbolName },
					{ key: 'libraryName', label: 'Library', type: 'readonly', get: () => lib ? lib.name : 'Unknown' },
					{
						key: 'editOriginal',
						label: 'Edit Original',
						type: 'button',
						action: async () => {
							const fileManager = (await import('../core/FileManager.js')).default;
							// Auto-save current doc, then load library doc in new tab
							if (fileManager.storage && fileManager.currentDocumentId) {
								await fileManager._autoSave();
							}
							await fileManager.loadFromStorage(docId);
						}
					}
				]
			});
		} else {
			sections.push({
				title: 'Symbol',
				fields: [
					{
						key: 'label',
						label: 'Name',
						type: 'string',
						get: () => frame ? frame.label : '',
						set: (value) => {
							if (frame) {
								frame.label = value;
								stage.render();
							}
						}
					}
				]
			});
		}

		sections.push({
			title: 'Instance',
			fields: [
				{
					key: 'explode',
					label: 'Break Apart',
					type: 'button',
					action: (instance) => {
						undoManager.execute(new BreakApartInstanceCommand(instance));
						stage.render();
					}
				}
			]
		});

		return { name: symbolName, sections };
	}
}
