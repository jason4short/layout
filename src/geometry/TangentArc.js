import {Shape, SnapType} from './Geometry.js';
import {Arc} from './Arc.js';
import {Point} from './Point.js';
import * as AngleUtils from './utils/AngleUtils.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';
import {tangentArcSchema} from './InspectorSchemas.js';
import {serializeTangentArc, deserializeTangentArc} from './GeometrySerializers.js';

/**
 * TangentArc - An arc defined by control points (start, tangent direction, end).
 * Extends Arc to inherit all arc functionality.
 * The control points define the arc geometry, which is stored in the base Arc class.
 */
export class TangentArc extends Arc
{
	constructor(params)
	{
		// params: [startX, startY, tangentX, tangentY, endX, endY]
		// Initialize with dummy arc params, will be calculated
		// Set flag to prevent update() during super() construction
		super([0, 0, 1, 0, Math.PI]);

		this.geometry = Shape.TANGENT_ARC;

		// Control points that define the tangent arc
		this.startPoint = new Point(params[0], params[1]);
		this.tangentPoint = new Point(params[2], params[3]);
		this.endPoint = new Point(params[4], params[5]);

		// Now that control points exist, calculate arc geometry
		this._initialized = true;
		this.recalculateFromControlPoints();
	}

	/**
	 * Recalculate arc geometry (center, radius, angles) from the control points.
	 * Call this when control points change.
	 */
	recalculateFromControlPoints() {
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
		const perpDir = VectorUtils.perpendicular(tangentNorm);

		// The center also lies on the perpendicular bisector of start-end chord
		const midpoint = {
			x: (startPoint.x + endPoint.x) / 2,
			y: (startPoint.y + endPoint.y) / 2
		};

		// Direction perpendicular to chord
		const chordPerp = { x: -chordVec.y, y: chordVec.x };

		// Find intersection of the two perpendicular lines
		const denom = perpDir.x * chordPerp.y - perpDir.y * chordPerp.x;

		if (Math.abs(denom) < 1e-10) {
			this.radius = 0;
			return;
		}

		const t = ((midpoint.x - startPoint.x) * chordPerp.y - (midpoint.y - startPoint.y) * chordPerp.x) / denom;

		// Set arc center and radius (inherited from Arc)
		this.x = startPoint.x + t * perpDir.x;
		this.y = startPoint.y + t * perpDir.y;
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

		// Update base Arc (POIs, bounding box, etc.)
		super.update();
	}

	/**
	 * Override update to recalculate from control points.
	 */
	update() {
		// Skip if not yet initialized (during super() construction)
		if (!this._initialized) return;
		this.recalculateFromControlPoints();
	}

	/**
	 * Alias for recalculateFromControlPoints (for backward compatibility).
	 */
	recalculate() {
		this.recalculateFromControlPoints();
	}

	/**
	 * Convert this TangentArc to a plain Arc.
	 * Useful for operations that don't need control points (like trimming).
	 */
	toArc() {
		const arc = new Arc([this.x, this.y, this.radius, this.startAngle, this.endAngle]);
		arc.groupId = this.groupId;
		arc.strokeColor = this.strokeColor;
		arc.lineWidth = this.lineWidth;
		arc.penStyle = this.penStyle;
		arc.colorToken = this.colorToken;
		return arc;
	}

	/**
	 * Get snap points - returns control points for editing.
	 * Indices match updateControlPoint: 0=start, 1=tangent, 2=end
	 */
	getSnapPOIs() {
		return [
			{ x: this.startPoint.x, y: this.startPoint.y, type: SnapType.ENDPOINT },
			{ x: this.tangentPoint.x, y: this.tangentPoint.y, type: SnapType.ENDPOINT },
			{ x: this.endPoint.x, y: this.endPoint.y, type: SnapType.ENDPOINT }
		];
	}

	/**
	 * Get points that can be transformed (for move/scale/rotate).
	 */
	getTransformablePoints() {
		return [this.startPoint, this.tangentPoint, this.endPoint];
	}

