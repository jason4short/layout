import {Tool} from './Tool.js';

import stage 		from '../core/Stage.js';
import toolManager	from './ToolManager.js';
import data 		from '../data/Data.js';
import {Line} 		from '../geometry/Line.js';
import undoManager	from '../core/UndoManager.js';
import {AddShapesCommand, MirrorCommand} from '../core/Commands.js';

export class MirrorTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Mirror";
		this.usage 	= "Select shapes first. Click two points to define mirror line. Hold Option to duplicate.";
		this.cursor = "cursor_crosshair";

		this.generateGuides = false;

		// 2-click state machine
		this.state 			= 0;
		this.lineStart 		= null;
		this.lineEnd 		= null;

		// Drag tracking
		this.isDragging 	= false;

		// Preview
		this.previewShapes 	= [];

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		this.resetState();
		toolManager.addEventListener('mouseDown', this.onMouseDown);
		toolManager.addEventListener('mouseMove', this.onMouseMove);
		toolManager.addEventListener('mouseUp', this.onMouseUp);

		const selected = data.getSelected();
		if(selected.length === 0){
			this.usage = "No shapes selected. Select shapes first, then use Mirror tool.";
		} else {
			this.usage = "Click first point of mirror line.";
		}
		toolManager.updateToolNameDisplay();
	}

	exit(){
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		toolManager.removeEventListener('mouseMove', this.onMouseMove);
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		this.resetState();
	}

	reset(){
		this.resetState();
		stage.render();
	}

	resetState(){
		this.state 		= 0;
		this.lineStart 	= null;
		this.lineEnd 	= null;
		this.isDragging = false;
		this.previewShapes = [];
		data.clearTempShapes();
	}

	onMouseDown(e){
		const selected = data.getSelected();
		if(selected.length === 0){
			return;
		}

		const snap = data.snapPoint;

		if(this.state === 0){
			this.lineStart = { x: snap.x, y: snap.y };
			this.isDragging = false;
			this.state = 1;
			this.usage = "Drag or click second point. Hold Option to duplicate.";
			toolManager.updateToolNameDisplay();

		} else if(this.state === 1 && !this.isDragging){
			// Click mode - set end and apply
			this.lineEnd = { x: snap.x, y: snap.y };
			data.clearTempShapes();
			this.applyMirror();
			this.resetState();
			this.usage = "Click first point of mirror line.";
			toolManager.updateToolNameDisplay();
		}

		stage.render();
	}

	onMouseMove(e){
		if(this.state === 1 && this.lineStart){
			const snap = data.snapPoint;
			const dx = snap.x - this.lineStart.x;
			const dy = snap.y - this.lineStart.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Mark as dragging if moved more than 5 units
			if(dist > 5){
				this.isDragging = true;
				this.lineEnd = { x: snap.x, y: snap.y };
				this.updatePreview();
				stage.render();
			}
		}
	}

	onMouseUp(e){
		if(this.state === 1 && this.isDragging){
			// Drag complete - apply mirror
			const snap = data.snapPoint;
			this.lineEnd = { x: snap.x, y: snap.y };
			data.clearTempShapes();
			this.applyMirror();
			this.resetState();
			this.usage = "Click first point of mirror line.";
			toolManager.updateToolNameDisplay();
			stage.render();
		}
	}

	updatePreview(){
		if(!this.lineStart || !this.lineEnd) return;

		const selected = data.getSelected();
		this.previewShapes = selected.map(shape => {
			const clone = shape.clone();
			clone.mirror(this.lineStart.x, this.lineStart.y, this.lineEnd.x, this.lineEnd.y);
			return clone;
		});

		// Add mirror line to preview
		const mirrorLine = new Line([
			this.lineStart.x, this.lineStart.y,
			this.lineEnd.x, this.lineEnd.y
		]);
		this.previewShapes.push(mirrorLine);

		data.setTempShapes(this.previewShapes);
	}

	applyMirror(){
		if(!this.lineStart || !this.lineEnd) return;

		const selected = data.getSelected();
		const duplicate = stage.optionKey;

		if(duplicate){
			// Create mirrored copies
			const clones = [];
			for(const shape of selected){
				const clone = shape.clone();
				clone.mirror(this.lineStart.x, this.lineStart.y, this.lineEnd.x, this.lineEnd.y);
				clones.push(clone);
			}
			undoManager.execute(new AddShapesCommand(clones));
		} else {
			// Mirror in place (use command for undo support)
			undoManager.execute(new MirrorCommand(
				[...selected],
				this.lineStart.x, this.lineStart.y,
				this.lineEnd.x, this.lineEnd.y
			));
		}
	}
}
