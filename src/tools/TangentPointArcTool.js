import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Arc} from '../geometry/Arc.js';
import {Line} from '../geometry/Line.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class TangentPointArcTool extends Tool
{
	constructor()
	{
		super();

		this.arc 			= null;
		this.tangentLine	= null;
		this.startPoint 	= null;
		this.tangentPoint 	= null;
		this.step 			= 0;  // 0: pick start, 1: pick tangent direction, 2: pick endpoint

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onKeyUp 		= this.onKeyUp.bind(this);
	}

	begin(){
		//console.log("TangentPointArcTool begin");
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		//console.log("TangentPointArcTool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		this.reset();
	}

	reset(){
		this.arc = null;
		this.tangentLine = null;
		this.startPoint = null;
		this.tangentPoint = null;
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
		data.resetSnaps();
		const currentPoint = data.getCurrentSnapPoint();

		if(this.step === 0){
			// First click: set start point, show tangent line
			this.startPoint = {x: currentPoint.x, y: currentPoint.y};
			this.tangentLine = new Line([
				this.startPoint.x, this.startPoint.y,
				this.startPoint.x, this.startPoint.y
			]);
			data.addTempShape(this.tangentLine);
			this.step = 1;

		} else if(this.step === 1){
			// Second click: set tangent direction, keep line visible for now
			this.tangentPoint = {x: currentPoint.x, y: currentPoint.y};
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

		if(this.step === 1 && this.tangentLine){
			// Update tangent line preview
			this.tangentLine.end.x = currentPoint.x;
			this.tangentLine.end.y = currentPoint.y;
			this.tangentLine.update();
			stage.render();
			return;
		}

		if(this.step === 2){
			// Calculate arc from start point, tangent direction, and endpoint
			const arcParams = this.calculateTangentArc(
				this.startPoint,
				this.tangentPoint,
				currentPoint
			);

			if(arcParams){
				if(!this.arc){
					// Switch from tangent line to arc
					this.tangentLine = null;
					data.removeTempShape();
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
	}

	// Calculate arc that starts at startPoint, is tangent to line startPoint->tangentPoint,
	// and ends at endPoint
	calculateTangentArc(startPoint, tangentPoint, endPoint)
	{
		// Tangent direction vector
		const tx = tangentPoint.x - startPoint.x;
		const ty = tangentPoint.y - startPoint.y;
		const tLen = Math.sqrt(tx * tx + ty * ty);

		if(tLen < 1e-10) return null;

		// Normalized tangent
		const tnx = tx / tLen;
		const tny = ty / tLen;

		// Vector from start to end
		const dx = endPoint.x - startPoint.x;
		const dy = endPoint.y - startPoint.y;
		const dLen = Math.sqrt(dx * dx + dy * dy);

		if(dLen < 1e-10) return null;

		// The center lies on the perpendicular to the tangent at startPoint
		// Perpendicular direction (rotate tangent 90 degrees)
		const px = -tny;
		const py = tnx;

		// The center also lies on the perpendicular bisector of start-end chord
		// Midpoint of chord
		const mx = (startPoint.x + endPoint.x) / 2;
		const my = (startPoint.y + endPoint.y) / 2;

		// Direction perpendicular to chord
		const cx = -dy;
		const cy = dx;

		// Find intersection of:
		// Line 1: startPoint + t * (px, py)
		// Line 2: midpoint + s * (cx, cy)

		const denom = px * cy - py * cx;
		if(Math.abs(denom) < 1e-10) return null; // parallel lines

		const t = ((mx - startPoint.x) * cy - (my - startPoint.y) * cx) / denom;

		// Center point
		const centerX = startPoint.x + t * px;
		const centerY = startPoint.y + t * py;

		// Radius
		const radius = Math.abs(t);

		if(radius < 1e-10) return null;

		// Calculate angles
		const startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
		const endAngle = Math.atan2(endPoint.y - centerY, endPoint.x - centerX);

		// Determine direction: the arc should curve away from the tangent direction
		// Check if we need to go CW or CCW
		// The tangent at startPoint should match the given tangent direction
		// Tangent to circle at a point is perpendicular to radius
		// If center is at angle θ from start, tangent is at angle θ + 90° (CCW) or θ - 90° (CW)

		const radiusAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
		const expectedTangentCCW = radiusAngle + Math.PI / 2;
		const expectedTangentCW = radiusAngle - Math.PI / 2;

		const tangentAngle = Math.atan2(tny, tnx);

		// Normalize angle difference
		const diffCCW = this.normalizeAngle(tangentAngle - expectedTangentCCW);
		const diffCW = this.normalizeAngle(tangentAngle - expectedTangentCW);

		// Choose direction based on which tangent matches better
		const goCCW = Math.abs(diffCCW) < Math.abs(diffCW);

		if(goCCW){
			return {
				cx: centerX,
				cy: centerY,
				radius: radius,
				startAngle: startAngle,
				endAngle: endAngle
			};
		} else {
			// Swap direction
			return {
				cx: centerX,
				cy: centerY,
				radius: radius,
				startAngle: endAngle,
				endAngle: startAngle
			};
		}
	}

	normalizeAngle(angle){
		while(angle > Math.PI) angle -= Math.PI * 2;
		while(angle < -Math.PI) angle += Math.PI * 2;
		return angle;
	}
}
