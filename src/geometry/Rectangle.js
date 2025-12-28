import {Point} from './Point.js';

export class Rectangle
{
	// private members

	constructor(x = 0, y = 0, width = 100, height = 100)
	{
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}
	
	/**
	 * Calculates the area of the rectangle.
	 * @returns {number} - The area of the rectangle.
	 */
	area() {
		return this.width * this.height;
	}

	/**
	 * Creates a clone of the current rectangle.
	 * @returns {Rectangle} - A new Rectangle with the same properties.
	 */
	clone() {
		return new Rectangle(this.x, this.y, this.width, this.height);
	}

	/**
	 * Checks if the rectangle contains the given point.
	 * @param {number} x - The x-coordinate of the point.
	 * @param {number} y - The y-coordinate of the point.
	 * @returns {boolean} - True if the point is inside the rectangle, false otherwise.
	 */
	contains(x, y) {
		return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
	}

	/**
	 * Checks if the rectangle contains the given point.
	 * @param {Point} point - The point to check.
	 * @returns {boolean} - True if the point is inside the rectangle, false otherwise.
	 */
	containsPoint(point) {
		return this.contains(point.x, point.y);
	}

	/**
	 * Checks if the rectangle completely contains the given rectangle.
	 * @param {Rectangle} rect - The rectangle to check.
	 * @returns {boolean} - True if the rectangle is completely inside, false otherwise.
	 */
	containsRect(rect) {
		return this.x <= rect.x && this.y <= rect.y && rect.x + rect.width <= this.x + this.width && rect.y + rect.height <= this.y + this.height;
	}

	/**
	 * Copies the properties from the given rectangle.
	 * @param {Rectangle} rect - The rectangle to copy from.
	 */
	copyFrom(rect) {
		this.x = rect.x;
		this.y = rect.y;
		this.width = rect.width;
		this.height = rect.height;
	}

	/**
	 * Checks if the current rectangle is equal to the given rectangle.
	 * @param {Rectangle} rect - The rectangle to compare with.
	 * @returns {boolean} - True if the rectangles are equal, false otherwise.
	 */
	equals(rect) {
		return this.x === rect.x && this.y === rect.y && this.width === rect.width && this.height === rect.height;
	}

	/**
	 * Returns a new rectangle representing the intersection of the current rectangle with the given rectangle.
	 * @param {Rectangle} rect - The rectangle to intersect with.
	 * @returns {Rectangle} - A new Rectangle representing the intersection.
	 */
	intersection(rect) {
		const ix = Math.max(this.x, rect.x);
		const iy = Math.max(this.y, rect.y);
		const iw = Math.min(this.x + this.width, rect.x + rect.width);
		const ih = Math.min(this.y + this.height, rect.y + rect.height);

		return iw < ix || ih < iy ? new Rectangle() : new Rectangle(ix, iy, iw - ix, ih - iy);
	}

	/**
	 * Checks if the current rectangle intersects with the given rectangle.
	 * @param {Rectangle} rect - The rectangle to check.
	 * @returns {boolean} - True if the rectangles intersect, false otherwise.
	 */
	intersects(rect) {
		return !(rect.y + rect.height < this.y || rect.x > this.x + this.width || rect.y > this.y + this.height || rect.x + rect.width < this.x);
	}
}

