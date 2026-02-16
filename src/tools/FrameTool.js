import { Tool } from './Tool.js';
import { Shape } from '../geometry/Geometry.js';
import { Frame } from '../geometry/Frame.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import toolManager from './ToolManager.js';
import { AddShapeCommand } from '../core/Commands.js';

/**
 * FrameTool - Create symbol frames by dragging a rectangle.
 * Frames establish a local coordinate system for symbol definitions.
 */
export class FrameTool extends Tool
{
	constructor()
	{
		super();
		this.name = "Frame";
		this.usage = "Click and Drag to create a symbol frame. Shapes drawn or pasted inside become part of the symbol.";

		this.generateGuides = false;

		// Default frame size (if just clicking without drag)
		this.defaultWidth = 100;
		this.defaultHeight = 100;

		// Drag state
		this.isDragging = false;
		this.frame = null;
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
		this.frame = null;
		this.startPoint = null;
		data.clearTempShapes();
	}

	onMouseDown(e) {
		data.resetSnaps();

		// Store starting point
		this.startPoint = { x: data.snapPoint.x, y: data.snapPoint.y };

		// Create frame at click point with default size
		this.frame = new Frame([
			this.startPoint.x,
			this.startPoint.y,
			this.defaultWidth,
			this.defaultHeight,
			'Symbol'
		]);
		this.frame.isSymbolSource = true;
		this.frame.ensureSymbolId();

		// Add as temp shape while dragging
		data.addTempShape(this.frame);
		this.frame.selected = true;

		this.isDragging = true;
		stage.render();
	}

	onMouseMove(e) {
		if (!this.isDragging || !this.frame) return;

		// Calculate frame dimensions from drag
		const currentX = data.snapPoint.x;
		const currentY = data.snapPoint.y;

		// Calculate bounds (handle dragging in any direction)
		const minX = Math.min(this.startPoint.x, currentX);
		const minY = Math.min(this.startPoint.y, currentY);
		const maxX = Math.max(this.startPoint.x, currentX);
		const maxY = Math.max(this.startPoint.y, currentY);

		// Update frame position and size
		this.frame.x = minX;
		this.frame.y = minY;
		this.frame.width = Math.max(maxX - minX, 10);  // Minimum 10 units
		this.frame.height = Math.max(maxY - minY, 10);
		this.frame.update();

		stage.render();
	}

	onMouseUp(e) {
		if (!this.isDragging || !this.frame) return;

		// Ensure minimum size
		if (this.frame.width < 10) this.frame.width = this.defaultWidth;
		if (this.frame.height < 10) this.frame.height = this.defaultHeight;
		this.frame.update();

		// Prompt for symbol name
		const name = prompt('Symbol name:', 'Symbol');
		if (name) {
			this.frame.label = name;
		}

		// Remove from temp and add permanently
		data.clearTempShapes();
		undoManager.execute(new AddShapeCommand(this.frame));

		// Deselect and clear active frame
		data.selectNone();
		data.clearActiveFrame();

		this.isDragging = false;
		this.frame = null;
		this.startPoint = null;

		stage.render();

		// Switch back to pointer tool
		toolManager.setTool(toolManager.pointerTool);
	}
}
