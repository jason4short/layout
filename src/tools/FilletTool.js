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
		this.generateGuides = false;
		
		this.firstLine 		= null;
		this.firstClickPt	= null;
		this.radius 		= 25;  // Default radius
		this.linePreview	= null;
		this.isDragging		= false;

		// For radius adjustment after creation
		this.lastArc 		= null;
		this.lastLine1 		= null;
		this.lastLine2 		= null;
		this.lastLine1Original = null;  // {start: {x,y}, end: {x,y}}
		this.lastLine2Original = null;
		this.lastClickPt1 	= null;
		this.lastClickPt2 	= null;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
		this.updateRadius 	= this.updateRadius.bind(this);
	}

	begin(){
		//console.log("FilletTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("FilletTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);
		this.reset();
	}

	reset(){
		// Clean up listeners
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);

		if(this.firstLine){
			this.firstLine.selected = false;
		}
		this.firstLine = null;
		this.firstClickPt = null;
		this.isDragging = false;
		if(this.linePreview){
			data.removeTempShape();
			this.linePreview = null;
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
		const clickPt = {x: e.x, y: e.y};
		const snapPt = data.getCurrentSnapPoint();

		// Option-click: single-click fillet near intersection
		if(stage.optionKey){
			this.singleClickFillet(clickPt);
			return;
		}

		const clickedShape = data.getTargetShape(e);

		// If no shape clicked, reset as if Escape was pressed
		if(!clickedShape || clickedShape.geometry !== Shape.LINE){
			if(this.firstLine){
				this.reset();
				stage.render();
			}
			return;
		}

		if(!this.firstLine){
			// First click: select first line and store click point
			this.firstLine = clickedShape;
			this.firstClickPt = clickPt;
			this.firstLine.selected = true;
			this.isDragging = true;

			// Create line preview starting at snap point
			this.linePreview = new Line([snapPt.x, snapPt.y, snapPt.x, snapPt.y]);
			data.addTempShape(this.linePreview);

			// Add drag listeners
			stage.addEventListener('mouseMove', this.onMouseMove);
			stage.addEventListener('mouseUp', this.onMouseUp);

			stage.render();

		} else {
			// Second click: create fillet
			const secondLine = clickedShape;
			const secondClickPt = clickPt;

			if(secondLine === this.firstLine){
				return; // Can't fillet a line with itself
			}

			// Remove preview listener before completing
			stage.removeEventListener('mouseMove', this.onMouseMove);

			this.createFillet(this.firstLine, this.firstClickPt, secondLine, secondClickPt, this.radius, false);
			this.reset();
			this.showRadiusInput();
			stage.render();
		}
	}

	onMouseMove(e)
	{
		const snapPt = data.getCurrentSnapPoint();

		// Update line preview to snap point
		if(this.linePreview){
			this.linePreview.end.x = snapPt.x;
			this.linePreview.end.y = snapPt.y;
			this.linePreview.update();
			stage.render();
		}
	}

	onMouseUp(e)
	{
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseUp', this.onMouseUp);

		const releasePt = {x: e.x, y: e.y};

		// Check if we dragged to a second line
		const secondLine = data.getTargetShape(e);

		// Calculate drag distance
		const dragDist = Math.sqrt(
			(releasePt.x - this.firstClickPt.x) ** 2 +
			(releasePt.y - this.firstClickPt.y) ** 2
		);

		// If released over a valid second line, complete the fillet
		if(secondLine && secondLine.geometry === Shape.LINE &&
		   secondLine !== this.firstLine){
			this.createFillet(this.firstLine, this.firstClickPt, secondLine, releasePt, this.radius, false);
			this.reset();
			this.showRadiusInput();
			stage.render();
		} else if(dragDist < 5){
			// Small drag = click, stay in waiting-for-second-click mode
			this.isDragging = false;
			stage.addEventListener('mouseMove', this.onMouseMove);
		} else {
			// Dragged but released on empty space - reset
			this.reset();
			stage.render();
		}
	}

	// Single-click fillet: find two lines at nearest intersection
	singleClickFillet(clickPt)
	{
		// Get all lines
		const lines = data.getShapes().filter(s => s.geometry === Shape.LINE);

		if(lines.length < 2) return;

		// Find best intersection near click
		let bestIntersection = null;
		let bestDist = Infinity;
		let bestPair = null;

		for(let i = 0; i < lines.length; i++){
			for(let j = i + 1; j < lines.length; j++){
				const intersection = this.findLineIntersection(lines[i], lines[j]);
				if(intersection){
					const dist = Math.sqrt(
						(intersection.x - clickPt.x) ** 2 +
						(intersection.y - clickPt.y) ** 2
					);
					if(dist < bestDist){
						bestDist = dist;
						bestIntersection = intersection;
						bestPair = [lines[i], lines[j]];
					}
				}
			}
		}

		// Only proceed if intersection is reasonably close (within 40 pixels)
		if(!bestIntersection || bestDist > 80){
			console.log("No intersection found near click");
			return;
		}

		const line1 = bestPair[0];
		const line2 = bestPair[1];

		// Use click point as the "corner" point - fillet will trim toward click
		this.createFillet(line1, clickPt, line2, clickPt, this.radius, false);
		this.showRadiusInput();
		stage.render();
	}

	createFillet(line1, clickPt1, line2, clickPt2, radius, noTrim, saveState = true)
	{
		// Find intersection of the two lines (extended if necessary)
		const intersection = this.findLineIntersection(line1, line2);

		if(!intersection){
			console.log("Lines are parallel, cannot fillet");
			return null;
		}

		// Save original line state for radius adjustment (before trimming)
		if(saveState){
			this.lastLine1 = line1;
			this.lastLine2 = line2;
			this.lastLine1Original = {
				start: {x: line1.start.x, y: line1.start.y},
				end: {x: line1.end.x, y: line1.end.y}
			};
			this.lastLine2Original = {
				start: {x: line2.start.x, y: line2.start.y},
				end: {x: line2.end.x, y: line2.end.y}
			};
			this.lastClickPt1 = clickPt1;
			this.lastClickPt2 = clickPt2;
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

		// Always store arc reference for radius adjustment
		this.lastArc = arc;

		// Trim lines unless noTrim is set
		if(!noTrim){
			this.trimLineToPoint(line1, tangent1, intersection, dir1);
			this.trimLineToPoint(line2, tangent2, intersection, dir2);
		}

		return arc;
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

	// Trim a line at the tangent point, keeping the segment away from intersection
	trimLineToPoint(line, tangentPoint, intersection, direction)
	{
		// Get line direction
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const lenSq = dx * dx + dy * dy;

		if(lenSq < 1e-10) return;

		// Normalize line direction
		const len = Math.sqrt(lenSq);
		const lineDirX = dx / len;
		const lineDirY = dy / len;

		// Check if the "keep" direction (away from intersection) aligns with line's start->end
		// direction.x/y points from intersection toward the side we want to keep
		const dot = direction.x * lineDirX + direction.y * lineDirY;

		if(dot > 0){
			// Keep direction aligns with start->end, so keep tangent->end
			line.start.x = tangentPoint.x;
			line.start.y = tangentPoint.y;
		} else {
			// Keep direction is opposite, so keep start->tangent
			line.end.x = tangentPoint.x;
			line.end.y = tangentPoint.y;
		}

		line.update();
	}

	// Show radius input and set up callback for user input
	showRadiusInput(){
		stage.setInputCallback(this.updateRadius);
		stage.setDimensionInputValue(this.radius);
	}

	// Called when user types a new radius value - redo the fillet with new radius
	updateRadius(newRadius){
		const r = parseFloat(newRadius);
		if(isNaN(r) || r <= 0){
			return;
		}

		// Check if we have a previous fillet to adjust
		if(!this.lastArc || !this.lastLine1 || !this.lastLine2){
			this.radius = r;
			return;
		}

		// Delete the old arc
		data.deleteShape(this.lastArc);

		// Restore lines to their original state
		this.lastLine1.start.x = this.lastLine1Original.start.x;
		this.lastLine1.start.y = this.lastLine1Original.start.y;
		this.lastLine1.end.x = this.lastLine1Original.end.x;
		this.lastLine1.end.y = this.lastLine1Original.end.y;
		this.lastLine1.update();

		this.lastLine2.start.x = this.lastLine2Original.start.x;
		this.lastLine2.start.y = this.lastLine2Original.start.y;
		this.lastLine2.end.x = this.lastLine2Original.end.x;
		this.lastLine2.end.y = this.lastLine2Original.end.y;
		this.lastLine2.update();

		// Update radius and create new fillet (saveState = false to keep using same originals)
		this.radius = r;
		this.createFillet(
			this.lastLine1, this.lastClickPt1,
			this.lastLine2, this.lastClickPt2,
			this.radius, false, false
		);

		stage.render();
	}
}
