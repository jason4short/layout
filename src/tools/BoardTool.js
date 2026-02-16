import { Tool } from './Tool.js';
import { Shape } from '../geometry/Geometry.js';
import { Board, BOARD_PRESETS } from '../geometry/Board.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import draftingAssistant from '../geometry/DraftingAssistant.js';
import { AddShapeCommand } from '../core/Commands.js';

/**
 * BoardTool - Create parametric lumber/board shapes.
 *
 * Click to place one end, drag to set length and angle.
 * Thickness comes from selected preset.
 */
export class BoardTool extends Tool {
	constructor() {
		super();
		this.name = "Board";
		this.usage = "Click or drag to draw a board. Hold Option to flip side.";

		this.generateGuides = true;

		// Current preset index
		this.presetIndex = 0;

		// Drag state
		this.isDragging = false;
		this.board = null;
		this.startPoint = null;

		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.updateLength = this.updateLength.bind(this);
		this._onKeyChange = this._onKeyChange.bind(this);
	}

	get currentPreset() {
		return BOARD_PRESETS[this.presetIndex];
	}

	begin() {
		this.reset();
		stage.addEventListener('keyDown', this._onKeyChange);
		stage.addEventListener('keyUp', this._onKeyChange);
	}

	deactivate(){
		stage.removeEventListener('keyDown', this._onKeyChange);
		stage.removeEventListener('keyUp', this._onKeyChange);
		this.reset();
	}

	updateCursor() {
		stage.setCursor('crosshair');
	}

	reset() {
		this.isDragging = false;
		this.board = null;
		this.startPoint = null;
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e) {
		data.resetSnaps();

		// Store starting point (this will be one end of the board)
		this.startPoint = { x: data.snapPoint.x, y: data.snapPoint.y };

		// Set up drafting assistant from start point
		draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);

		const preset = this.currentPreset;

		// Create board with start point, end point starts at same location
		// params: [startX, startY, endX, endY, thickness, presetName]
		this.board = new Board([
			this.startPoint.x,
			this.startPoint.y,
			this.startPoint.x,  // end starts at start
			this.startPoint.y,
			preset.thickness,
			preset.name
		]);

		// Add as temp shape while dragging
		data.addTempShape(this.board);

		this.isDragging = true;
		stage.render();
	}

	onMouseMove(e) {
		if (!this.isDragging || !this.board) return;

		// Update end point to current snap position
		this.board.end.x = data.snapPoint.x;
		this.board.end.y = data.snapPoint.y;
		this.board.alignment = stage.optionKey ? 'bottom' : 'top';
		this.board.update();

		stage.render();
	}

	onMouseUp(e) {
		if (!this.isDragging || !this.board) return;

		data.resetSnaps();

		// Remove from temp and add to shapes
		data.clearTempShapes();

		// Minimum length check - if just clicked, create default 6" board extending right
		if (this.board.length() < 10) {
			this.board.end.x = this.board.start.x + 152.4;  // Default 6" horizontal
			this.board.end.y = this.board.start.y;
			this.board.update();
		}

		undoManager.execute(new AddShapeCommand(this.board));

		this.prevBoard = this.board;
		stage.setInputCallback(this.updateLength);
		stage.setDimensionInputValue(this.board.length(), 'Board length');

		this.isDragging = false;
		this.board = null;
		this.startPoint = null;

		stage.render();
	}

	updateLength(newLength) {
		if (this.prevBoard && Number.isFinite(newLength) && newLength > 0) {
			this.prevBoard.scaleToDim(newLength);
			stage.render();
		}
	}

	_onKeyChange(e) {
		if (!this.board) return;
		this.board.alignment = stage.optionKey ? 'bottom' : 'top';
		this.board.update();
		stage.render();
	}

	// Cycle through presets with number keys
	setPreset(index) {
		if (index >= 0 && index < BOARD_PRESETS.length) {
			this.presetIndex = index;
			console.log(`Board preset: ${this.currentPreset.name}`);
		}
	}
}
