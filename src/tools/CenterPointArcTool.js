import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {Arc} 			from '../geometry/Arc.js';
import {Line} 			from '../geometry/Line.js';
import {AddShapeCommand} from '../core/Commands.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

export class CenterPointArcTool extends Tool
{
	constructor()
	{
		super();

		this.name 			= "Center Arc";
		this.usage 			= "Click center, click again to set radius and start angle, then click to set end angle.";

		this.arc 			= null;
		this.radiusLine		= null;
		this.centerPoint 	= null;
		this.radius 		= 0;
		this.startAngle 	= 0;
		this.step 			= 0;  // 0: pick center, 1: pick radius/start, 2: pick end angle

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		//console.log("CenterPointArcTool begin");
	}

	exit(){
		//console.log("CenterPointArcTool exit");
		this.reset();
	}

	updateCursor(){
		stage.setCursor('arc');
	}
	
	reset(){
		this.arc = null;
		this.radiusLine = null;
		this.centerPoint = null;
		this.radius = 0;
		this.startAngle = 0;
		this.step = 0;
		data.clearTempShapes();
	}

	onMouseDown(e)
	{
		const currentPoint = da.getCurrentSnapPoint();

		if(this.step === 0){
			// First click: set center point, show radius line
			this.centerPoint = {x: currentPoint.x, y: currentPoint.y};
			this.radiusLine = new Line([
				this.centerPoint.x, this.centerPoint.y,
				this.centerPoint.x, this.centerPoint.y
			]);
			data.addTempShape(this.radiusLine);
			this.step = 1;

		} else if(this.step === 1){
			// Second click: set radius and start angle, switch to arc preview
			const dx = currentPoint.x - this.centerPoint.x;
			const dy = currentPoint.y - this.centerPoint.y;
			this.radius = Math.sqrt(dx * dx + dy * dy);
			this.startAngle = Math.atan2(dy, dx);

			// Create arc with zero sweep initially
			this.arc = new Arc([
				this.centerPoint.x,
				this.centerPoint.y,
				this.radius,
				this.startAngle,
				this.startAngle
			]);
			data.clearTempShapes();
			this.radiusLine = null;
			data.addTempShape(this.arc);
			this.step = 2;

		} else if(this.step === 2){
			// Third click: commit the arc
			if(this.arc && this.radius > 0){
				this.arc.update();
				data.clearTempShapes();
				undoManager.execute(new AddShapeCommand(this.arc));
			}
			this.reset();
		}

		stage.render();
	}

	onMouseMove(e)
	{
		const currentPoint = da.getCurrentSnapPoint();

		if(this.step === 1 && this.radiusLine){
			// Update radius line preview
			this.radiusLine.end.x = currentPoint.x;
			this.radiusLine.end.y = currentPoint.y;
			this.radiusLine.update();
			stage.render();
			return;
		}

		if(this.step === 2 && this.arc){
			// Update arc end angle
			const dx = currentPoint.x - this.centerPoint.x;
			const dy = currentPoint.y - this.centerPoint.y;
			const endAngle = Math.atan2(dy, dx);

			this.arc.endAngle = endAngle;
			this.arc.update();
			stage.render();
		}
	}
	
	onMouseUp(e){
		
	}
}
