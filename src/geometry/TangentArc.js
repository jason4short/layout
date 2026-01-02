import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';

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
		const tx = tangentPoint.x - startPoint.x;
		const ty = tangentPoint.y - startPoint.y;
		const tLen = Math.sqrt(tx * tx + ty * ty);

		if (tLen < 1e-10) {
			this.radius = 0;
			return;
		}

		// Normalized tangent
		const tnx = tx / tLen;
		const tny = ty / tLen;

		// Vector from start to end
		const dx = endPoint.x - startPoint.x;
		const dy = endPoint.y - startPoint.y;
		const dLen = Math.sqrt(dx * dx + dy * dy);

		if (dLen < 1e-10) {
			this.radius = 0;
			return;
		}

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

		if (Math.abs(denom) < 1e-10) {
			this.radius = 0;
			return;
		}

		const t = ((mx - startPoint.x) * cy - (my - startPoint.y) * cx) / denom;

		// Center point
		this.x = startPoint.x + t * px;
		this.y = startPoint.y + t * py;

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

		const tangentAngle = Math.atan2(tny, tnx);

		const diffCCW = this.normalizeAngle(tangentAngle - expectedTangentCCW);
		const diffCW = this.normalizeAngle(tangentAngle - expectedTangentCW);

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

	normalizeAngle(angle) {
		while (angle > Math.PI) angle -= Math.PI * 2;
		while (angle < -Math.PI) angle += Math.PI * 2;
		return angle;
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
		const TWO_PI = Math.PI * 2;
		const normalize = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

		const normAngle = normalize(angle);
		const normStart = normalize(this.startAngle);
		const normEnd = normalize(this.endAngle);

		if (normStart <= normEnd) {
			return normAngle >= normStart && normAngle <= normEnd;
		} else {
			return normAngle >= normStart || normAngle <= normEnd;
		}
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
		return t;
	}

	// Arc length
	length() {
		let span = this.endAngle - this.startAngle;
		if (span < 0) span += Math.PI * 2;
		return this.radius * span;
	}

	// Translate by offset
	translate(dx, dy) {
		this.startPoint.x += dx;
		this.startPoint.y += dy;
		this.tangentPoint.x += dx;
		this.tangentPoint.y += dy;
		this.endPoint.x += dx;
		this.endPoint.y += dy;
		this.recalculate();
	}

	// Scale relative to anchor
	scale(anchorX, anchorY, factor) {
		this.startPoint.x = anchorX + (this.startPoint.x - anchorX) * factor;
		this.startPoint.y = anchorY + (this.startPoint.y - anchorY) * factor;
		this.tangentPoint.x = anchorX + (this.tangentPoint.x - anchorX) * factor;
		this.tangentPoint.y = anchorY + (this.tangentPoint.y - anchorY) * factor;
		this.endPoint.x = anchorX + (this.endPoint.x - anchorX) * factor;
		this.endPoint.y = anchorY + (this.endPoint.y - anchorY) * factor;
		this.recalculate();
	}

	// Rotate around anchor
	rotate(anchorX, anchorY, angleRad) {
		const cos = Math.cos(angleRad);
		const sin = Math.sin(angleRad);

		const rotatePoint = (p) => {
			const dx = p.x - anchorX;
			const dy = p.y - anchorY;
			p.x = anchorX + dx * cos - dy * sin;
			p.y = anchorY + dx * sin + dy * cos;
		};

		rotatePoint(this.startPoint);
		rotatePoint(this.tangentPoint);
		rotatePoint(this.endPoint);
		this.recalculate();
	}

	// Mirror across line
	mirror(x1, y1, x2, y2) {
		const mirrorPoint = (p) => {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const t = ((p.x - x1) * dx + (p.y - y1) * dy) / (dx * dx + dy * dy);
			const cx = x1 + t * dx;
			const cy = y1 + t * dy;
			p.x = 2 * cx - p.x;
			p.y = 2 * cy - p.y;
		};

		mirrorPoint(this.startPoint);
		mirrorPoint(this.tangentPoint);
		mirrorPoint(this.endPoint);
		this.recalculate();
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
}
