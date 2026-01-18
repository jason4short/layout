import {Geometry, Shape, PenStyle} from './Geometry.js';
import {Point} from './Point.js';
import * as TransformUtils from './utils/TransformUtils.js';

export class Text extends Geometry
{
	constructor(params = [])
	{
		super();

		// Position
		this.x = params[0] || 0;
		this.y = params[1] || 0;

		// Content (allow empty string)
		this.text = params[2] !== undefined ? params[2] : '';

		// Font properties
		this.fontSize = params[3] || 16;
		this.fontFamily = params[4] || 'Arial';
		this.fontWeight = 'normal';  // 'normal' | 'bold'
		this.fontStyle = 'normal';   // 'normal' | 'italic'
		this.alignment = 'left';     // 'left' | 'center' | 'right'

		// Bounding box (null = auto-size based on text)
		this.boxWidth = null;
		this.boxHeight = null;

		// Rotation in radians
		this.rotation = 0;

		// Geometry type
		this.geometry = Shape.TEXT;
		this.type = Shape.PLAIN;
		this.penStyle = PenStyle.VISIBLE;

		// Calculated properties (set by update())
		this.textWidth = 0;
		this.textHeight = 0;

		this.update();
	}

	// Recalculate bounds - call after any property changes
	update()
	{
		// Estimate text dimensions (actual measurement happens in renderer)
		// This is an approximation; real measurement needs canvas context
		const avgCharWidth = this.fontSize * 0.6;
		const lineHeight = this.fontSize * 1.2;

		// Split into lines for multi-line text
		const lines = this.text.split('\n');
		const maxLineLength = Math.max(...lines.map(l => l.length));

		this.textWidth = this.boxWidth || (maxLineLength * avgCharWidth);
		this.textHeight = this.boxHeight || (lines.length * lineHeight);

		// Update bounds rectangle
		let bx = this.x;
		if(this.alignment === 'center') bx = this.x - this.textWidth / 2;
		else if(this.alignment === 'right') bx = this.x - this.textWidth;

		this.bounds.x = bx;
		this.bounds.y = this.y;
		this.bounds.width = this.textWidth;
		this.bounds.height = this.textHeight;
	}

