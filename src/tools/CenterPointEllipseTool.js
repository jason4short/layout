import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Ellipse} from '../geometry/Ellipse.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class CenterPointEllipseTool extends Tool
{
	constructor()
	{
		super();
		this.willSnap = true;

		this.centerPt	= null;
		this.ellipse	= null;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		//console.log("CenterPointEllipseTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("CenterPointEllipseTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);
		this.reset();
	}

	reset(){
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);

		this.centerPt = null;
		if(this.ellipse){
			data.removeTempShape();
			this.ellipse = null;
		}
	}

	onKeyUp(e){
		if(e.key === 'Escape'){
			this.reset();
			stage.render();
		}
	}

	onMouseDown(e)
	{
		const snapPt = data.getCurrentSnapPoint();
		this.centerPt = {x: snapPt.x, y: snapPt.y};

		// Create preview ellipse at center (will be updated during drag)
		this.ellipse = new Ellipse([this.centerPt.x, this.centerPt.y, 0, 0, 0]);
		data.addTempShape(this.ellipse);

		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseUp', this.onMouseUp);

		stage.render();
	}

	onMouseMove(e)
	{
		const snapPt = data.getCurrentSnapPoint();
		this.updateEllipse(this.centerPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);

		const snapPt = data.getCurrentSnapPoint();

		// Calculate ellipse size
		const radiusX = Math.abs(snapPt.x - this.centerPt.x);
		const radiusY = Math.abs(snapPt.y - this.centerPt.y);

		// If ellipse is too small, cancel
		if(radiusX < 5 && radiusY < 5){
			this.reset();
			stage.render();
			return;
		}

		// Finalize ellipse
		this.updateEllipse(this.centerPt, snapPt);
		data.removeTempShape();
		data.addShape(this.ellipse);

		// Clear references
		this.centerPt = null;
		this.ellipse = null;

		stage.render();
	}

	updateEllipse(center, corner)
	{
		if(!this.ellipse) return;

		// Center stays fixed, radii are distances to corner
		const radiusX = Math.abs(corner.x - center.x);
		const radiusY = Math.abs(corner.y - center.y);

		this.ellipse.x = center.x;
		this.ellipse.y = center.y;
		this.ellipse.radiusX = radiusX;
		this.ellipse.radiusY = radiusY;
		this.ellipse.update();
	}
}
