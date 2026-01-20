import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
import * as AngleUtils from './utils/AngleUtils.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';

// Arc defined by start point, tangent direction, and end point
// The tangent handle can be edited to change the arc's curvature
export class TangentArc extends Geometry
{
	constructor(params)
	{
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.TANGENT_ARC;

		// Primary constraint points
		// params: [startX, startY, tangentX, tangentY, endX, endY]
		this.startPoint = new Point(params[0], params[1]);
		this.tangentPoint = new Point(params[2], params[3]);
		this.endPoint = new Point(params[4], params[5]);

		// Derived arc properties (calculated from constraints)
		this.x = 0;           // center x
		this.y = 0;           // center y
		this.radius = 0;
		this.startAngle = 0;
		this.endAngle = 0;

		this.recalculate();
	}

	update() {
		this.recalculate();
	}

	// Recalculate arc geometry from the three constraint points
	recalculate() {
		const startPoint = this.startPoint;
		const tangentPoint = this.tangentPoint;
		const endPoint = this.endPoint;

		// Tangent direction vector
		const tangentVec = VectorUtils.vectorBetweenPoints(startPoint, tangentPoint);
		const tLen = VectorUtils.length(tangentVec);

		if (tLen < 1e-10) {
			this.radius = 0;
			return;
		}

		// Normalized tangent
		const tangentNorm = VectorUtils.normalize(tangentVec);

		// Vector from start to end
		const chordVec = VectorUtils.vectorBetweenPoints(startPoint, endPoint);
		const dLen = VectorUtils.length(chordVec);

		if (dLen < 1e-10) {
			this.radius = 0;
			return;
		}

		// The center lies on the perpendicular to the tangent at startPoint
		// Perpendicular direction (rotate tangent 90 degrees)
		const perpDir = VectorUtils.perpendicular(tangentNorm);

		// The center also lies on the perpendicular bisector of start-end chord
		// Midpoint of chord
		const midpoint = {
			x: (startPoint.x + endPoint.x) / 2,
			y: (startPoint.y + endPoint.y) / 2
		};

		// Direction perpendicular to chord
		const chordPerp = { x: -chordVec.y, y: chordVec.x };

		// Find intersection of:
		// Line 1: startPoint + t * perpDir
		// Line 2: midpoint + s * chordPerp
		const denom = perpDir.x * chordPerp.y - perpDir.y * chordPerp.x;

		if (Math.abs(denom) < 1e-10) {
			this.radius = 0;
			return;
		}

		const t = ((midpoint.x - startPoint.x) * chordPerp.y - (midpoint.y - startPoint.y) * chordPerp.x) / denom;

		// Center point
		this.x = startPoint.x + t * perpDir.x;
		this.y = startPoint.y + t * perpDir.y;

		// Radius
		this.radius = Math.abs(t);

		if (this.radius < 1e-10) {
			return;
		}

		// Calculate angles
		const startAngle = Math.atan2(startPoint.y - this.y, startPoint.x - this.x);
		const endAngle = Math.atan2(endPoint.y - this.y, endPoint.x - this.x);

		// Determine direction: the arc should curve away from the tangent direction
		const radiusAngle = Math.atan2(startPoint.y - this.y, startPoint.x - this.x);
		const expectedTangentCCW = radiusAngle + Math.PI / 2;
		const expectedTangentCW = radiusAngle - Math.PI / 2;

		const tangentAngle = Math.atan2(tangentNorm.y, tangentNorm.x);

		const diffCCW = AngleUtils.normalizeAngleSigned(tangentAngle - expectedTangentCCW);
		const diffCW = AngleUtils.normalizeAngleSigned(tangentAngle - expectedTangentCW);

		const goCCW = Math.abs(diffCCW) < Math.abs(diffCW);

		if (goCCW) {
			this.startAngle = startAngle;
			this.endAngle = endAngle;
		} else {
			this.startAngle = endAngle;
			this.endAngle = startAngle;
		}

		this.updateBoundingBox();
	}

	updateBoundingBox() {
		// Conservative bounding box
		this.bounds.x = this.x - this.radius;
		this.bounds.y = this.y - this.radius;
		this.bounds.width = this.radius * 2;
		this.bounds.height = this.radius * 2;
	}

	// POIs: start, tangent handle, end
	getSnapPOIs() {
		return [
			this.startPoint,
			this.tangentPoint,
			this.endPoint
		];
	}

	// Check if angle is within arc range
	containsAngle(angle) {
		return AngleUtils.isAngleInRange(angle, this.startAngle, this.endAngle);
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		if (this.radius <= 0) return null;

		const centerPoint = new Point(this.x, this.y);
		const distanceToCenter = this.distanceBetweenPoints(mouse, centerPoint);

		if (distanceToCenter === 0) return null;

		const distanceFromPerimeter = Math.abs(distanceToCenter - this.radius);

		if (distanceFromPerimeter > pixelTolerance) return null;

		const directionX = (mouse.x - this.x) / distanceToCenter;
		const directionY = (mouse.y - this.y) / distanceToCenter;

		const angle = Math.atan2(directionY, directionX);
		if (!this.containsAngle(angle)) {
			return null;
		}

		const point = new Point(
			this.x + (directionX * this.radius),
			this.y + (directionY * this.radius)
		);

		point.distance = this.distanceBetweenPoints(mouse, point);

		return point;
	}

