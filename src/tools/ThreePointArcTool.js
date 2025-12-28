import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Arc} from '../geometry/Arc.js';
import {Line} from '../geometry/Line.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

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
		this.arc = null;
		this.linePreview = null;
		this.startPoint = null;
		this.endPoint = null;
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
		const arcParams = this.calculateArcFrom3Points(
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
				this.arc.x = arcParams.cx;
				this.arc.y = arcParams.cy;
				this.arc.radius = arcParams.radius;
				this.arc.startAngle = arcParams.startAngle;
				this.arc.endAngle = arcParams.endAngle;
				this.arc.update();
			}
		}

		stage.render();
	}

	// Calculate arc parameters from 3 points
	// Returns {cx, cy, radius, startAngle, endAngle} or null if collinear
	calculateArcFrom3Points(p1, p2, p3)
	{
		// Find circumcenter of triangle formed by 3 points
		const ax = p1.x, ay = p1.y;
		const bx = p2.x, by = p2.y;
		const cx = p3.x, cy = p3.y;

		const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

		// Points are collinear
		if(Math.abs(d) < 1e-10){
			return null;
		}

		const aSq = ax * ax + ay * ay;
		const bSq = bx * bx + by * by;
		const cSq = cx * cx + cy * cy;

		const centerX = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d;
		const centerY = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d;

		const radius = Math.sqrt((ax - centerX) ** 2 + (ay - centerY) ** 2);

		// Calculate angles for each point
		const angle1 = Math.atan2(ay - centerY, ax - centerX);
		const angle2 = Math.atan2(by - centerY, bx - centerX);
		const angle3 = Math.atan2(cy - centerY, cx - centerX);

		// Determine arc direction: does going from angle1 to angle2 pass through angle3?
		// We need to check both directions and pick the one that includes angle3

		const normalizeAngle = (a) => {
			while(a < 0) a += Math.PI * 2;
			while(a >= Math.PI * 2) a -= Math.PI * 2;
			return a;
		};

		const norm1 = normalizeAngle(angle1);
		const norm2 = normalizeAngle(angle2);
		const norm3 = normalizeAngle(angle3);

		// Check if angle3 is between angle1 and angle2 going counterclockwise
		const ccwContains = this.angleInRange(norm3, norm1, norm2);

		let startAngle, endAngle;

		if(ccwContains){
			// CCW from p1 to p2 contains p3
			startAngle = angle1;
			endAngle = angle2;
		} else {
			// CW from p1 to p2 contains p3, so swap to go the other way
			startAngle = angle2;
			endAngle = angle1;
		}

		return {
			cx: centerX,
			cy: centerY,
			radius: radius,
			startAngle: startAngle,
			endAngle: endAngle
		};
	}

	// Check if angle is in range from start to end (counterclockwise)
	angleInRange(angle, start, end)
	{
		const TWO_PI = Math.PI * 2;

		// Normalize all to [0, 2PI)
		const normalize = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

		const a = normalize(angle);
		const s = normalize(start);
		const e = normalize(end);

		if(s <= e){
			return a >= s && a <= e;
		} else {
			// Wraps around 0
			return a >= s || a <= e;
		}
	}
}
