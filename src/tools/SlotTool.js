import { Tool } from './Tool.js';
import { Shape } from '../geometry/Geometry.js';
import { Slot } from '../geometry/Slot.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import draftingAssistant from '../geometry/DraftingAssistant.js';
import { AddShapeCommand } from '../core/Commands.js';

/**
 * SlotTool - Create slot (stadium/rounded rectangle) shapes.
 *
 * Click to place one end, drag to set length and angle.
 * Width can be set in the inspector.
 */
export class SlotTool extends Tool {
	constructor() {
		super();
		this.name = "Slot";
		this.usage = "Click to place start, drag to set length. Use inspector to change width.";

		this.generateGuides = true;

		// Default width (3/4" = 19.05mm)
		this.defaultWidth = 19.05;

		// Drag state
		this.isDragging = false;
		this.slot = null;
		this.startPoint = null;

		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
	}

	begin() {
		this.reset();
	}

	deactivate(){
		this.reset();
	}

	updateCursor() {
		stage.setCursor('crosshair');
	}

	reset() {
		this.isDragging = false;
		this.slot = null;
		this.startPoint = null;
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e) {
		data.resetSnaps();

		// Store starting point
		this.startPoint = { x: data.snapPoint.x, y: data.snapPoint.y };

		// Set up drafting assistant from start point
		draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);

		// Create slot with start point, end point starts at same location
		// params: [startX, startY, endX, endY, width]
		this.slot = new Slot([
			this.startPoint.x,
			this.startPoint.y,
			this.startPoint.x,
			this.startPoint.y,
			this.defaultWidth
		]);

		// Add as temp shape while dragging
		data.addTempShape(this.slot);

		this.isDragging = true;
		stage.render();
	}

	onMouseMove(e) {
		if (!this.isDragging || !this.slot) return;

		// Update end point to current snap position
		this.slot.end.x = data.snapPoint.x;
		this.slot.end.y = data.snapPoint.y;
		this.slot.update();

		stage.render();
	}

	onMouseUp(e) {
		if (!this.isDragging || !this.slot) return;

		data.resetSnaps();

		// Remove from temp and add to shapes
		data.clearTempShapes();

		// Minimum length check - if just clicked, create default 1" slot
		if (this.slot.length() < 10) {
			this.slot.end.x = this.slot.start.x + 25.4;  // Default 1" horizontal
			this.slot.end.y = this.slot.start.y;
			this.slot.update();
		}

		undoManager.execute(new AddShapeCommand(this.slot));

		// Remember width for next slot
		this.defaultWidth = this.slot.width;

		this.isDragging = false;
		this.slot = null;
		this.startPoint = null;

		stage.render();
	}
}
