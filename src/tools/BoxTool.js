import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Line} 				from '../geometry/Line.js';
	
import toolManager 			from './ToolManager.js';
import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';
import da 					from '../geometry/DraftingAssistant.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

export class BoxTool extends Tool
{
	constructor()
	{
		super();
		this.name 	= "Rectangle";
		this.usage 	= "Click to set one corner, drag to the opposite corner to create a rectangle.";

		this.generateGuides = true;

		this.startPt		= null;
		this.previewLines	= [];  // 4 lines for box preview

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
	}

	exit(){
		this.reset();
	}

	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset()
	{
		this.startPt = null;

		// Remove preview lines
		data.clearTempShapes();
		this.previewLines = [];
	}


	onMouseDown(e)
	{
		data.resetSnaps();
		
		const snapPt = da.getCurrentSnapPoint();
		this.startPt = {x: snapPt.x, y: snapPt.y};

		// Create 4 preview lines (will be updated during drag)
		// Box corners: startPt (top-left), endPt (bottom-right)
		// Lines: top, right, bottom, left
		for(let i = 0; i < 4; i++){
			const line = new Line([this.startPt.x, this.startPt.y, this.startPt.x, this.startPt.y]);
			this.previewLines.push(line);
		}
		data.setTempShapes(this.previewLines);
		// create a guide reference from initial point
		draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);
		stage.render();
	}

	onMouseMove(e)
	{
		if(!this.startPt) return;
		
		const snapPt = da.getCurrentSnapPoint();
		this.updateBoxLines(this.startPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		if(!this.startPt) return;
		data.resetSnaps();
		const snapPt = da.getCurrentSnapPoint();
		
		// Calculate box size
		const width = Math.abs(snapPt.x - this.startPt.x);
		const height = Math.abs(snapPt.y - this.startPt.y);

		// If box is big enough // world scale!
		if(width > 5 && height > 5){
			// Update final positions and keep the lines
			for(let i = 0; i < 4; i++){
				data.addShape(this.previewLines[i]);
			}
		}
		
		this.reset()
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