	clone() {
		const t = new TangentArc([
			this.startPoint.x, this.startPoint.y,
			this.tangentPoint.x, this.tangentPoint.y,
			this.endPoint.x, this.endPoint.y
		]);
		t.type = this.type;
		t.groupId = this.groupId;
		return t;
	}

	copyFrom(other) {
		this.startPoint.x = other.startPoint.x;
		this.startPoint.y = other.startPoint.y;
		this.tangentPoint.x = other.tangentPoint.x;
		this.tangentPoint.y = other.tangentPoint.y;
		this.endPoint.x = other.endPoint.x;
		this.endPoint.y = other.endPoint.y;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.recalculate();
	}

	// Arc length
	length() {
		let span = this.endAngle - this.startAngle;
		if (span < 0) span += Math.PI * 2;
		return this.radius * span;
	}

	// Translate by offset
	translate(dx, dy) {
		TransformUtils.translatePointInPlace(this.startPoint, dx, dy);
		TransformUtils.translatePointInPlace(this.tangentPoint, dx, dy);
		TransformUtils.translatePointInPlace(this.endPoint, dx, dy);
		this.recalculate();
	}

	// Scale relative to anchor
	scale(anchorX, anchorY, factor) {
		TransformUtils.scalePointInPlace(this.startPoint, anchorX, anchorY, factor);
		TransformUtils.scalePointInPlace(this.tangentPoint, anchorX, anchorY, factor);
		TransformUtils.scalePointInPlace(this.endPoint, anchorX, anchorY, factor);
		this.recalculate();
	}

	// Rotate around anchor
	rotate(anchorX, anchorY, angleRad) {
		TransformUtils.rotatePointInPlace(this.startPoint, anchorX, anchorY, angleRad);
		TransformUtils.rotatePointInPlace(this.tangentPoint, anchorX, anchorY, angleRad);
		TransformUtils.rotatePointInPlace(this.endPoint, anchorX, anchorY, angleRad);
		this.recalculate();
	}

	// Mirror across line
	mirror(x1, y1, x2, y2) {
		TransformUtils.mirrorPointInPlace(this.startPoint, x1, y1, x2, y2);
		TransformUtils.mirrorPointInPlace(this.tangentPoint, x1, y1, x2, y2);
		TransformUtils.mirrorPointInPlace(this.endPoint, x1, y1, x2, y2);
		this.recalculate();
	}

	getInspectorSchema() {
		return {
			name: 'Tangent Arc',
			sections: [
				{
					title: 'Dimensions',
					fields: [
						{
							key: 'radius',
							label: 'Radius',
							type: 'readonly',
							get: () => this.radius,
							precision: 2
						},
						{
							key: 'arcLength',
							label: 'Arc Length',
							type: 'readonly',
							get: () => this.length(),
							precision: 2
						}
					]
				},
				{
					title: 'Start Point',
					fields: [
						{ key: 'startPoint.x', label: 'X', type: 'number', precision: 2, step: 1 },
						{ key: 'startPoint.y', label: 'Y', type: 'number', precision: 2, step: 1 }
					]
				},
				{
					title: 'Tangent Handle',
					fields: [
						{ key: 'tangentPoint.x', label: 'X', type: 'number', precision: 2, step: 1 },
						{ key: 'tangentPoint.y', label: 'Y', type: 'number', precision: 2, step: 1 }
					]
				},
				{
					title: 'End Point',
					fields: [
						{ key: 'endPoint.x', label: 'X', type: 'number', precision: 2, step: 1 },
						{ key: 'endPoint.y', label: 'Y', type: 'number', precision: 2, step: 1 }
					]
				}
			]
		};
	}

	// Update control point by index
	// POI indices: 0=start, 1=tangent handle, 2=end
	updateControlPoint(index, newX, newY) {
		switch (index) {
			case 0:
				this.startPoint.x = newX;
				this.startPoint.y = newY;
				break;
			case 1:
				this.tangentPoint.x = newX;
				this.tangentPoint.y = newY;
				break;
			case 2:
				this.endPoint.x = newX;
				this.endPoint.y = newY;
				break;
		}
		this.recalculate();
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			startPoint: { x: this.startPoint.x, y: this.startPoint.y },
			tangentPoint: { x: this.tangentPoint.x, y: this.tangentPoint.y },
			endPoint: { x: this.endPoint.x, y: this.endPoint.y }
		};
	}

	static fromJSON(data) {
		const arc = new TangentArc([
			data.startPoint.x, data.startPoint.y,
			data.tangentPoint.x, data.tangentPoint.y,
			data.endPoint.x, data.endPoint.y
		]);
		arc.type = data.type;
		if(data.penStyle) arc.penStyle = data.penStyle;
		return arc;
	}
}
