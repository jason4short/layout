import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {Ellipse} 		from '../geometry/Ellipse.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

import {AddShapeCommand} from '../core/Commands.js';

export class OppositeCornerEllipseTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Corner Ellipse";
		this.usage 	= "Click one corner of the bounding box, drag to the opposite corner.";

		this.generateGuides = true;

		this.startPt	= null;
		this.ellipse	= null;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		//console.log("OppositeCornerEllipseTool begin");
		toolManager.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("OppositeCornerEllipseTool exit");
		this.reset();
	}

	reset(){
		this.startPt = null;
		if(this.ellipse){
			data.clearTempShapes();
			this.ellipse = null;
		}
	}

	onMouseDown(e)
	{
		const snapPt = da.getCurrentSnapPoint();
		this.startPt = {x: snapPt.x, y: snapPt.y};

		// Create preview ellipse (will be updated during drag)
		this.ellipse = new Ellipse([this.startPt.x, this.startPt.y, 0, 0, 0]);
		data.addTempShape(this.ellipse);

		stage.render();
	}

	onMouseMove(e)
	{
		const snapPt = da.getCurrentSnapPoint();
		this.updateEllipse(this.startPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		if(!this.startPt)
			return;

		const snapPt = da.getCurrentSnapPoint();

		// Calculate ellipse size
		const width = Math.abs(snapPt.x - this.startPt.x);
		const height = Math.abs(snapPt.y - this.startPt.y);

		// If ellipse is too small, cancel
		if(width < 5 && height < 5){
			this.reset();
			stage.render();
			return;
		}

		// Finalize ellipse
		this.updateEllipse(this.startPt, snapPt);
		data.clearTempShapes();
		undoManager.execute(new AddShapeCommand(this.ellipse));

		// Clear references
		this.startPt = null;
		this.ellipse = null;

		stage.render();
	}

	updateEllipse(p1, p2)
	{
		if(!this.ellipse) return;

		// Calculate center and radii from opposite corners
		const centerX = (p1.x + p2.x) / 2;
		const centerY = (p1.y + p2.y) / 2;
		const radiusX = Math.abs(p2.x - p1.x) / 2;
		const radiusY = Math.abs(p2.y - p1.y) / 2;

		this.ellipse.x = centerX;
		this.ellipse.y = centerY;
		this.ellipse.radiusX = radiusX;
		this.ellipse.radiusY = radiusY;
		this.ellipse.update();
	}
}
