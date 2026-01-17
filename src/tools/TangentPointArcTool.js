import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {TangentArc} 	from '../geometry/TangentArc.js';
import {Line} 			from '../geometry/Line.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

import {AddShapeCommand} from '../core/Commands.js';

export class TangentPointArcTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Tangent Arc";
		this.usage 	= "Click start point, drag to set tangent direction, then click end point.";

		this.arc 			= null;
		this.tangentLine	= null;
		this.startPoint 	= null;
		this.tangentPoint 	= null;
		this.step 			= 0;  // 0: pick start, 1: pick tangent direction, 2: pick endpoint

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
	}

	begin(){
		//console.log("TangentPointArcTool begin");
	}

	exit(){
		//console.log("TangentPointArcTool exit");
		this.reset();
	}
	updateCursor(){
		stage.setCursor('arcTan');
	}

	reset(){
		this.arc = null;
		this.tangentLine = null;
		this.startPoint = null;
		this.tangentPoint = null;
		this.step = 0;
		data.clearTempShapes();
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		const currentPoint = da.getCurrentSnapPoint();

		if(this.step === 0){
			// First click: set start point, show tangent line
			this.startPoint = {x: currentPoint.x, y: currentPoint.y};
			this.tangentLine = new Line([
				this.startPoint.x, this.startPoint.y,
				this.startPoint.x, this.startPoint.y
			]);
			data.addTempShape(this.tangentLine);
			this.step = 1;

		} else if(this.step === 1){
			// Second click: set tangent direction, keep line visible for now
			this.tangentPoint = {x: currentPoint.x, y: currentPoint.y};
			this.step = 2;

		} else if(this.step === 2){
			// Third click: commit the arc
			if(this.arc){
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

		if(this.step === 1 && this.tangentLine){
			// Update tangent line preview
			this.tangentLine.end.x = currentPoint.x;
			this.tangentLine.end.y = currentPoint.y;
			this.tangentLine.update();
			stage.render();
			return;
		}

		if(this.step === 2){
			// Create/update TangentArc from start, tangent, and current endpoint
			if(!this.arc){
				// Switch from tangent line to arc
				this.tangentLine = null;
				data.clearTempShapes();
				this.arc = new TangentArc([
					this.startPoint.x, this.startPoint.y,
					this.tangentPoint.x, this.tangentPoint.y,
					currentPoint.x, currentPoint.y
				]);
				data.addTempShape(this.arc);
			} else {
				// Update endpoint
				this.arc.endPoint.x = currentPoint.x;
				this.arc.endPoint.y = currentPoint.y;
				this.arc.recalculate();
			}
			stage.render();
		}
	}
	
	onMouseUp(e){

	}
}
