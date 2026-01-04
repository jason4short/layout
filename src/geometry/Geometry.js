import {Point} from './Point.js';
import {Rectangle} from './Rectangle.js';
import * as VectorUtils from './utils/VectorUtils.js';

export const Shape = Object.freeze({
	/*geometry*/
	POINT: "point",
	LINE: "line",
	CIRCLE: "circle",
	ARC: "arc",
	TANGENT_ARC: "tangent_arc",
	ELLIPSE: "ellipse",
	ELLIPTICAL_ARC: "elliptical_arc",
	SPLINE: "spline",

	/*types*/
	CONSTRUCTION: "construction",
	SNAP_POINT: "snap_point",
	GUIDE: "guide",
	PLAIN: "plain"
});

// Pen styles control visual appearance (color, dash pattern, width)
export const PenStyle = Object.freeze({
	VISIBLE: "visible",         // Default solid line
	CONSTRUCTION: "construction", // Light dashed (for construction geometry)
	CENTERLINE: "centerline",   // Long-short-long dash pattern
	HIDDEN: "hidden",           // Dashed line for hidden edges
	PHANTOM: "phantom",         // Long-dash-dot-dot pattern
	OUTLINE: "outline"          // Thicker solid line
});

export class Geometry
{
	constructor()
	{
		this.selected 			= false;
		this.showControlPoints 	= false;  // Toggle with Cmd+click
		this.stroke 			= '#000';
		this.bounds 			= new Rectangle();
		this.penStyle 			= PenStyle.VISIBLE;  // Default pen style
	}

	/**
	 * Return a new vector that goes from startPoint to endPoint.
	 */
	vectorBetweenPoints(startPoint, endPoint)
	{
		return VectorUtils.vectorBetweenPoints(startPoint, endPoint);
	}

	/**
	 * Return the dot product of two vectors.
	 */
	dotProduct(vectorA, vectorB)
	{
		return VectorUtils.dotProduct(vectorA, vectorB);
	}

	/**
	 * Return the squared length of a vector.
	 */
	vectorLengthSquared(vector)
	{
		return VectorUtils.lengthSquared(vector);
	}

	/**
	 * Return the length of a vector.
	 */
	vectorLength(vector)
	{
		return VectorUtils.length(vector);
	}

	/**
	 * Return the squared distance between two points.
	 */
	squaredDistanceBetweenPoints(firstPoint, secondPoint)
	{
		return VectorUtils.distanceSquared(firstPoint, secondPoint);
	}

	/**
	 * Return the distance between two points.
	 */
	distanceBetweenPoints(firstPoint, secondPoint)
	{
		return VectorUtils.distance(firstPoint, secondPoint);
	}

	/**
	 * Clamp a number into the inclusive range [minimumValue, maximumValue].
	 */
	clampNumber(value, minimumValue, maximumValue)
	{
		return VectorUtils.clamp(value, minimumValue, maximumValue);
	}

	/**
	 * Return a normalized version of the input vector.
	 */
	normalizeVector(vector)
	{
		return VectorUtils.normalize(vector);
	}

	/**
	 * Return the scalar projection of vectorToProject onto directionVector.
	 */
	projectScalarOntoVector(vectorToProject, directionVector)
	{
		return VectorUtils.projectScalar(vectorToProject, directionVector);
	}

	/**
	 * Return the closest point on the segment [segmentStart, segmentEnd] to a point.
	 * If returnParametricT is true, returns { point, t } where t is clamped to [0, 1].
	 */
	closestPointOnSegment(point, segmentStart, segmentEnd, returnParametricT = false)
	{
		const result = VectorUtils.closestPointOnSegment(point, segmentStart, segmentEnd, returnParametricT);

		if (returnParametricT) {
			// Convert plain object to Point for backward compatibility
			return {
				point: new Point(result.point.x, result.point.y),
				t: result.t
			};
		}

		return new Point(result.x, result.y);
	}
}
