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

		// Images default to locked for tracing
		this.locked 		= true;

		this.updateBoundingBox();
	}

	update(){
		this.updateBoundingBox();
	}

	updateBoundingBox()
	{
		this.bounds.x 		= this.x;
		this.bounds.y 		= this.y;
		this.bounds.width 	= this.width;
		this.bounds.height 	= this.height;
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
		this.update();
	}

	// POIs: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left, 4=center
	getSnapPOIs() {
		return [
			{ x: this.x, y: this.y },
			{ x: this.x + this.width, y: this.y },
			{ x: this.x + this.width, y: this.y + this.height },
			{ x: this.x, y: this.y + this.height },
			{ x: this.x + this.width / 2, y: this.y + this.height / 2 }
		];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}

		// Find closest point on rectangle edges
		const edges = [
			// top edge
			{ x1: this.x, y1: this.y, x2: this.x + this.width, y2: this.y },
			// right edge
			{ x1: this.x + this.width, y1: this.y, x2: this.x + this.width, y2: this.y + this.height },
			// bottom edge
			{ x1: this.x + this.width, y1: this.y + this.height, x2: this.x, y2: this.y + this.height },
			// left edge
			{ x1: this.x, y1: this.y + this.height, x2: this.x, y2: this.y }
		];

		let closestPoint = null;
		let closestDist = Infinity;

		for(const edge of edges){
			const closest = VectorUtils.closestPointOnSegment(
				mouse,
				{ x: edge.x1, y: edge.y1 },
				{ x: edge.x2, y: edge.y2 }
			);
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
	// Note: Images don't visually rotate, only their position moves
	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		this.update();
	}

	// Mirror the image across a line defined by two points
	mirror(x1, y1, x2, y2){
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;
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
			src: this.src
		};
	}

	static fromJSON(data) {
		const img = new Image([data.x, data.y, data.width, data.height]);
		img.type = data.type;
		if(data.penStyle) img.penStyle = data.penStyle;
		if(data.locked !== undefined) img.locked = data.locked;

		// Load the image from path
		if(data.src){
			img.loadImage(data.src);
		}

		return img;
	}
}
