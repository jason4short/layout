import { Tool } from './Tool.js';
import { Shape } from '../geometry/Geometry.js';
import { Paper, PaperSizes } from '../geometry/Paper.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import toolManager from './ToolManager.js';
import { AddShapeCommand, MoveCommand } from '../core/Commands.js';

export class PaperTool extends Tool
{
	constructor()
	{
		super();
		this.name = "Paper";
		this.usage = "Click or drag to place paper. Drag Label to reposition.";

		this.generateGuides = false;

		// Default paper size
		this.defaultSize = 'LETTER';

		// Drag state
		this.isDragging = false;
		this.paper = null;
		this.isNewPaper = false;
		this.startPos = null; // Original position for undo

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
		this.paper = null;
		this.isNewPaper = false;
		this.startPos = null;
		data.clearTempShapes();
	}

	onMouseDown(e) {
		data.resetSnaps();

		// Check if paper already exists
		const existingPaper = data.shapes.find(s => s.geometry === Shape.PAPER);

		if (existingPaper) {
			// Move existing paper to new position
			this.paper = existingPaper;
			this.isNewPaper = false;
			this.startPos = { x: existingPaper.x, y: existingPaper.y };

			// Move paper so click point becomes top-left
			this.paper.x = data.snapPoint.x;
			this.paper.y = data.snapPoint.y;
			this.paper.update();

			data.selectNone();
			this.paper.selected = true;
		} else {
			// Create new paper
			const size = PaperSizes[this.defaultSize];
			this.paper = new Paper([
				data.snapPoint.x,
				data.snapPoint.y,
				size.width,
				size.height,
				this.defaultSize.toLowerCase()
			]);
			this.isNewPaper = true;
			this.startPos = null;

			// Add as temp shape while dragging
			data.addTempShape(this.paper);
			this.paper.selected = true;
		}

		this.isDragging = true;
		stage.render();
	}

	onMouseMove(e) {
		if (!this.isDragging || !this.paper) return;

		// Update paper position to follow mouse (top-left at cursor)
		this.paper.x = data.snapPoint.x;
		this.paper.y = data.snapPoint.y;
		this.paper.update();

		stage.render();
	}

	onMouseUp(e) {
		if (!this.isDragging || !this.paper) return;

		if (this.isNewPaper) {
			// Remove from temp and add permanently
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.paper));
			this.paper.selected = true;
		} else {
			// Record move for undo (index -1 = whole shape translation)
			const moveData = [{
				shape: this.paper,
				index: -1,
				oldX: this.startPos.x,
				oldY: this.startPos.y,
				newX: this.paper.x,
				newY: this.paper.y
			}];
			undoManager.record(new MoveCommand(moveData));
		}

		this.isDragging = false;
		stage.render();

		// Switch back to pointer tool
		toolManager.setTool(toolManager.pointerTool);
	}
}
