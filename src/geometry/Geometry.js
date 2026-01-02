import {Point} from './Point.js';
import {Rectangle} from './Rectangle.js';

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

export class Geometry
{
	constructor()
	{
		this.selected 			= false;
		this.showControlPoints 	= false;  // Toggle with Cmd+click
		this.stroke 			= '#000';
		this.bounds 			= new Rectangle();
	}

	/**
	 * Return a new vector that goes from startPoint to endPoint.
	 */
	vectorBetweenPoints(startPoint, endPoint)
	{
		return {
			x: endPoint.x - startPoint.x,
			y: endPoint.y - startPoint.y
		};
	}

	/**
	 * Return the dot product of two vectors.
	 * This measures how strongly vectorA points in the direction of vectorB.
	 */
	dotProduct(vectorA, vectorB)
	{
		return (vectorA.x * vectorB.x) + (vectorA.y * vectorB.y);
	}

	/**
	 * Return the squared length of a vector.
	 * This avoids a sqrt and is preferred for comparisons and projections.
	 */
	vectorLengthSquared(vector)
	{
		return this.dotProduct(vector, vector);
	}

	/**
	 * Return the length of a vector.
	 */
	vectorLength(vector)
	{
		return Math.sqrt(this.vectorLengthSquared(vector));
	}

	/**
	 * Return the squared distance between two points.
	 * This avoids a sqrt and is preferred for comparisons.
	 */
	squaredDistanceBetweenPoints(firstPoint, secondPoint)
	{
		const deltaX = firstPoint.x - secondPoint.x;
		const deltaY = firstPoint.y - secondPoint.y;

		return (deltaX * deltaX) + (deltaY * deltaY);
	}

	/**
	 * Return the distance between two points.
	 */
	distanceBetweenPoints(firstPoint, secondPoint)
	{
		return Math.sqrt(this.squaredDistanceBetweenPoints(firstPoint, secondPoint));
	}

	/**
	 * Clamp a number into the inclusive range [minimumValue, maximumValue].
	 */
	clampNumber(value, minimumValue, maximumValue)
	{
		if(value < minimumValue){
			return minimumValue;
		}

		if(value > maximumValue){
			return maximumValue;
		}

		return value;
	}

	/**
	 * Return a normalized version of the input vector.
	 * If the vector is too small to normalize, returns {x: 0, y: 0}.
	 */
	normalizeVector(vector)
	{
		const lengthSquared = this.vectorLengthSquared(vector);

		if(lengthSquared === 0){
			return {x: 0, y: 0};
		}

		const inverseLength = 1 / Math.sqrt(lengthSquared);

		return {
			x: vector.x * inverseLength,
			y: vector.y * inverseLength
		};
	}

	/**
	 * Return the scalar projection of vectorToProject onto directionVector.
	 * This returns "t" in the sense of "how far along directionVector".
	 *
	 * If directionVector is degenerate, returns 0.
	 */
	projectScalarOntoVector(vectorToProject, directionVector)
	{
		const directionLengthSquared = this.vectorLengthSquared(directionVector);

		if(directionLengthSquared === 0){
			return 0;
		}

		return this.dotProduct(vectorToProject, directionVector) / directionLengthSquared;
	}

	/**
	 * Return the closest point on the segment [segmentStart, segmentEnd] to a point.
	 * By default this returns a Point, matching your existing behavior.
	 *
	 * If returnParametricT is true, returns { point, t } where t is clamped to [0, 1].
	 */
	closestPointOnSegment(point, segmentStart, segmentEnd, returnParametricT = false)
	{
		const segmentVector = this.vectorBetweenPoints(segmentStart, segmentEnd);
		const pointFromStartVector = this.vectorBetweenPoints(segmentStart, point);

		let t = this.projectScalarOntoVector(pointFromStartVector, segmentVector);
		t = this.clampNumber(t, 0, 1);

		const closestPoint = new Point(
			segmentStart.x + (t * segmentVector.x),
			segmentStart.y + (t * segmentVector.y)
		);

		if(returnParametricT){
			return {point: closestPoint, t};
		}

		return closestPoint;
	}
}