	/**
	 * Update a control point by index.
	 * POI indices: 0=start, 1=tangent handle, 2=end
	 */
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
		this.recalculateFromControlPoints();
	}

	translate(dx, dy) {
		this.startPoint.x += dx;
		this.startPoint.y += dy;
		this.tangentPoint.x += dx;
		this.tangentPoint.y += dy;
		this.endPoint.x += dx;
		this.endPoint.y += dy;
		this.recalculateFromControlPoints();
	}

	scale(anchorX, anchorY, factor) {
		for (const pt of [this.startPoint, this.tangentPoint, this.endPoint]) {
			const s = TransformUtils.scalePoint(pt.x, pt.y, anchorX, anchorY, factor);
			pt.x = s.x;
			pt.y = s.y;
		}
		this.recalculateFromControlPoints();
	}

	rotate(anchorX, anchorY, angleRad) {
		for (const pt of [this.startPoint, this.tangentPoint, this.endPoint]) {
			const r = TransformUtils.rotatePoint(pt.x, pt.y, anchorX, anchorY, angleRad);
			pt.x = r.x;
			pt.y = r.y;
		}
		this.recalculateFromControlPoints();
	}

	mirror(x1, y1, x2, y2) {
		for (const pt of [this.startPoint, this.tangentPoint, this.endPoint]) {
			const m = TransformUtils.mirrorPoint(pt.x, pt.y, x1, y1, x2, y2);
			pt.x = m.x;
			pt.y = m.y;
		}
		this.recalculateFromControlPoints();
	}

	clone() {
		const t = new TangentArc([
			this.startPoint.x, this.startPoint.y,
			this.tangentPoint.x, this.tangentPoint.y,
			this.endPoint.x, this.endPoint.y
		]);
		t.type = this.type;
		t.groupId = this.groupId;
		t.penStyle = this.penStyle;
		t.colorToken = this.colorToken;
		return t;
	}

	copyFrom(other) {
		if (other.startPoint) {
			// Copying from another TangentArc
			this.startPoint.x = other.startPoint.x;
			this.startPoint.y = other.startPoint.y;
			this.tangentPoint.x = other.tangentPoint.x;
			this.tangentPoint.y = other.tangentPoint.y;
			this.endPoint.x = other.endPoint.x;
			this.endPoint.y = other.endPoint.y;
			this.recalculateFromControlPoints();
		} else {
			// Copying from a regular Arc - just copy arc params
			this.x = other.x;
			this.y = other.y;
			this.radius = other.radius;
			this.startAngle = other.startAngle;
			this.endAngle = other.endAngle;
			super.update();
		}
		this.type = other.type;
		this.penStyle = other.penStyle;
	}

	getInspectorSchema() {
		return tangentArcSchema(this);
	}

	toJSON() {
		return serializeTangentArc(this);
	}

	static fromJSON(data) {
		return deserializeTangentArc(data, TangentArc);
	}

	/**
	 * Draw is inherited from Arc - same rendering.
	 * Only drawHandles is overridden to show control points.
	 */
	drawHandles(ctx, renderer) {
		if (!this.showControlPoints) return;

		const startPt = renderer.toScreen(this.startPoint.x, this.startPoint.y);
		const tangentPt = renderer.toScreen(this.tangentPoint.x, this.tangentPoint.y);
		const endPt = renderer.toScreen(this.endPoint.x, this.endPoint.y);
		const handleRadius = 4;

		// Draw tangent line from start to tangent handle
		ctx.beginPath();
		ctx.strokeStyle = '#AAAAAA';
		ctx.lineWidth = 0.5;
		ctx.setLineDash([2, 2]);
		ctx.moveTo(startPt.x, startPt.y);
		ctx.lineTo(tangentPt.x, tangentPt.y);
		ctx.stroke();
		ctx.setLineDash([]);

		// Draw control point handles
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = '#666666';
		ctx.fillStyle = '#FFFFFF';

		// Start point
		ctx.beginPath();
		ctx.arc(startPt.x, startPt.y, handleRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		// Tangent handle (diamond shape)
		ctx.beginPath();
		ctx.fillStyle = '#FFCC00';
		ctx.moveTo(tangentPt.x, tangentPt.y - handleRadius);
		ctx.lineTo(tangentPt.x + handleRadius, tangentPt.y);
		ctx.lineTo(tangentPt.x, tangentPt.y + handleRadius);
		ctx.lineTo(tangentPt.x - handleRadius, tangentPt.y);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		// End point
		ctx.beginPath();
		ctx.fillStyle = '#FFFFFF';
		ctx.arc(endPt.x, endPt.y, handleRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
}
