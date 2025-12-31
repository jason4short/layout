import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Ellipse} from '../geometry/Ellipse.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class OppositeCornerEllipseTool extends Tool
{
	constructor()
	{
		super();
		this.generateGuides = true;

		this.startPt	= null;
		this.ellipse	= null;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		//console.log("OppositeCornerEllipseTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("OppositeCornerEllipseTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);
		this.reset();
	}

	reset(){
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);

		this.startPt = null;
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
		this.startPt = {x: snapPt.x, y: snapPt.y};

		// Create preview ellipse (will be updated during drag)
		this.ellipse = new Ellipse([this.startPt.x, this.startPt.y, 0, 0, 0]);
		data.addTempShape(this.ellipse);

		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseUp', this.onMouseUp);

		stage.render();
	}

	onMouseMove(e)
	{
		const snapPt = data.getCurrentSnapPoint();
		this.updateEllipse(this.startPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);

		const snapPt = data.getCurrentSnapPoint();

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
		data.removeTempShape();
		data.addShape(this.ellipse);

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
