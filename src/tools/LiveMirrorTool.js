import { Tool } from './Tool.js';
import { Mirror } from '../geometry/Mirror.js';

import toolManager from './ToolManager.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import da from '../geometry/DraftingAssistant.js';
import { AddShapeCommand } from '../core/Commands.js';

const STATE = Object.freeze({
	IDLE: 0,          // waiting for first point (axis start)
	FIRST_POINT: 1    // axis start set, dragging to axis end
});

/**
 * LiveMirrorTool - Creates Mirror primitives.
 *
 * Draw the mirror axis line. The capture zone width can be adjusted
 * after creation via the inspector or handle.
 */
export class LiveMirrorTool extends Tool {
	constructor() {
		super();
		this.name = "Live Mirror";
		this.usage = "Click to set axis start, drag to axis end. Shapes to the left of the axis will be mirrored.";

		this.generateGuides = true;

		this.state = STATE.IDLE;
		this.startPt = null;
		this.previewMirror = null;
		this.isDragging = false;

		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
	}

	begin() {
		toolManager.addEventListener('mouseDown', this.onMouseDown);
		toolManager.addEventListener('mouseMove', this.onMouseMove);
		toolManager.addEventListener('mouseUp', this.onMouseUp);
	}

	deactivate() {
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		toolManager.removeEventListener('mouseMove', this.onMouseMove);
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		this.reset();
	}

	updateCursor() {
		stage.setCursor('crosshair');
	}

	reset() {
		this.state = STATE.IDLE;
		this.startPt = null;
		this.isDragging = false;
		data.clearTempShapes();
		this.previewMirror = null;
	}

	onMouseDown(e) {
		data.resetSnaps();
		const snapPt = da.getCurrentSnapPoint();

		if (this.state === STATE.IDLE) {
			// First click: set axis start
			this.startPt = { x: snapPt.x, y: snapPt.y };
			this.isDragging = false;

			// Create preview mirror with minimal axis
			this.previewMirror = new Mirror([
				this.startPt.x, this.startPt.y,
				this.startPt.x, this.startPt.y + 10,
				50  // default width
			]);
			data.addTempShape(this.previewMirror);
			da.setCurrentSnapPoint(snapPt, true);

			this.state = STATE.FIRST_POINT;
			stage.render();

		} else if (this.state === STATE.FIRST_POINT && !this.isDragging) {
			// Second click (click-click mode): commit
			this.commitMirror(snapPt);
		}
	}

	onMouseMove(e) {
		if (this.state !== STATE.FIRST_POINT) return;

		const snapPt = da.getCurrentSnapPoint();

		// Check if we've moved enough to drag
		if (this.startPt && !this.isDragging) {
			const dx = snapPt.x - this.startPt.x;
			const dy = snapPt.y - this.startPt.y;
			const screenDist = stage.worldToScreenScale(Math.sqrt(dx * dx + dy * dy));
			if (screenDist > 5) {
				this.isDragging = true;
			}
		}

		// Update axis end and width (width = axis length)
		if (this.previewMirror) {
			this.previewMirror.end.x = snapPt.x;
			this.previewMirror.end.y = snapPt.y;
			// Set width equal to axis length
			const dx = snapPt.x - this.startPt.x;
			const dy = snapPt.y - this.startPt.y;
			this.previewMirror.width = Math.sqrt(dx * dx + dy * dy);
			this.previewMirror.update();
		}

		stage.render();
	}

	onMouseUp(e) {
		if (this.state !== STATE.FIRST_POINT) return;

		if (this.isDragging) {
			data.resetSnaps();
			const snapPt = da.getCurrentSnapPoint();
			this.commitMirror(snapPt);
		}
	}

	commitMirror(endPt) {
		// Check minimum axis length
		const dx = endPt.x - this.startPt.x;
		const dy = endPt.y - this.startPt.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		const screenLen = stage.worldToScreenScale(len);

		if (screenLen > 10) {
			// Create final mirror - width defaults to axis length
			const mirror = new Mirror([
				this.startPt.x, this.startPt.y,
				endPt.x, endPt.y,
				len  // width = height (axis length)
			]);

			data.clearTempShapes();
			mirror.updateCapturedShapes();
			undoManager.execute(new AddShapeCommand(mirror));

			this.previewMirror = null;
		} else {
			data.clearTempShapes();
			this.previewMirror = null;
		}

		this.state = STATE.IDLE;
		this.startPt = null;
		this.isDragging = false;
		stage.render();
	}
}
