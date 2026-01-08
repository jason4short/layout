import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';

export class Image extends Geometry
{
	constructor(params)
	{
		super();
		this.type 			= Shape.PLAIN;
		this.geometry		= Shape.IMAGE;

		this.x 				= params[0];  // top-left x
		this.y 				= params[1];  // top-left y
		this.width 			= params[2];
		this.height 		= params[3];

		this.src 			= null;  // file path for serialization
		this.imageElement 	= null;  // HTMLImageElement (runtime only)
		this.loaded 		= false;
		this.error 			= false;
		this.rotation 		= 0;     // rotation in radians
		this.flipX 			= false; // horizontal flip
		this.flipY 			= false; // vertical flip
		this.opacity 		= 1.0;   // 0.0 to 1.0

		// Images default to locked for tracing
		this.locked 		= true;

		// Cached geometry for hot paths (mouse move)
		this.cachedGeometryState = null;
		this.cachedCenter = {x: 0, y: 0};
		this.cachedCorners = [
			{x: 0, y: 0},
			{x: 0, y: 0},
			{x: 0, y: 0},
			{x: 0, y: 0}
		];
		this.cachedEdges = [
			{start: this.cachedCorners[0], end: this.cachedCorners[1]},
			{start: this.cachedCorners[1], end: this.cachedCorners[2]},
			{start: this.cachedCorners[2], end: this.cachedCorners[3]},
			{start: this.cachedCorners[3], end: this.cachedCorners[0]}
		];

		this.update();
	}

	/**
	 * Recompute bounds and cached geometry if anything changed.
	 * Call this after any mutation (translate/scale/rotate/control point edits).
	 */
	update(){
		this.updateCachedGeometryIfNeeded();
		this.updateBoundingBox();
	}

	/**
	 * Update cached corners/edges/center only when x/y/width/height/rotation changed.
	 * This makes getGeoSnap() and getSnapPOIs() cheap during mouse move.
	 */
	updateCachedGeometryIfNeeded()
	{
// 		const newState = this.createGeometryStateKey();
// 
// 		if(this.cachedGeometryState === newState){
// 			return;
// 		}
// 
//		this.cachedGeometryState = newState;

		this.cachedCenter.x = this.x + (this.width * 0.5);
		this.cachedCenter.y = this.y + (this.height * 0.5);

		if(this.rotation === 0){
			// Unrotated corners (top-left, top-right, bottom-right, bottom-left)
			this.cachedCorners[0].x = this.x;
			this.cachedCorners[0].y = this.y;

			this.cachedCorners[1].x = this.x + this.width;
			this.cachedCorners[1].y = this.y;

			this.cachedCorners[2].x = this.x + this.width;
			this.cachedCorners[2].y = this.y + this.height;

			this.cachedCorners[3].x = this.x;
			this.cachedCorners[3].y = this.y + this.height;

			return;
		}

		const cos = Math.cos(this.rotation);
		const sin = Math.sin(this.rotation);

		// Corners relative to center (avoids reallocations)
		const halfWidth = this.width * 0.5;
		const halfHeight = this.height * 0.5;

		// top-left (-hw, -hh)
		this.setRotatedCorner(this.cachedCorners[0], -halfWidth, -halfHeight, cos, sin);

		// top-right (hw, -hh)
		this.setRotatedCorner(this.cachedCorners[1], halfWidth, -halfHeight, cos, sin);

		// bottom-right (hw, hh)
		this.setRotatedCorner(this.cachedCorners[2], halfWidth, halfHeight, cos, sin);

		// bottom-left (-hw, hh)
		this.setRotatedCorner(this.cachedCorners[3], -halfWidth, halfHeight, cos, sin);
	}

	/**
	 * Create a small string key representing the geometry that affects corners.
	 * This is faster and simpler than deep comparisons.
	 */
	createGeometryStateKey()
	{
		return `${this.x},${this.y},${this.width},${this.height},${this.rotation}`;
	}

	/**
	 * Helper: write a rotated corner into a target object (no allocations).
	 */
	setRotatedCorner(targetCorner, localX, localY, cos, sin)
	{
		targetCorner.x = this.cachedCenter.x + (localX * cos) - (localY * sin);
		targetCorner.y = this.cachedCenter.y + (localX * sin) + (localY * cos);
	}


