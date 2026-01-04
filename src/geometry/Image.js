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

		// Images default to locked for tracing
		this.locked 		= true;

		this.updateBoundingBox();
	}

	update(){
		this.updateBoundingBox();
	}

	updateBoundingBox()
	{
		if(this.rotation === 0){
			this.bounds.x 		= this.x;
			this.bounds.y 		= this.y;
			this.bounds.width 	= this.width;
			this.bounds.height 	= this.height;
		} else {
			// Compute axis-aligned bounding box of rotated rectangle
			const corners = this.getRotatedCorners();
			const xs = corners.map(c => c.x);
			const ys = corners.map(c => c.y);
			const minX = Math.min(...xs);
			const maxX = Math.max(...xs);
			const minY = Math.min(...ys);
			const maxY = Math.max(...ys);

			this.bounds.x 		= minX;
			this.bounds.y 		= minY;
			this.bounds.width 	= maxX - minX;
			this.bounds.height 	= maxY - minY;
		}
	}

	// Load image from a file path or data URL
	loadImage(src){
		this.src = src;
		this.loaded = false;
		this.error = false;

		this.imageElement = new window.Image();

		this.imageElement.onload = () => {
			this.loaded = true;
			// If dimensions weren't set, use natural size
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
		const img 		= new Image([this.x, this.y, this.width, this.height]);
		img.type 		= this.type;
		img.src 		= this.src;
		img.imageElement = this.imageElement;
		img.loaded 		= this.loaded;
		img.locked 		= this.locked;
		img.rotation 	= this.rotation;
		img.flipX 		= this.flipX;
		img.flipY 		= this.flipY;
		return img;
	}

	copyFrom(other) {
		this.x = other.x;
		this.y = other.y;
		this.width = other.width;
		this.height = other.height;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.src = other.src;
		this.imageElement = other.imageElement;
		this.loaded = other.loaded;
		this.locked = other.locked;
		this.rotation = other.rotation;
		this.flipX = other.flipX;
		this.flipY = other.flipY;
		this.update();
	}

	// Get rotated corners for internal use
	getRotatedCorners() {
		const centerX = this.x + this.width / 2;
		const centerY = this.y + this.height / 2;
		const cos = Math.cos(this.rotation);
		const sin = Math.sin(this.rotation);

		// Unrotated corners relative to center
		const corners = [
			{ x: -this.width / 2, y: -this.height / 2 },  // top-left
			{ x: this.width / 2, y: -this.height / 2 },   // top-right
			{ x: this.width / 2, y: this.height / 2 },    // bottom-right
			{ x: -this.width / 2, y: this.height / 2 }    // bottom-left
		];

		// Rotate each corner around center
		return corners.map(c => ({
			x: centerX + c.x * cos - c.y * sin,
			y: centerY + c.x * sin + c.y * cos
		}));
	}

	// POIs: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left, 4=center
	getSnapPOIs() {
		const corners = this.getRotatedCorners();
		const centerX = this.x + this.width / 2;
		const centerY = this.y + this.height / 2;

		return [
			corners[0],
			corners[1],
			corners[2],
			corners[3],
			{ x: centerX, y: centerY }
		];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}

		// Get rotated corners
		const corners = this.getRotatedCorners();

		// Find closest point on rotated rectangle edges
		const edges = [
			{ start: corners[0], end: corners[1] },  // top edge
			{ start: corners[1], end: corners[2] },  // right edge
			{ start: corners[2], end: corners[3] },  // bottom edge
			{ start: corners[3], end: corners[0] }   // left edge
		];

		let closestPoint = null;
		let closestDist = Infinity;

		for(const edge of edges){
			const closest = VectorUtils.closestPointOnSegment(mouse, edge.start, edge.end);
			const dist = VectorUtils.distance(mouse, closest);
			if(dist < closestDist){
				closestDist = dist;
				closestPoint = closest;
			}
		}

		if(closestDist > pixelTolerance){
			return null;
		}

		const point = new Point(closestPoint.x, closestPoint.y);
		point.distance = closestDist;
		return point;
	}

	// Translate the image by offset
	translate(dx, dy){
		this.x += dx;
		this.y += dy;
		this.update();
	}

	// Scale the image relative to an anchor point (preserves aspect ratio)
	scale(anchorX, anchorY, factor){
		// Scale the top-left corner position
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;

		// Scale dimensions
		this.width = this.width * Math.abs(factor);
		this.height = this.height * Math.abs(factor);
		this.update();
	}

	// Rotate the image around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		// Rotate the center position around the anchor
		const centerX = this.x + this.width / 2;
		const centerY = this.y + this.height / 2;
		const rotated = TransformUtils.rotatePoint(centerX, centerY, anchorX, anchorY, angleRad);

		// Update position (keeping center at rotated location)
		this.x = rotated.x - this.width / 2;
		this.y = rotated.y - this.height / 2;

		// Accumulate the rotation angle
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

		// Load the image from path
		if(data.src){
			img.loadImage(data.src);
		}

		return img;
	}
}
