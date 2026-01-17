import {Tool} from './Tool.js';

import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

import {RotateCommand} from '../core/Commands.js';

const STATE = {
	IDLE: 0,		// Waiting for anchor point
	ANCHOR_SET: 1,	// Anchor set, waiting for reference angle
	ROTATING: 2		// Reference set, dragging/clicking for target angle
};

export class RotateTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Rotate";
		this.usage 	= "Select shapes first. Click anchor, then reference, then target angle.";

		this.generateGuides = false;

		this.state 			= STATE.IDLE;
		this.anchor 		= null;
		this.reference 		= null;
		this.target 		= null;

		// Drag tracking
		this.isDragging 	= false;

		// Preview clones
		this.previewShapes 	= [];

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin() {
		this.resetState();
		this.updateCursor()
		const selected = data.getSelected();
		if (selected.length === 0) {
			this.usage = "No shapes selected. Select shapes first, then use Rotate tool.";
		} else {
			this.usage = "Click to set rotation center.";
		}
		toolManager.updateToolNameDisplay();
	}

	exit() {
		this.resetState();
	}
	
	updateCursor(){
		stage.setCursor('rotate', 0, 0);
	}
	

	reset() {
		this.resetState();
		stage.render();
	}

	resetState() {
		this.state 		= STATE.IDLE;
		this.anchor 	= null;
		this.reference 	= null;
		this.target 	= null;
		this.isDragging = false;
		this.previewShapes = [];
		data.clearTempShapes();
	}

	onMouseDown(e) {
		const selected = data.getSelected();
		if (selected.length === 0) return;

		const snap = data.snapPoint;

		switch (this.state) {
			case STATE.IDLE:
				this.anchor = { x: snap.x, y: snap.y };
				this.state = STATE.ANCHOR_SET;
				this.usage = "Click or drag from reference to target angle.";
				toolManager.updateToolNameDisplay();

				// create a guide reference from initial point
				draftingAssistant.setCurrentSnapPoint(snap, true);				
				break;

			case STATE.ANCHOR_SET:
				this.reference = { x: snap.x, y: snap.y };
				this.isDragging = false;
				this.state = STATE.ROTATING;
				this.usage = "Drag to target angle or click.";
				toolManager.updateToolNameDisplay();
				break;

			case STATE.ROTATING:
				if (!this.isDragging) {
					// Click mode - set target and apply
					this.target = { x: snap.x, y: snap.y };
					this.applyRotation();
					this.resetState();
					this.usage = "Click to set rotation center.";
					toolManager.updateToolNameDisplay();
				}
				break;
		}

		stage.render();
	}

	onMouseMove(e) {
		if (this.state === STATE.ROTATING && this.reference) {
			const snap = data.snapPoint;
			const dx = snap.x - this.reference.x;
			const dy = snap.y - this.reference.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist > 5) {
				this.isDragging = true;
				this.target = { x: snap.x, y: snap.y };
				this.updatePreview();
				stage.render();
			}
		}
	}

	onMouseUp(e) {
		if (this.state === STATE.ROTATING && this.isDragging) {
			const snap = data.snapPoint;
			this.target = { x: snap.x, y: snap.y };
			data.clearTempShapes();
			this.applyRotation();
			this.resetState();
			this.usage = "Click to set rotation center.";
			toolManager.updateToolNameDisplay();
			stage.render();
			data.resetSnaps();
		}
	}

	updatePreview() {
		if (!this.anchor || !this.reference || !this.target) return;

		const angle = this.calculateRotation();
		if (angle === null) return;

		const selected = data.getSelected();
		this.previewShapes = selected.map(shape => {
			const clone = shape.clone();
			clone.rotate(this.anchor.x, this.anchor.y, angle);
			return clone;
		});

		data.setTempShapes(this.previewShapes);
	}

	applyRotation() {
		if (!this.anchor || !this.reference || !this.target) return;

		const angle = this.calculateRotation();
		if (angle === null) return;

		const selected = data.getSelected();
		undoManager.execute(new RotateCommand(
			[...selected],
			this.anchor.x,
			this.anchor.y,
			angle
		));
	}

	calculateRotation() {
		// Calculate angle from anchor to reference
		const refAngle = Math.atan2(
			this.reference.y - this.anchor.y,
			this.reference.x - this.anchor.x
		);

		// Calculate angle from anchor to target
		const targetAngle = Math.atan2(
			this.target.y - this.anchor.y,
			this.target.x - this.anchor.x
		);

		// Rotation is the difference
		return targetAngle - refAngle;
	}
}
