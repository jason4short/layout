import {Tool} from './Tool.js';

import {Shape, Geometry} 	from '../geometry/Geometry.js';
import {Arc} 				from '../geometry/Arc.js';
import {Line} 				from '../geometry/Line.js';
import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';

export class ThreePointArcTool extends Tool
{
	constructor()
	{
		super();

		this.arc 			= null;
		this.linePreview	= null;
		this.startPoint 	= null;
		this.endPoint 		= null;
		this.step 			= 0;  // 0: waiting for start, 1: waiting for end, 2: waiting for mid

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		console.log("ThreePointArcTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		console.log("ThreePointArcTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		this.reset();
	}

	reset(){
		this.arc 			= null;
		this.linePreview 	= null;
		this.startPoint 	= null;
		this.endPoint 		= null;
		this.step 			= 0;
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
			// First click: set start point and create line preview
			this.startPoint = {x: currentPoint.x, y: currentPoint.y};
			this.linePreview = new Line([
				this.startPoint.x, this.startPoint.y,
				this.startPoint.x, this.startPoint.y
			]);
			data.addTempShape(this.linePreview);
			this.step = 1;

		} else if(this.step === 1){
			// Second click: set end point, keep line as chord preview until mouse moves
			this.endPoint = {x: currentPoint.x, y: currentPoint.y};

			// Update line to show the chord (start to end)
			this.linePreview.end.x = this.endPoint.x;
			this.linePreview.end.y = this.endPoint.y;
			this.linePreview.update();
			this.step = 2;

		} else if(this.step === 2){
			// Third click: commit the arc
			if(this.arc){
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

		// Step 1: update line preview
		if(this.step === 1 && this.linePreview){
			this.linePreview.end.x = currentPoint.x;
			this.linePreview.end.y = currentPoint.y;
			this.linePreview.update();
			stage.render();
			return;
		}

		if(this.step < 2){
			return;
		}

		// Calculate arc from 3 points: startPoint, endPoint, currentPoint
		const arcParams = Arc.calculateArcFrom3Points(
			this.startPoint,
			this.endPoint,
			currentPoint
		);

		if(arcParams){
			if(!this.arc){
				// Switch from line preview to arc preview
				if(this.linePreview){
					this.linePreview = null;
					data.removeTempShape();
				}
				this.arc = new Arc([
					arcParams.cx,
					arcParams.cy,
					arcParams.radius,
					arcParams.startAngle,
					arcParams.endAngle
				]);
				data.addTempShape(this.arc);
			} else {
				this.arc.x 				= arcParams.cx;
				this.arc.y 				= arcParams.cy;
				this.arc.radius 		= arcParams.radius;
				this.arc.startAngle	 	= arcParams.startAngle;
				this.arc.endAngle 		= arcParams.endAngle;
				this.arc.update();
			}
		}

		stage.render();
	}

}
