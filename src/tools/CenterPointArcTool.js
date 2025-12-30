import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Arc} from '../geometry/Arc.js';
import {Line} from '../geometry/Line.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class CenterPointArcTool extends Tool
{
	constructor()
	{
		super();

		this.arc 			= null;
		this.radiusLine		= null;
		this.centerPoint 	= null;
		this.radius 		= 0;
		this.startAngle 	= 0;
		this.step 			= 0;  // 0: pick center, 1: pick radius/start, 2: pick end angle

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		//console.log("CenterPointArcTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("CenterPointArcTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		this.reset();
	}

	reset(){
		this.arc = null;
		this.radiusLine = null;
		this.centerPoint = null;
		this.radius = 0;
		this.startAngle = 0;
		this.step = 0;
		data.removeTempShape();
	}

	onKeyUp(e){
		if(e.key === 'Escape'){
			this.reset();
			stage.render();
		}
	}

	onMouseDown(e)
	{
		const currentPoint = data.getCurrentSnapPoint();

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
			data.removeTempShape();
			this.radiusLine = null;
			data.addTempShape(this.arc);
			this.step = 2;

		} else if(this.step === 2){
			// Third click: commit the arc
			if(this.arc && this.radius > 0){
				this.arc.update();
				data.addShape(this.arc);
				data.removeTempShape();
			}
			this.reset();
		}

		stage.render();
	}

	onMouseMove(e)
	{
		const currentPoint = data.getCurrentSnapPoint();

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
}
