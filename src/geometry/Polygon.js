import { Shape, Geometry, PenStyle, SnapType } from './Geometry.js';
import { Point } from './Point.js';
import { Line } from './Line.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';
import { polygonSchema } from './InspectorSchemas.js';
import { serializePolygon, deserializePolygon } from './GeometrySerializers.js';

/**
 * Polygon - Regular n-sided polygon defined by center, radius, and number of sides.
 *
 * Similar to Circle in that it's defined by center + radius, but renders as a polygon.
 * Uses radiusAngle to control rotation of the polygon (where the first vertex points).
 */
export class Polygon extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.POLYGON;
		this.showHandlesWhenSelected = true;  // Primitives show control points when selected

		// params: [x, y, radius, sides, radiusAngle]
		this.x = params[0];
		this.y = params[1];
		this.radius = params[2];
		this.sides = params[3] !== undefined ? params[3] : 6;  // Default hexagon
		this.radiusAngle = params[4] !== undefined ? params[4] : -Math.PI / 2;  // Point up by default

		this.update();
	}

	update() {
		// Bounding box same as circumscribed circle
		this.bounds.x = this.x - this.radius;
		this.bounds.y = this.y - this.radius;
		this.bounds.width = this.radius * 2;
		this.bounds.height = this.radius * 2;
	}

	clone() {
		const p = new Polygon([this.x, this.y, this.radius, this.sides, this.radiusAngle]);
		p.type = this.type;
		p.groupId = this.groupId;
		p.penStyle = this.penStyle;
		p.colorToken = this.colorToken;
		return p;
	}

	copyFrom(other) {
		this.x = other.x;
		this.y = other.y;
		this.radius = other.radius;
		this.sides = other.sides;
		this.radiusAngle = other.radiusAngle;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	/**
	 * Get vertices of the polygon
	 * @returns {Point[]} Array of vertex points
	 */
	getVertices() {
		const vertices = [];
		const angleStep = (Math.PI * 2) / this.sides;

		for (let i = 0; i < this.sides; i++) {
			const angle = this.radiusAngle + (i * angleStep);
			vertices.push(new Point(
				this.x + Math.cos(angle) * this.radius,
				this.y + Math.sin(angle) * this.radius
			));
		}

		return vertices;
	}

	/**
	 * Get edge midpoints
	 * @returns {Point[]} Array of edge midpoints
	 */
	getEdgeMidpoints() {
		const vertices = this.getVertices();
		const midpoints = [];

		for (let i = 0; i < vertices.length; i++) {
			const v1 = vertices[i];
			const v2 = vertices[(i + 1) % vertices.length];
			midpoints.push(new Point(
				(v1.x + v2.x) / 2,
				(v1.y + v2.y) / 2
			));
		}

		return midpoints;
	}

	getSnapPOIs() {
		// POI structure:
		// 0: center (control point)
		// 1: radius control point at radiusAngle (control point, also first vertex)
		// 2+: remaining vertices (for snapping)
		// After vertices: edge midpoints (for snapping)

		const vertices = this.getVertices();
		const midpoints = this.getEdgeMidpoints();

		const pois = [
			{ x: this.x, y: this.y, type: SnapType.CENTER },
			{ x: vertices[0].x, y: vertices[0].y, type: SnapType.ENDPOINT }
		];

		// Add remaining vertices (2 to sides)
		for (let i = 1; i < vertices.length; i++) {
			pois.push({ x: vertices[i].x, y: vertices[i].y, type: SnapType.ENDPOINT });
		}

		// Add edge midpoints
		for (const mp of midpoints) {
			pois.push({ x: mp.x, y: mp.y, type: SnapType.MIDPOINT });
		}

		return pois;
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		// Quick reject
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		const vertices = this.getVertices();
		let closestPoint = null;
		let closestDistance = Infinity;

		// Check each edge
		for (let i = 0; i < vertices.length; i++) {
			const v1 = vertices[i];
			const v2 = vertices[(i + 1) % vertices.length];

			// Closest point on segment
			const closest = VectorUtils.closestPointOnSegment(mouse, v1, v2);
			const distance = VectorUtils.distance(mouse, closest);

			if (distance < closestDistance && distance <= pixelTolerance) {
				closestDistance = distance;
				closestPoint = new Point(closest.x, closest.y);
				closestPoint.distance = distance;
			}
		}

		return closestPoint;
	}

	length() {
		// Perimeter = sides * edge length
		// Edge length = 2 * radius * sin(PI / sides)
		const edgeLength = 2 * this.radius * Math.sin(Math.PI / this.sides);
		return this.sides * edgeLength;
	}

	getInspectorSchema() {
		return polygonSchema(this);
	}

	// Get interior angle in degrees
	getInteriorAngle() {
		return ((this.sides - 2) * 180) / this.sides;
	}

	// Get area
	getArea() {
		// Area = (1/2) * sides * radius^2 * sin(2*PI/sides)
		return 0.5 * this.sides * this.radius * this.radius * Math.sin(2 * Math.PI / this.sides);
	}

	translate(dx, dy) {
		this.x += dx;
		this.y += dy;
		this.update();
	}

	scale(anchorX, anchorY, factor) {
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;
		this.radius = this.radius * Math.abs(factor);
		this.update();
	}

	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		this.radiusAngle += angleRad;
		this.update();
	}

	mirror(x1, y1, x2, y2) {
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;
		// Mirror the radius angle across the mirror line
		const lineAngle = Math.atan2(y2 - y1, x2 - x1);
		this.radiusAngle = 2 * lineAngle - this.radiusAngle;
		this.update();
	}

	// Update control point by index: 0=center, 1=radius control
	updateControlPoint(index, newX, newY) {
		switch (index) {
			case 0: // center - move the polygon
				this.x = newX;
				this.y = newY;
				break;
			case 1: // radius control point - update radius and angle
				this.radius = VectorUtils.distance({ x: this.x, y: this.y }, { x: newX, y: newY });
				this.radiusAngle = Math.atan2(newY - this.y, newX - this.x);
				break;
		}
		this.update();
	}

	/**
	 * Create lines from polygon edges (for break apart)
	 * @returns {Line[]} Array of Line objects for each edge
	 */
	createLines() {
		const vertices = this.getVertices();
		const lines = [];

		for (let i = 0; i < vertices.length; i++) {
			const v1 = vertices[i];
			const v2 = vertices[(i + 1) % vertices.length];
			const line = new Line([v1.x, v1.y, v2.x, v2.y]);
			line.penStyle = this.penStyle;
			line.colorToken = this.colorToken;
			lines.push(line);
		}

		return lines;
	}

	toJSON() {
		return serializePolygon(this);
	}

	static fromJSON(data) {
		return deserializePolygon(data, Polygon);
	}

	draw(ctx, renderer) {
		const vertices = this.getVertices();
		if (vertices.length < 3) return;

		ctx.beginPath();

		const first = renderer.toScreen(vertices[0].x, vertices[0].y);
		ctx.moveTo(first.x, first.y);

		for (let i = 1; i < vertices.length; i++) {
			const pt = renderer.toScreen(vertices[i].x, vertices[i].y);
			ctx.lineTo(pt.x, pt.y);
		}

		ctx.closePath();
		ctx.stroke();
		renderer.resetPenStyle(ctx);
	}

	drawHandles(ctx, renderer) {
		const showHandles = this.showControlPoints || (this.selected && this.showHandlesWhenSelected);
		if (!showHandles) return;

		// Draw handles at center and radius control point only
		const pois = this.getSnapPOIs();
		const controlPoints = [pois[0], pois[1]];  // center, radius point
		const handleRadius = 4;

		ctx.lineWidth = 0.5;
		ctx.strokeStyle = '#666666';
		ctx.fillStyle = '#FFFFFF';

		for (const pt of controlPoints) {
			const screen = renderer.toScreen(pt.x, pt.y);
			ctx.beginPath();
			ctx.arc(screen.x, screen.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}
}