	// Get font string for canvas
	getFontString()
	{
		return `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
	}

	// Update text dimensions from actual canvas measurement
	setMeasuredSize(width, height)
	{
		if(!this.boxWidth) this.textWidth = width;
		if(!this.boxHeight) this.textHeight = height;
		this.update();
	}

	// Points of interest for snapping and selection
	getSnapPOIs()
	{
		const pois = [];

		// Anchor point
		const anchor = new Point(this.x, this.y);
		anchor.shape = this;
		anchor.index = 0;
		pois.push(anchor);

		// Corner points based on alignment
		let left = this.x;
		if(this.alignment === 'center') left = this.x - this.textWidth / 2;
		else if(this.alignment === 'right') left = this.x - this.textWidth;

		const corners = [
			{ x: left, y: this.y },                                    // Top-left
			{ x: left + this.textWidth, y: this.y },                   // Top-right
			{ x: left + this.textWidth, y: this.y + this.textHeight }, // Bottom-right
			{ x: left, y: this.y + this.textHeight }                   // Bottom-left
		];

		for(let i = 0; i < corners.length; i++){
			const p = new Point(corners[i].x, corners[i].y);
			p.shape = this;
			p.index = i + 1;
			pois.push(p);
		}

		return pois;
	}

	// Hit detection
	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Check if mouse is within text bounds
		let left = this.x;
		if(this.alignment === 'center') left = this.x - this.textWidth / 2;
		else if(this.alignment === 'right') left = this.x - this.textWidth;

		if(mouse.x >= left && mouse.x <= left + this.textWidth &&
		   mouse.y >= this.y && mouse.y <= this.y + this.textHeight){
			const point = new Point(mouse.x, mouse.y);
			point.shape = this;
			point.distance = 0;
			return point;
		}

		return null;
	}

	// Selectable control point indices
	getSelectableIndices()
	{
		return [0, 1, 2, 3, 4]; // anchor + 4 corners
	}

	// Update control point position
	updateControlPoint(index, newX, newY)
	{
		if(index === 0){
			// Move anchor point (moves entire text)
			this.x = newX;
			this.y = newY;
		} else {
			// Corner drag - resize bounding box
			let left = this.x;
			if(this.alignment === 'center') left = this.x - this.textWidth / 2;
			else if(this.alignment === 'right') left = this.x - this.textWidth;

			const right = left + this.textWidth;
			const bottom = this.y + this.textHeight;

			switch(index){
				case 1: // Top-left
					this.boxWidth = right - newX;
					this.boxHeight = bottom - newY;
					if(this.alignment === 'left') this.x = newX;
					this.y = newY;
					break;
				case 2: // Top-right
					this.boxWidth = newX - left;
					this.boxHeight = bottom - newY;
					this.y = newY;
					break;
				case 3: // Bottom-right
					this.boxWidth = newX - left;
					this.boxHeight = newY - this.y;
					break;
				case 4: // Bottom-left
					this.boxWidth = right - newX;
					this.boxHeight = newY - this.y;
					if(this.alignment === 'left') this.x = newX;
					break;
			}
		}

		this.update();
		return true;
	}

	// Clone
	clone()
	{
		let t = new Text([this.x, this.y, this.text, this.fontSize, this.fontFamily]);
		t.fontWeight = this.fontWeight;
		t.fontStyle = this.fontStyle;
		t.alignment = this.alignment;
		t.boxWidth = this.boxWidth;
		t.boxHeight = this.boxHeight;
		t.rotation = this.rotation;
		t.type = this.type;
		t.penStyle = this.penStyle;
		t.groupId = this.groupId;
		return t;
	}

	// Copy from another text object
	copyFrom(other)
	{
		this.x = other.x;
		this.y = other.y;
		this.text = other.text;
		this.fontSize = other.fontSize;
		this.fontFamily = other.fontFamily;
		this.fontWeight = other.fontWeight;
		this.fontStyle = other.fontStyle;
		this.alignment = other.alignment;
		this.boxWidth = other.boxWidth;
		this.boxHeight = other.boxHeight;
		this.rotation = other.rotation;
		this.type = other.type;
		this.penStyle = other.penStyle;
		this.groupId = other.groupId;
		this.update();
	}

	// Transform methods
	translate(dx, dy)
	{
		this.x += dx;
		this.y += dy;
		this.update();
	}

	scale(anchorX, anchorY, factor)
	{
		const result = TransformUtils.scalePoint({x: this.x, y: this.y}, anchorX, anchorY, factor);
		this.x = result.x;
		this.y = result.y;
		this.fontSize *= factor;
		if(this.boxWidth) this.boxWidth *= factor;
		if(this.boxHeight) this.boxHeight *= factor;
		this.update();
	}

	rotate(anchorX, anchorY, angleRad)
	{
		const result = TransformUtils.rotatePoint({x: this.x, y: this.y}, anchorX, anchorY, angleRad);
		this.x = result.x;
		this.y = result.y;
		this.rotation += angleRad;
		this.update();
	}

	mirror(x1, y1, x2, y2)
	{
		const result = TransformUtils.mirrorPoint({x: this.x, y: this.y}, x1, y1, x2, y2);
		this.x = result.x;
		this.y = result.y;
		// Flip alignment on mirror
		if(this.alignment === 'left') this.alignment = 'right';
		else if(this.alignment === 'right') this.alignment = 'left';
		this.update();
	}

	// JSON serialization
	toJSON()
	{
		return {
			geometry: this.geometry,
			x: this.x,
			y: this.y,
			text: this.text,
			fontSize: this.fontSize,
			fontFamily: this.fontFamily,
			fontWeight: this.fontWeight,
			fontStyle: this.fontStyle,
			alignment: this.alignment,
			boxWidth: this.boxWidth,
			boxHeight: this.boxHeight,
			rotation: this.rotation,
			penStyle: this.penStyle
		};
	}

	static fromJSON(json)
	{
		const t = new Text([json.x, json.y, json.text, json.fontSize, json.fontFamily]);
		t.fontWeight = json.fontWeight || 'normal';
		t.fontStyle = json.fontStyle || 'normal';
		t.alignment = json.alignment || 'left';
		t.boxWidth = json.boxWidth || null;
		t.boxHeight = json.boxHeight || null;
		t.rotation = json.rotation || 0;
		t.penStyle = json.penStyle || PenStyle.VISIBLE;
		return t;
	}
}
