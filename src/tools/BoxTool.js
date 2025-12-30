import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Line} from '../geometry/Line.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class BoxTool extends Tool
{
	constructor()
	{
		super();
		this.willSnap = true;

		this.startPt		= null;
		this.previewLines	= [];  // 4 lines for box preview

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		//console.log("BoxTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("BoxTool exit");
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
		// Remove preview lines
		for(const line of this.previewLines){
			data.deleteShape(line);
		}
		this.previewLines = [];
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

		// Create 4 preview lines (will be updated during drag)
		// Box corners: startPt (top-left), endPt (bottom-right)
		// Lines: top, right, bottom, left
		for(let i = 0; i < 4; i++){
			const line = new Line([this.startPt.x, this.startPt.y, this.startPt.x, this.startPt.y]);
			this.previewLines.push(line);
			data.addShape(line);
		}

		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseUp', this.onMouseUp);

		stage.render();
	}

	onMouseMove(e)
	{
		const snapPt = data.getCurrentSnapPoint();
		this.updateBoxLines(this.startPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);

		const snapPt = data.getCurrentSnapPoint();

		// Calculate box size
		const width = Math.abs(snapPt.x - this.startPt.x);
		const height = Math.abs(snapPt.y - this.startPt.y);

		// If box is too small, cancel
		if(width < 5 && height < 5){
			this.reset();
			stage.render();
			return;
		}

		// Update final positions and keep the lines
		this.updateBoxLines(this.startPt, snapPt);

		// Clear references (lines stay in data.shapes)
		this.startPt = null;
		this.previewLines = [];

		stage.render();
	}

	updateBoxLines(p1, p2)
	{
		if(this.previewLines.length !== 4) return;

		// Determine actual corners
		const minX = Math.min(p1.x, p2.x);
		const maxX = Math.max(p1.x, p2.x);
		const minY = Math.min(p1.y, p2.y);
		const maxY = Math.max(p1.y, p2.y);

		// Top line
		this.previewLines[0].start.x = minX;
		this.previewLines[0].start.y = minY;
		this.previewLines[0].end.x = maxX;
		this.previewLines[0].end.y = minY;
		this.previewLines[0].update();

		// Right line
		this.previewLines[1].start.x = maxX;
		this.previewLines[1].start.y = minY;
		this.previewLines[1].end.x = maxX;
		this.previewLines[1].end.y = maxY;
		this.previewLines[1].update();

		// Bottom line
		this.previewLines[2].start.x = maxX;
		this.previewLines[2].start.y = maxY;
		this.previewLines[2].end.x = minX;
		this.previewLines[2].end.y = maxY;
		this.previewLines[2].update();

		// Left line
		this.previewLines[3].start.x = minX;
		this.previewLines[3].start.y = maxY;
		this.previewLines[3].end.x = minX;
		this.previewLines[3].end.y = minY;
		this.previewLines[3].update();
	}
}
