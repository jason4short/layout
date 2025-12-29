import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Arc} from '../geometry/Arc.js';
import {Line} from '../geometry/Line.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class FilletTool extends Tool
{
	constructor()
	{
		super();
		this.willSnap = false;

		this.firstLine 		= null;
		this.firstClickPt	= null;
		this.radius 		= 25;  // Default radius

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		console.log("FilletTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		console.log("FilletTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		this.reset();
	}

	reset(){
		this.firstLine = null;
		this.firstClickPt = null;
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
		const clickPt = {x: e.x, y: e.y};

		if(!clickedShape || clickedShape.geometry !== Shape.LINE){
			return;
		}

		if(!this.firstLine){
			// First click: select first line and store click point
			this.firstLine = clickedShape;
			this.firstClickPt = clickPt;
			this.firstLine.selected = true;
			stage.render();

		} else {
			// Second click: create fillet
			const secondLine = clickedShape;
			const secondClickPt = clickPt;

			if(secondLine === this.firstLine){
				return; // Can't fillet a line with itself
			}

			const noTrim = stage.optionKey;
			this.createFillet(this.firstLine, this.firstClickPt, secondLine, secondClickPt, this.radius, noTrim);

			this.firstLine.selected = false;
			this.reset();
			stage.render();
		}
	}

	createFillet(line1, clickPt1, line2, clickPt2, radius, noTrim)
	{
		// Find intersection of the two lines (extended if necessary)
		const intersection = this.findLineIntersection(line1, line2);

		if(!intersection){
			console.log("Lines are parallel, cannot fillet");
			return;
		}

		// Get direction vectors for each line pointing toward where user clicked
		const dir1 = this.getDirectionTowardClick(line1, intersection, clickPt1);
		const dir2 = this.getDirectionTowardClick(line2, intersection, clickPt2);

		// Calculate angle between lines
		const dot = dir1.x * dir2.x + dir1.y * dir2.y;
		const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

		if(angle < 0.01 || angle > Math.PI - 0.01){
			console.log("Lines are nearly parallel, cannot fillet");
			return;
		}

		// Angle bisector direction (points into the corner)
		const bisector = {
			x: dir1.x + dir2.x,
			y: dir1.y + dir2.y
		};
		const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);
		bisector.x /= bisectorLen;
		bisector.y /= bisectorLen;

		// Distance from intersection to arc center along bisector
		const halfAngle = angle / 2;
		const distToCenter = radius / Math.sin(halfAngle);

		// Arc center
		const center = {
			x: intersection.x + bisector.x * distToCenter,
			y: intersection.y + bisector.y * distToCenter
		};

		// Find tangent points on each line
		const tangent1 = this.findTangentPoint(center, line1, radius);
		const tangent2 = this.findTangentPoint(center, line2, radius);

		if(!tangent1 || !tangent2){
			console.log("Could not find tangent points");
			return;
		}

		// Calculate arc angles
		const angle1 = Math.atan2(tangent1.y - center.y, tangent1.x - center.x);
		const angle2 = Math.atan2(tangent2.y - center.y, tangent2.x - center.x);

		// Canvas arc() goes counterclockwise from start to end
		// Calculate counterclockwise sweep from angle1 to angle2
		let ccwSweep = angle2 - angle1;
		if(ccwSweep < 0) ccwSweep += Math.PI * 2;

		// Calculate counterclockwise sweep from angle2 to angle1
		let altSweep = angle1 - angle2;
		if(altSweep < 0) altSweep += Math.PI * 2;

		let arcStartAngle, arcEndAngle;
		if(ccwSweep <= altSweep){
			// angle1 -> angle2 is shorter
			arcStartAngle = angle1;
			arcEndAngle = angle2;
		} else {
			// angle2 -> angle1 is shorter
			arcStartAngle = angle2;
			arcEndAngle = angle1;
		}

		// Create the fillet arc
		const arc = new Arc([center.x, center.y, radius, arcStartAngle, arcEndAngle]);
		data.addShape(arc);

		// Trim lines unless noTrim is set
		if(!noTrim){
			this.trimLineToPoint(line1, tangent1, clickPt1);
			this.trimLineToPoint(line2, tangent2, clickPt2);
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

	// Get unit direction vector pointing from intersection toward click point (along the line)
	getDirectionTowardClick(line, intersection, clickPt)
	{
		// Get line direction vector
		const lineDir = {
			x: line.end.x - line.start.x,
			y: line.end.y - line.start.y
		};
		const lineLen = Math.sqrt(lineDir.x * lineDir.x + lineDir.y * lineDir.y);
		if(lineLen < 1e-10) return {x: 1, y: 0};

		// Normalize line direction
		lineDir.x /= lineLen;
		lineDir.y /= lineLen;

		// Vector from intersection to click point
		const toClick = {
			x: clickPt.x - intersection.x,
			y: clickPt.y - intersection.y
		};

		// Project onto line direction to determine which way along the line
		const dot = toClick.x * lineDir.x + toClick.y * lineDir.y;

		// Return direction along line toward click
		if(dot >= 0){
			return {x: lineDir.x, y: lineDir.y};
		} else {
			return {x: -lineDir.x, y: -lineDir.y};
		}
	}

	// Find the point on a line closest to center (tangent point)
	findTangentPoint(center, line, radius)
	{
		const ax = line.start.x, ay = line.start.y;
		const bx = line.end.x, by = line.end.y;

		const dx = bx - ax;
		const dy = by - ay;
		const lenSq = dx * dx + dy * dy;

		if(lenSq < 1e-10) return null;

		// Project center onto the infinite line
		const t = ((center.x - ax) * dx + (center.y - ay) * dy) / lenSq;

		return {
			x: ax + t * dx,
			y: ay + t * dy
		};
	}

	// Trim a line at the tangent point, keeping the segment that contains the click point
	trimLineToPoint(line, tangentPoint, clickPt)
	{
		// Get line direction
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const lenSq = dx * dx + dy * dy;

		if(lenSq < 1e-10) return;

		// Project tangent point onto line to get t value (0 = start, 1 = end)
		const tTangent = ((tangentPoint.x - line.start.x) * dx + (tangentPoint.y - line.start.y) * dy) / lenSq;

		// Project click point onto line to get t value
		const tClick = ((clickPt.x - line.start.x) * dx + (clickPt.y - line.start.y) * dy) / lenSq;

		// Keep the segment from tangent point toward click point
		if(tClick > tTangent){
			// Click is toward end, keep tangent->end, trim start
			line.start.x = tangentPoint.x;
			line.start.y = tangentPoint.y;
		} else {
			// Click is toward start, keep start->tangent, trim end
			line.end.x = tangentPoint.x;
			line.end.y = tangentPoint.y;
		}

		line.update();
	}
}