	updateBoundingBox()
	{
		// Validate dimensions - ensure they're finite
		if(!isFinite(this.x) || !isFinite(this.y) ||
			!isFinite(this.width) || !isFinite(this.height) ||
			!isFinite(this.rotation)) {

			this.bounds.x = 0;
			this.bounds.y = 0;
			this.bounds.width = 100;
			this.bounds.height = 100;
			return;
		}

		if(this.rotation === 0){
			this.bounds.x 		= this.x;
			this.bounds.y 		= this.y;
			this.bounds.width 	= this.width;
			this.bounds.height 	= this.height;
			return;
		}

		// Use cached corners instead of recomputing
		let minX = this.cachedCorners[0].x;
		let maxX = this.cachedCorners[0].x;
		let minY = this.cachedCorners[0].y;
		let maxY = this.cachedCorners[0].y;

		for(let i = 1; i < 4; i++){
			const corner = this.cachedCorners[i];

			if(corner.x < minX) minX = corner.x;
			if(corner.x > maxX) maxX = corner.x;
			if(corner.y < minY) minY = corner.y;
			if(corner.y > maxY) maxY = corner.y;
		}

		this.bounds.x 		= minX;
		this.bounds.y 		= minY;
		this.bounds.width 	= maxX - minX;
		this.bounds.height 	= maxY - minY;
	}

	/**
	 * POIs: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left, 4=center
	 * Returns cached points (no trig, no allocations).
	 */
	getSnapPOIs()
	{
		//this.updateCachedGeometryIfNeeded();

		return [
			this.cachedCorners[0],
			this.cachedCorners[1],
			this.cachedCorners[2],
			this.cachedCorners[3],
			this.cachedCenter
		];
	}

	/**
	 * Return the closest point on the image outline for snapping.
	 * Uses cached corners/edges and squared distance for cheap comparisons.
	 */
	 
	 // XXX disabled for now
	getGeoSnap1(mouse, mouseRect, pixelTolerance)
	{
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}

		//this.updateCachedGeometryIfNeeded();

		const pixelToleranceSquared = pixelTolerance * pixelTolerance;

		let closestPoint = null;
		let closestDistanceSquared = Infinity;

		for(const edge of this.cachedEdges){
			const closest = VectorUtils.closestPointOnSegment(mouse, edge.start, edge.end);

			const dx = mouse.x - closest.x;
			const dy = mouse.y - closest.y;
			const distanceSquared = (dx * dx) + (dy * dy);

			if(distanceSquared < closestDistanceSquared){
				closestDistanceSquared = distanceSquared;
				closestPoint = closest;
			}
		}

		if(closestDistanceSquared > pixelToleranceSquared){
			return null;
		}

