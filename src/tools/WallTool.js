import { Tool } from './Tool.js';
import { Wall, WALL_PRESETS } from '../geometry/Wall.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import draftingAssistant from '../geometry/DraftingAssistant.js';
import { AddShapeCommand } from '../core/Commands.js';

/**
 * WallTool - Create wall shapes for floor plans.
 *
 * Click to set start, click again or drag-release to set end.
 * Hold Option to flip wall direction while drawing.
 * Walls auto-merge visually when they overlap.
 */
export class WallTool extends Tool {
	constructor() {
		super();
		this.name = "Wall";
		this.usage = "Click or drag to draw a wall segment. Hold Option to flip side.";

		this.generateGuides = true;

		this.presetIndex = 0;
		this.wall = null;
		this.prevWall = null;

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
		this.wall = null;
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e) {
		data.resetSnaps();

		if (!this.wall) {
			// First click — set start point
			const preset = this.currentPreset;
			this.wall = new Wall([
				data.snapPoint.x, data.snapPoint.y,
				data.snapPoint.x, data.snapPoint.y,
				preset.thickness,
				preset.name,
				'bottom'
			]);
			data.addTempShape(this.wall);
			draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);
		}
		// If wall already exists, we're in click-click mode — mouseUp will commit
	}

	onMouseMove(e) {
		if (!this.wall) return;

		this.wall.end.x = data.snapPoint.x;
		this.wall.end.y = data.snapPoint.y;
		this.wall.alignment = stage.optionKey ? 'top' : 'bottom';
		this.wall.update();
		stage.render();
	}

	onMouseUp(e) {
		if (!this.wall) return;

		data.resetSnaps();

		// Only commit if dragged far enough (otherwise stay in click-click mode)
		const screenLength = stage.worldToScreenScale(this.wall.length());
		if (screenLength < 5) return;

		// Commit the wall
		data.clearTempShapes();
		this.wall.update();
		undoManager.execute(new AddShapeCommand(this.wall));

		this.prevWall = this.wall;
		stage.setInputCallback(this.updateLength);
		stage.setDimensionInputValue(this.wall.length(), 'Wall length');

		this.wall = null;
		stage.render();
	}

	updateLength(newLength) {
		if (this.prevWall && Number.isFinite(newLength) && newLength > 0) {
			this.prevWall.scaleToDim(newLength);
			stage.render();
		}
	}

	_onKeyChange(e) {
		if (!this.wall) return;
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
