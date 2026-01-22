import {Tool} from './Tool.js';

import stage 		from '../core/Stage.js';
import toolManager	from './ToolManager.js';
import data 		from '../data/Data.js';
import undoManager	from '../core/UndoManager.js';
import {ScaleCommand} from '../core/Commands.js';

const STATE = Object.freeze({
	ANCHOR: 0,     // waiting for anchor point
	REFERENCE: 1,  // waiting for reference point (P2)
	TARGET: 2      // waiting for target point (P3)
});

export class ScaleTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Scale";
		this.usage 	= "Select shapes first. Click anchor, then reference, then target.";
		this.cursor = "cursor_crosshair";

		this.generateGuides = false;

		this.state 			= STATE.ANCHOR;

		this.anchor 		= null;
		this.reference 		= null;
		this.target 		= null;

		// Drag tracking
		this.isDragging 	= false;
		this.dragStart 		= null;

		// Preview clones
		this.previewShapes 	= [];

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		this.resetState();

		const selected = data.getSelected();
		if(selected.length === 0){
			this.usage = "No shapes selected. Select shapes first, then use Scale tool.";
		} else {
			this.usage = "Click to set anchor point.";
		}
		toolManager.updateToolNameDisplay();
	}

	exit(){
		this.resetState();
	}

	reset(){
		this.resetState();
		stage.render();
	}

	updateCursor(){
		stage.setCursor('scale', 0, 0);
	}

	resetState(){
		this.state 		= STATE.ANCHOR;
		this.anchor 	= null;
		this.reference 	= null;
		this.target 	= null;
		this.isDragging = false;
		this.dragStart 	= null;
		this.previewShapes = [];
		data.clearTempShapes();
	}

	onMouseMove(e){
		if(this.state === STATE.TARGET && this.dragStart){
			const snap = data.snapPoint;
			const dx = snap.x - this.dragStart.x;
			const dy = snap.y - this.dragStart.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Mark as dragging if moved more than 5 screen pixels
			const screenDist = stage.worldToScreenScale(dist);
			if(screenDist > 5){
				this.isDragging = true;
				this.target = { x: snap.x, y: snap.y };
				this.updatePreview();
				stage.render();
			}
		}
	}

	updatePreview(){
		if(!this.anchor || !this.reference || !this.target) return;

		const refDist 		= this.distance(this.anchor, this.reference);
		const targetDist 	= this.distance(this.anchor, this.target);

		if(refDist < 0.001) return;

		const scaleFactor = targetDist / refDist;

		// Clone selected shapes and scale the clones
		const selected = data.getSelected();
		this.previewShapes = selected.map(shape => {
			const clone = shape.clone();
			clone.scale(this.anchor.x, this.anchor.y, scaleFactor);
			return clone;
		});

		data.setTempShapes(this.previewShapes);
	}

	onMouseUp(e){
		if(this.state === STATE.TARGET && this.isDragging){
			// Drag complete - apply scale to originals
			const snap = data.snapPoint;
			this.target = { x: snap.x, y: snap.y };
			data.clearTempShapes();
			this.applyScale();
			this.resetState();
			this.usage = "Click to set anchor point.";
			toolManager.updateToolNameDisplay();
			stage.render();
		}
		// If not dragging, stay in state 2 waiting for click
	}

	onMouseDown(e)
	{
		const selected = data.getSelected();
		if(selected.length === 0){
			return;
		}

		const snap = data.snapPoint;

		if(this.state === STATE.ANCHOR){
			this.anchor = { x: snap.x, y: snap.y };
			this.state = STATE.REFERENCE;
			this.usage = "Click or drag from reference to target.";
			toolManager.updateToolNameDisplay();

		} else if(this.state === STATE.REFERENCE){
			// Set reference, prepare for potential drag
			this.reference = { x: snap.x, y: snap.y };
			this.dragStart = { x: snap.x, y: snap.y };
			this.isDragging = false;
			this.state = STATE.TARGET;
			this.usage = "Drag to target or click target point.";
			toolManager.updateToolNameDisplay();

		} else if(this.state === STATE.TARGET && !this.isDragging){
			// Click mode - set target and apply
			this.target = { x: snap.x, y: snap.y };
			this.applyScale();
			this.resetState();
			this.usage = "Click to set anchor point.";
			toolManager.updateToolNameDisplay();
		}

		stage.render();
	}

	applyScale(){
		if(!this.anchor || !this.reference || !this.target) return;

		const refDist 		= this.distance(this.anchor, this.reference);
		const targetDist 	= this.distance(this.anchor, this.target);

		if(refDist < 0.001) return;

		const scaleFactor = targetDist / refDist;

		const selected = data.getSelected();
		undoManager.execute(new ScaleCommand(
			[...selected],
			this.anchor.x,
			this.anchor.y,
			scaleFactor
		));
	}

	distance(p1, p2){
		const dx = p2.x - p1.x;
		const dy = p2.y - p1.y;
		return Math.sqrt(dx * dx + dy * dy);
	}
}
