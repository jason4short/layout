import {Geometry, Shape, PenStyle} from './Geometry.js';
import {Point} from './Point.js';
import * as TransformUtils from './utils/TransformUtils.js';
import stage from '../core/Stage.js';
import {serializeText, deserializeText} from './GeometrySerializers.js';

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
		t.colorToken = this.colorToken;
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
	toJSON() {
		return serializeText(this);
	}

	static fromJSON(json) {
		return deserializeText(json, Text, PenStyle);
	}

	draw(ctx, renderer) {
		const color = '#111111'; // Text stays black even when selected

		// Convert position to screen coordinates
		const screenPos = renderer.toScreen(this.x, this.y);

		// Scale font size with zoom for world-space text
		const screenFontSize = this.fontSize * stage.zoom;

		// Build font string
		const fontStyle = this.fontStyle === 'italic' ? 'italic' : '';
		const fontWeight = this.fontWeight === 'bold' ? 'bold' : '';
		ctx.font = `${fontStyle} ${fontWeight} ${screenFontSize}px ${this.fontFamily}`.trim();
		ctx.fillStyle = color;
		ctx.textAlign = 'left'; // Always left for cursor positioning
		ctx.textBaseline = 'top';

		// Handle rotation
		if (this.rotation !== 0) {
			ctx.save();
			ctx.translate(screenPos.x, screenPos.y);
			ctx.rotate(this.rotation);
			this.drawTextContent(ctx, 0, 0, screenFontSize);
			ctx.restore();
		} else {
			this.drawTextContent(ctx, screenPos.x, screenPos.y, screenFontSize);
		}

		// Draw cursor and selection if this text is being edited
		const cursorInfo = renderer.textCursorInfo;
		if (cursorInfo && cursorInfo.text === this) {
			// Draw selection highlight first (behind cursor)
			if (cursorInfo.selectionStart !== undefined) {
				this.drawTextSelection(ctx, screenPos, screenFontSize, cursorInfo.selectionStart, cursorInfo.selectionEnd);
			}
			// Draw cursor
			if (cursorInfo.cursorVisible) {
				this.drawTextCursor(ctx, screenPos, screenFontSize, cursorInfo.position);
			}
		}

		// Draw bounding box when selected
		if (this.selected || this.showControlPoints) {
			this.drawTextBounds(ctx, screenPos, screenFontSize);
		}
	}

	drawTextContent(ctx, x, y, fontSize) {
		const lineHeight = fontSize * 1.2;
		const lines = this.text.split('\n');

		// Calculate bounding width in screen space
		const screenBoxWidth = this.boxWidth ? this.boxWidth * stage.zoom : null;

		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];

			// Word wrap if bounding box is set
			if (screenBoxWidth) {
				const words = line.split(' ');
				let currentLine = '';

				for (const word of words) {
					const testLine = currentLine ? currentLine + ' ' + word : word;
					const metrics = ctx.measureText(testLine);

					if (metrics.width > screenBoxWidth && currentLine) {
						ctx.fillText(currentLine, x, y);
						y += lineHeight;
						currentLine = word;
					} else {
						currentLine = testLine;
					}
				}
				if (currentLine) {
					ctx.fillText(currentLine, x, y);
					y += lineHeight;
				}
			} else {
				ctx.fillText(line, x, y);
				y += lineHeight;
			}
		}
	}

	drawTextBounds(ctx, screenPos, fontSize) {
		// Calculate bounds in screen space
		let screenWidth = this.textWidth * stage.zoom;
		let screenHeight = this.textHeight * stage.zoom;

		// Measure actual text if needed
		const lines = this.text.split('\n');
		let maxWidth = 0;
		for (const line of lines) {
			const metrics = ctx.measureText(line);
			maxWidth = Math.max(maxWidth, metrics.width);
		}
		if (!this.boxWidth) screenWidth = maxWidth;
		if (!this.boxHeight) screenHeight = lines.length * fontSize * 1.2;

		// Calculate left edge based on alignment
		let left = screenPos.x;
		if (this.alignment === 'center') left = screenPos.x - screenWidth / 2;
		else if (this.alignment === 'right') left = screenPos.x - screenWidth;

		// Draw bounding box
		ctx.strokeStyle = '#2b6cb0';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		ctx.strokeRect(left, screenPos.y, screenWidth, screenHeight);
		ctx.setLineDash([]);

		// Draw corner control points
		const corners = [
			{ x: left, y: screenPos.y },
			{ x: left + screenWidth, y: screenPos.y },
			{ x: left + screenWidth, y: screenPos.y + screenHeight },
			{ x: left, y: screenPos.y + screenHeight }
		];

		ctx.fillStyle = '#FFFFFF';
		ctx.strokeStyle = '#2b6cb0';
		for (const corner of corners) {
			ctx.beginPath();
			ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}

		// Draw anchor point
		ctx.fillStyle = '#2b6cb0';
		ctx.beginPath();
		ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
		ctx.fill();
	}

	drawTextCursor(ctx, screenPos, fontSize, cursorPos) {
		// Calculate cursor X position by measuring text up to cursor
		const textBeforeCursor = this.text.slice(0, cursorPos);
		const lines = textBeforeCursor.split('\n');
		const currentLineIndex = lines.length - 1;
		const currentLineText = lines[currentLineIndex];

		// Measure width of current line text
		const cursorX = screenPos.x + ctx.measureText(currentLineText).width;
		const lineHeight = fontSize * 1.2;
		const cursorY = screenPos.y + (currentLineIndex * lineHeight);

		// Draw cursor line
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(cursorX, cursorY);
		ctx.lineTo(cursorX, cursorY + fontSize);
		ctx.stroke();
	}

	drawTextSelection(ctx, screenPos, fontSize, selStart, selEnd) {
		const lineHeight = fontSize * 1.2;
		const allLines = this.text.split('\n');

		// Find line and column for start and end positions
		const getLineCol = (pos) => {
			let charCount = 0;
			for (let i = 0; i < allLines.length; i++) {
				const lineLen = allLines[i].length;
				if (pos <= charCount + lineLen) {
					return { line: i, col: pos - charCount };
				}
				charCount += lineLen + 1; // +1 for newline
			}
			return { line: allLines.length - 1, col: allLines[allLines.length - 1].length };
		};

		const startLC = getLineCol(selStart);
		const endLC = getLineCol(selEnd);

		// Calculate max text width for extending selection to edge
		let maxTextWidth = 0;
		for (const line of allLines) {
			const w = ctx.measureText(line).width;
			if (w > maxTextWidth) maxTextWidth = w;
		}
		// Use box width if set, otherwise use measured width + small padding
		const selectionEdge = this.boxWidth
			? this.boxWidth * stage.zoom
			: maxTextWidth + fontSize * 0.5;

		ctx.fillStyle = 'rgba(66, 133, 244, 0.3)'; // Light blue selection highlight

		for (let lineIdx = startLC.line; lineIdx <= endLC.line; lineIdx++) {
			const line = allLines[lineIdx];
			const lineY = screenPos.y + (lineIdx * lineHeight);

			// Calculate start X for this line's selection
			let startCol = 0;
			if (lineIdx === startLC.line) {
				startCol = startLC.col;
			}

			// Measure start position
			const startX = screenPos.x + ctx.measureText(line.slice(0, startCol)).width;

			// Calculate end X - extend to edge if not the last selected line
			let endX;
			if (lineIdx === endLC.line) {
				// Last line of selection - stop at the end column
				endX = screenPos.x + ctx.measureText(line.slice(0, endLC.col)).width;
			} else {
				// Not the last line - extend to the selection edge
				endX = screenPos.x + selectionEdge;
			}

			// Draw selection rectangle for this line
			ctx.fillRect(startX, lineY, endX - startX, lineHeight);
		}
	}

	drawHandles(ctx, renderer) {
		// Handles are drawn as part of drawTextBounds when selected
	}

	/**
	 * Handle double-click to start editing.
	 * @param {Object} clickPos - {x, y} world coordinates
	 * @param {Object} context - {toolManager, data, stage}
	 * @returns {boolean} true if handled
	 */
	handleDoubleClick(clickPos, context) {
		const { toolManager, data, stage } = context;

		// Switch to text tool and start editing
		toolManager.setTool(toolManager.textTool);

		const textTool = toolManager.textTool;
		textTool.text = this;
		textTool.cursorPos = textTool.getCursorPosFromClick(this, clickPos);
		textTool.isEditingExisting = true;

		// Remove from shapes and add to temp
		data.deleteShape(this);
		data.addTempShape(this);

		textTool.state = 1; // STATE.EDITING
		textTool.startCursorBlink();
		stage.render();

		return true;
	}
}
