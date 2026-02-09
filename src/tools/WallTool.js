import { Tool } from './Tool.js';
import { Shape } from '../geometry/Geometry.js';
import { Wall, WALL_PRESETS } from '../geometry/Wall.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import draftingAssistant from '../geometry/DraftingAssistant.js';
import { AddShapeCommand } from '../core/Commands.js';

/**
 * WallTool - Create wall shapes for floor plans.
 *
 * Click to place one end, drag to set length and angle.
 * Thickness comes from selected wall preset.
 * Walls auto-merge visually when they overlap.
 */
export class WallTool extends Tool {
	constructor() {
		super();
		this.name = "Wall";
		this.usage = "Click to place start, drag to set length. Walls auto-merge at junctions.";

		this.generateGuides = true;

		// Current preset index
		this.presetIndex = 0;

		// Drag state
		this.isDragging = false;
		this.wall = null;
		this.startPoint = null;

		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.updateLength = this.updateLength.bind(this);
		this._onKeyChange = this._onKeyChange.bind(this);
	}

	get currentPreset() {
		return WALL_PRESETS[this.presetIndex];
	}

	begin() {
		this.reset();
		this.showLengthInput();
		stage.addEventListener('keyDown', this._onKeyChange);
		stage.addEventListener('keyUp', this._onKeyChange);
	}

	deactivate() {
		stage.removeEventListener('keyDown', this._onKeyChange);
		stage.removeEventListener('keyUp', this._onKeyChange);
		this.reset();
	}

	updateCursor() {
		stage.setCursor('crosshair');
	}

	showLengthInput() {
		stage.setInputCallback(this.updateLength);
		stage.setDimensionInputValue(this.prevWall ? this.prevWall.length() : '', 'Wall length');
	}

	reset() {
		this.isDragging = false;
		this.wall = null;
		this.startPoint = null;
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e) {
		data.resetSnaps();

		this.startPoint = { x: data.snapPoint.x, y: data.snapPoint.y };

		// Set up drafting assistant from start point
		draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);

		const preset = this.currentPreset;

		// Create wall with start point, end point starts at same location
		// params: [startX, startY, endX, endY, thickness, presetName, alignment]
		this.wall = new Wall([
			this.startPoint.x,
			this.startPoint.y,
			this.startPoint.x,
			this.startPoint.y,
			preset.thickness,
			preset.name,
			'bottom'
		]);

		data.addTempShape(this.wall);

		this.isDragging = true;
		stage.render();
	}

	onMouseMove(e) {
		if (!this.isDragging || !this.wall) return;

		this.wall.end.x = data.snapPoint.x;
		this.wall.end.y = data.snapPoint.y;

		// Option/Alt flips wall direction
		this.wall.alignment = stage.optionKey ? 'top' : 'bottom';
		this.wall.update();

		stage.render();
	}

	onMouseUp(e) {
		if (!this.isDragging || !this.wall) return;

		data.resetSnaps();
		data.clearTempShapes();

		// Minimum length check
		if (this.wall.length() < 10) {
			this.wall.end.x = this.wall.start.x + 304.8;  // Default 12" horizontal
			this.wall.end.y = this.wall.start.y;
			this.wall.update();
		}

		undoManager.execute(new AddShapeCommand(this.wall));

		this.prevWall = this.wall;
		stage.setInputCallback(this.updateLength);
		stage.setDimensionInputValue(this.wall.length(), 'Wall length');

		this.isDragging = false;
		this.wall = null;
		this.startPoint = null;

		stage.render();
	}

	updateLength(newLength) {
		if (this.prevWall && Number.isFinite(newLength) && newLength > 0) {
			this.prevWall.scaleToDim(newLength);
			stage.render();
		}
	}

	_onKeyChange(e) {
		if (!this.isDragging || !this.wall) return;
		this.wall.alignment = stage.optionKey ? 'top' : 'bottom';
		this.wall.update();
		stage.render();
	}

	setPreset(index) {
		if (index >= 0 && index < WALL_PRESETS.length) {
			this.presetIndex = index;
		}
	}
}
