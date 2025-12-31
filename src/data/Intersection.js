// Represents an intersection point between two shapes
export class Intersection {
	constructor(shapeA, shapeB, point) {
		this.shapeA = shapeA;
		this.shapeB = shapeB;
		this.x = point.x;
		this.y = point.y;
	}

	// Check if this intersection involves a specific shape
	involves(shape) {
		return this.shapeA === shape || this.shapeB === shape;
	}

	// For snap exclusion: returns array of both shapes
	get shapes() {
		return [this.shapeA, this.shapeB];
	}
}