		const point = new Point(closestPoint.x, closestPoint.y);
		point.distance = Math.sqrt(closestDistanceSquared); // only pay sqrt for the winning candidate
		return point;
	}
	
	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		return null;
	}
	
	// Load image from a file path or data URL
	loadImage(src){
		this.src = src;
		this.loaded = false;
		this.error = false;

		this.imageElement = new window.Image();

		this.imageElement.onload = () => {
			this.loaded = true;
			if(this.width === 0 || this.height === 0){
				this.width = this.imageElement.naturalWidth;
				this.height = this.imageElement.naturalHeight;
				this.update();
			}
		};

		this.imageElement.onerror = () => {
			this.error = true;
			this.loaded = false;
			console.warn('Failed to load image:', src);
		};

		this.imageElement.src = src;
	}

	clone(){
		const img 			= new Image([this.x, this.y, this.width, this.height]);
		img.type 			= this.type;
		img.src 			= this.src;
		img.imageElement 	= this.imageElement;
		img.loaded 			= this.loaded;
		img.locked 			= this.locked;
		img.rotation 		= this.rotation;
		img.flipX 			= this.flipX;
		img.flipY 			= this.flipY;
		img.opacity 		= this.opacity;
		return img;
	}

	copyFrom(other) {
		this.x 				= other.x;
		this.y 				= other.y;
		this.width 			= other.width;
		this.height 		= other.height;
		this.type 			= other.type;
		this.geometry 		= other.geometry;
		this.penStyle 		= other.penStyle;
		this.src 			= other.src;
		this.imageElement 	= other.imageElement;
		this.loaded 		= other.loaded;
		this.locked 		= other.locked;
		this.rotation 		= other.rotation;
		this.flipX 			= other.flipX;
		this.flipY 			= other.flipY;
		this.opacity 		= other.opacity;
		this.update();
	}

	// Translate the image by offset
	translate(dx, dy){
		this.x += dx;
		this.y += dy;
		this.update();
	}

	// Scale the image relative to an anchor point (preserves aspect ratio)
	scale(anchorX, anchorY, factor){
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;

		this.width = this.width * Math.abs(factor);
		this.height = this.height * Math.abs(factor);
		this.update();
	}

	// Rotate the image around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		const centerX = this.x + this.width / 2;
		const centerY = this.y + this.height / 2;
		const rotated = TransformUtils.rotatePoint(centerX, centerY, anchorX, anchorY, angleRad);

		this.x = rotated.x - this.width / 2;
		this.y = rotated.y - this.height / 2;

		this.rotation += angleRad;
		this.update();
	}

	// Mirror the image across a line defined by two points
	mirror(x1, y1, x2, y2){
		// Mirror the center position
		const centerX = this.x + this.width / 2;
		const centerY = this.y + this.height / 2;
		const mirrored = TransformUtils.mirrorPoint(centerX, centerY, x1, y1, x2, y2);

		// Update position based on mirrored center
		this.x = mirrored.x - this.width / 2;
		this.y = mirrored.y - this.height / 2;

		// Calculate mirror line angle (0 = horizontal, π/2 = vertical)
		const mirrorAngle = Math.atan2(y2 - y1, x2 - x1);

		// Normalize angle to [0, π) since mirror lines are bidirectional
		const normalizedAngle = ((mirrorAngle % Math.PI) + Math.PI) % Math.PI;

		// Determine flip axis based on mirror line orientation
		// Vertical line (around π/2): flip horizontally
		// Horizontal line (around 0 or π): flip vertically
		// For arbitrary angles, we adjust rotation and flip

		if(Math.abs(normalizedAngle - Math.PI/2) < 0.01){
			// Nearly vertical mirror line - flip horizontally
			this.flipX = !this.flipX;
			this.rotation = -this.rotation;
		} else if(normalizedAngle < 0.01 || Math.abs(normalizedAngle - Math.PI) < 0.01){
			// Nearly horizontal mirror line - flip vertically
			this.flipY = !this.flipY;
			this.rotation = -this.rotation;
		} else {
			// Arbitrary angle - reflect rotation and flip
			this.rotation = 2 * mirrorAngle - this.rotation;
			this.flipX = !this.flipX;
		}

		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left, 4=center
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // top-left - resize from top-left
				this.width += this.x - newX;
				this.height += this.y - newY;
				this.x = newX;
				this.y = newY;
				break;
			case 1: // top-right
				this.width = newX - this.x;
				this.height += this.y - newY;
				this.y = newY;
				break;
			case 2: // bottom-right
				this.width = newX - this.x;
				this.height = newY - this.y;
				break;
			case 3: // bottom-left
				this.width += this.x - newX;
				this.height = newY - this.y;
				this.x = newX;
				break;
			case 4: // center - move the image
				const halfW = this.width / 2;
				const halfH = this.height / 2;
				this.x = newX - halfW;
				this.y = newY - halfH;
				break;
		}

		// Ensure positive dimensions
		if(this.width < 0){
			this.x += this.width;
			this.width = Math.abs(this.width);
		}
		if(this.height < 0){
			this.y += this.height;
			this.height = Math.abs(this.height);
		}

		this.update();
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			locked: this.locked,
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
			rotation: this.rotation,
			flipX: this.flipX,
			flipY: this.flipY,
			opacity: this.opacity,
			src: this.src
		};
	}

	static fromJSON(data) {
		const img = new Image([data.x, data.y, data.width, data.height]);
		img.type = data.type;
		if(data.penStyle) img.penStyle = data.penStyle;
		if(data.locked !== undefined) img.locked = data.locked;
		if(data.rotation !== undefined) img.rotation = data.rotation;
		if(data.flipX !== undefined) img.flipX = data.flipX;
		if(data.flipY !== undefined) img.flipY = data.flipY;
		if(data.opacity !== undefined) img.opacity = data.opacity;

		// Load the image from path
		if(data.src){
			img.loadImage(data.src);
		}

		return img;
	}
}
