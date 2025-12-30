import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Line} from '../geometry/Line.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class ChamferTool extends Tool
{
	constructor()
	{
		super();
		this.willSnap = false;

		this.firstLine 		= null;
		this.distance 		= 25;  // Default chamfer distance

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		//console.log("ChamferTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("ChamferTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		this.reset();
	}

	reset(){
		this.firstLine = null;
	}

	onKeyUp(e){
		if(e.key === 'Escape'){
			this.reset();
			stage.render();
		}
	}

	onMouseDown(e)
	{
		const clickedShape = data.getTargetShape(e);

		if(!clickedShape || clickedShape.geometry !== Shape.LINE){
			return;
		}

		if(!this.firstLine){
			// First click: select first line
			this.firstLine = clickedShape;
			this.firstLine.selected = true;
			stage.render();

		} else {
			// Second click: create chamfer
			const secondLine = clickedShape;

			if(secondLine === this.firstLine){
				return; // Can't chamfer a line with itself
			}

			const noTrim = stage.optionKey;
			this.createChamfer(this.firstLine, secondLine, this.distance, noTrim);

			this.firstLine.selected = false;
			this.reset();
			stage.render();
		}
	}

	createChamfer(line1, line2, distance, noTrim)
	{
		// Find intersection of the two lines (extended if necessary)
		const intersection = this.findLineIntersection(line1, line2);

		if(!intersection){
			console.log("Lines are parallel, cannot chamfer");
			return;
		}

		// Get direction vectors for each line pointing away from intersection
		const dir1 = this.getDirectionFromIntersection(line1, intersection);
		const dir2 = this.getDirectionFromIntersection(line2, intersection);

		// Calculate chamfer points at specified distance from intersection
		const chamferPoint1 = {
			x: intersection.x + dir1.x * distance,
			y: intersection.y + dir1.y * distance
		};

		const chamferPoint2 = {
			x: intersection.x + dir2.x * distance,
			y: intersection.y + dir2.y * distance
		};

		// Create the chamfer line
		const chamferLine = new Line([
			chamferPoint1.x, chamferPoint1.y,
			chamferPoint2.x, chamferPoint2.y
		]);
		data.addShape(chamferLine);

		// Trim lines unless noTrim is set
		if(!noTrim){
			this.trimLineToPoint(line1, chamferPoint1, intersection);
			this.trimLineToPoint(line2, chamferPoint2, intersection);
		}
	}

	// Find intersection point of two lines (extended infinitely)
	findLineIntersection(line1, line2)
	{
		const x1 = line1.start.x, y1 = line1.start.y;
		const x2 = line1.end.x, y2 = line1.end.y;
		const x3 = line2.start.x, y3 = line2.start.y;
		const x4 = line2.end.x, y4 = line2.end.y;

		const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

		if(Math.abs(denom) < 1e-10){
			return null; // Parallel lines
		}

		const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

		return {
			x: x1 + t * (x2 - x1),
			y: y1 + t * (y2 - y1)
		};
	}

	// Get unit direction vector pointing away from intersection
	getDirectionFromIntersection(line, intersection)
	{
		// Find which endpoint is farther from intersection
		const distToStart = Math.sqrt(
			(line.start.x - intersection.x) ** 2 + (line.start.y - intersection.y) ** 2
		);
		const distToEnd = Math.sqrt(
			(line.end.x - intersection.x) ** 2 + (line.end.y - intersection.y) ** 2
		);

		let dir;
		if(distToStart > distToEnd){
			dir = {x: line.start.x - intersection.x, y: line.start.y - intersection.y};
		} else {
			dir = {x: line.end.x - intersection.x, y: line.end.y - intersection.y};
		}

		const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
		if(len < 1e-10) return {x: 1, y: 0};

		return {x: dir.x / len, y: dir.y / len};
	}

	// Trim a line to end at the chamfer point (keep the part away from intersection)
	trimLineToPoint(line, chamferPoint, intersection)
	{
		// Determine which end of the line is closer to intersection
		const distStartToInt = Math.sqrt(
			(line.start.x - intersection.x) ** 2 + (line.start.y - intersection.y) ** 2
		);
		const distEndToInt = Math.sqrt(
			(line.end.x - intersection.x) ** 2 + (line.end.y - intersection.y) ** 2
		);

		if(distStartToInt < distEndToInt){
			// Start is closer to intersection, so trim the start
			line.start.x = chamferPoint.x;
			line.start.y = chamferPoint.y;
		} else {
			// End is closer to intersection, so trim the end
			line.end.x = chamferPoint.x;
			line.end.y = chamferPoint.y;
		}

		line.update();
	}
}
