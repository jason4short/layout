/**
 * Transform - 2D affine transformation matrix.
 *
 * Handles coordinate conversion between local and parent coordinate spaces.
 * Currently supports translation only; can be extended for rotation/scale.
 *
 * Matrix representation (column-major for consistency with WebGL):
 * | a  c  tx |
 * | b  d  ty |
 * | 0  0  1  |
 *
 * For translation-only: a=1, b=0, c=0, d=1
 */
export class Transform {
	constructor() {
		// Position (translation)
		this._x = 0;
		this._y = 0;

		// Future: rotation and scale
		// this._rotation = 0;
		// this._scaleX = 1;
		// this._scaleY = 1;

		// Cached matrices
		this._mat = null;
		this._inv = null;
		this._dirty = true;
	}

	get x() { return this._x; }
	set x(value) {
		this._x = value;
		this._dirty = true;
	}

	get y() { return this._y; }
	set y(value) {
		this._y = value;
		this._dirty = true;
	}

	/**
	 * Set position.
	 */
	setPosition(x, y) {
		this._x = x;
		this._y = y;
		this._dirty = true;
	}

	/**
	 * Translate by delta.
	 */
	translate(dx, dy) {
		this._x += dx;
		this._y += dy;
		this._dirty = true;
	}

	/**
	 * Ensure matrices are computed.
	 */
	_computeMatrices() {
		if (!this._dirty) return;

		// For translation-only transform:
		// Forward: p' = p + t
		// Inverse:  p = p' - t
		this._mat = {
			a: 1, b: 0,
			c: 0, d: 1,
			tx: this._x,
			ty: this._y
		};

		this._inv = {
			a: 1, b: 0,
			c: 0, d: 1,
			tx: -this._x,
			ty: -this._y
		};

		this._dirty = false;
	}

	/**
	 * Get the transformation matrix (local → parent).
	 */
	getMatrix() {
		this._computeMatrices();
		return this._mat;
	}

	/**
	 * Get the inverse matrix (parent → local).
	 */
	getInverse() {
		this._computeMatrices();
		return this._inv;
	}

	/**
	 * Transform a point from local to parent space.
	 */
	apply(point) {
		const m = this.getMatrix();
		return {
			x: point.x * m.a + point.y * m.c + m.tx,
			y: point.x * m.b + point.y * m.d + m.ty
		};
	}

	/**
	 * Transform a point from parent to local space.
	 */
	applyInverse(point) {
		const m = this.getInverse();
		return {
			x: point.x * m.a + point.y * m.c + m.tx,
			y: point.x * m.b + point.y * m.d + m.ty
		};
	}

	/**
	 * Transform a delta (vector) from local to parent space.
	 * Unlike points, deltas don't include translation.
	 */
	applyDelta(dx, dy) {
		const m = this.getMatrix();
		return {
			x: dx * m.a + dy * m.c,
			y: dx * m.b + dy * m.d
		};
	}

	/**
	 * Transform a delta from parent to local space.
	 */
	applyInverseDelta(dx, dy) {
		const m = this.getInverse();
		return {
			x: dx * m.a + dy * m.c,
			y: dx * m.b + dy * m.d
		};
	}

	/**
	 * Clone this transform.
	 */
	clone() {
		const t = new Transform();
		t._x = this._x;
		t._y = this._y;
		t._dirty = true;
		return t;
	}

	/**
	 * Copy values from another transform.
	 */
	copyFrom(other) {
		this._x = other._x;
		this._y = other._y;
		this._dirty = true;
	}

	/**
	 * Serialize to JSON.
	 */
	toJSON() {
		return {
			x: this._x,
			y: this._y
		};
	}

	/**
	 * Deserialize from JSON.
	 */
	static fromJSON(json) {
		const t = new Transform();
		t._x = json.x || 0;
		t._y = json.y || 0;
		return t;
	}
}

/**
 * Multiply two 2D affine matrices.
 * Result = A × B (apply B first, then A)
 */
export function multiplyMatrices(a, b) {
	return {
		a: a.a * b.a + a.c * b.b,
		b: a.b * b.a + a.d * b.b,
		c: a.a * b.c + a.c * b.d,
		d: a.b * b.c + a.d * b.d,
		tx: a.a * b.tx + a.c * b.ty + a.tx,
		ty: a.b * b.tx + a.d * b.ty + a.ty
	};
}

/**
 * Apply a matrix to a point.
 */
export function applyMatrix(m, point) {
	return {
		x: point.x * m.a + point.y * m.c + m.tx,
		y: point.x * m.b + point.y * m.d + m.ty
	};
}

/**
 * Apply a matrix to a delta (no translation).
 */
export function applyMatrixDelta(m, dx, dy) {
	return {
		x: dx * m.a + dy * m.c,
		y: dx * m.b + dy * m.d
	};
}
