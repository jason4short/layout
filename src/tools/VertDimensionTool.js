import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Dimension} 			from '../geometry/Dimension.js';
import {AddShapeCommand} 	from '../core/Commands.js';

import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

const STATE = {
	IDLE: 0,
	FIRST_POINT: 1,
	SECOND_POINT: 2
};

export class VertDimensionTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Vert Dim";
		this.usage 	= "Click two points to measure vertical distance, then click to set offset.";

		this.generateGuides 	= false;

		this.state 				= STATE.IDLE;
		this.dimension 			= null;
		this.startPoint 		= null;
		this.endPoint 			= null;

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}

	begin(){
		this.state = STATE.IDLE;
	}

	deactivate(){
		this.reset();
	}

	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset(){
		this.state = STATE.IDLE;
		this.dimension = null;
		this.startPoint = null;
		this.endPoint = null;
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		const snap = { x: data.snapPoint.x, y: data.snapPoint.y };

		if(this.state === STATE.IDLE){
			this.startPoint = snap;

			this.dimension = new Dimension([
				snap.x, snap.y,
				snap.x, snap.y,
				0,
				'vertical'
			]);
			this.dimension.type = Shape.VERT_DIMENSION;
			this.dimension.geometry = Shape.VERT_DIMENSION;
			data.addTempShape(this.dimension);

			draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);

			this.state = STATE.FIRST_POINT;

		} else if(this.state === STATE.FIRST_POINT){
			this.endPoint = snap;

			this.dimension.end.x = snap.x;
			this.dimension.end.y = snap.y;
			this.dimension.update();

			this.state = STATE.SECOND_POINT;

		} else if(this.state === STATE.SECOND_POINT){
			// Third click - set offset and commit
			this.dimension.offset = snap.x - this.startPoint.x;
			this.dimension.update();

			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.dimension));

			this.reset();
		}

		stage.render();
	}

	onMouseMove(e){
		if(this.state === STATE.FIRST_POINT && this.dimension){
			this.dimension.end.x = data.snapPoint.x;
			this.dimension.end.y = data.snapPoint.y;
			this.dimension.update();
			stage.render();

		} else if(this.state === STATE.SECOND_POINT && this.dimension){
			this.dimension.offset = data.snapPoint.x - this.startPoint.x;
			this.dimension.update();
			stage.render();
		}
	}

	onMouseUp(e){
	}
}
