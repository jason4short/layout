import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape, PenStyle} from '../geometry/Geometry.js';
import toolManager from '../tools/ToolManager.js';
import events from './Events.js';

export class Renderer
{

	constructor()
	{
		this.marqueeRect = null; // Set by PointerTool during drag
		this.zoomRect = null;    // Set by StrokeTool during zoom gesture
		this.textCursorInfo = null; // Updated via events from TextTool

		// Subscribe to text cursor updates
		events.on('text-cursor-update', (info) => {
			this.textCursorInfo = info;
		});

		// Pen style definitions: [color, dashPattern, lineWidth]
		this.penStyles = {
			[PenStyle.VISIBLE]:      { color: '#111111', dash: [],           width: 0.5 },
			[PenStyle.CONSTRUCTION]: { color: '#B400F5', dash: [1, 4],       width: 0.5 },
			[PenStyle.CENTERLINE]:   { color: '#00CC00', dash: [12, 3, 3, 3], width: 0.5 },
			[PenStyle.HIDDEN]:       { color: '#666666', dash: [6, 3],       width: 0.5 },
			[PenStyle.PHANTOM]:      { color: '#888888', dash: [12, 3, 2, 3, 2, 3], width: 0.5 },
			[PenStyle.OUTLINE]:      { color: '#000000', dash: [],           width: 1.5 },
			[PenStyle.DIMENSION]:    { color: '#0000FF', dash: [],           width: 0.5 }
		};
	}

	// Helper to convert world point to screen
	toScreen(worldX, worldY) {
		return stage.worldToScreen(worldX, worldY);
	}

	// Helper to convert world distance to screen pixels
	toScreenScale(worldValue) {
		return stage.worldToScreenScale(worldValue);
	}

	// Apply pen style to context (handles selection override)
	applyPenStyle(ctx, shape) {
		if(shape.selected) {
			ctx.strokeStyle = '#FF0000';
			ctx.lineWidth = 0.5;
			ctx.setLineDash([]);
			return;
		}

		// Special handling for construction geometry type (infinite construction lines)
		if(shape.type === Shape.CONSTRUCTION) {
			const style = this.penStyles[PenStyle.CONSTRUCTION];
			ctx.strokeStyle = style.color;
			ctx.lineWidth = style.width;
			ctx.setLineDash(style.dash);
			return;
		}

		// Special handling for guide lines - only render if active (snap point is on the guide)
		if(shape.type === Shape.GUIDE) {
			if(!shape.active) {
				ctx.strokeStyle = 'transparent'; // Don't render inactive guides
				return;
			}
			ctx.strokeStyle = '#ff0000';
			ctx.lineWidth = 0.5;
			ctx.setLineDash([1, 4]);
			return;
		}

		// Apply pen style
		const penStyle 		= shape.penStyle || PenStyle.VISIBLE;
		const style			= this.penStyles[penStyle] || this.penStyles[PenStyle.VISIBLE];

		ctx.strokeStyle 	= style.color;
		ctx.lineWidth 		= style.width;
		ctx.setLineDash(style.dash);
	}

	// Reset context after drawing (clear dash pattern)
	resetPenStyle(ctx) {
		ctx.setLineDash([]);
	}

	/**
	 * Get the visible viewport in world coordinates.
	 * Used for frustum culling - skip drawing shapes outside viewport.
	 */
	getViewport() {
		const canvasWidth = stage.canvas.clientWidth;
		const canvasHeight = stage.canvas.clientHeight;

		// Convert screen corners to world coords
		const topLeft = stage.screenToWorld(0, 0);
		const bottomRight = stage.screenToWorld(canvasWidth, canvasHeight);

		return {
			x: topLeft.x,
			y: topLeft.y,
			width: bottomRight.x - topLeft.x,
			height: bottomRight.y - topLeft.y,
			// For quick checks
			minX: topLeft.x,
			minY: topLeft.y,
			maxX: bottomRight.x,
			maxY: bottomRight.y
		};
	}

	/**
	 * Check if a shape's bounds intersect the viewport.
	 * Returns true if shape should be drawn.
	 */
	isInViewport(shape, viewport) {
		const bounds = shape.bounds;
		if (!bounds) return true; // No bounds = always draw

		// AABB intersection test
		return !(
			bounds.x + bounds.width < viewport.minX ||
			bounds.x > viewport.maxX ||
			bounds.y + bounds.height < viewport.minY ||
			bounds.y > viewport.maxY
		);
	}

	draw()
	{
		let ctx = stage.ctx;
		ctx.clearRect(0, 0, stage.canvas.width, stage.canvas.height);

		// Calculate viewport once for frustum culling
		const viewport = this.getViewport();

		for(const shape of data.getShapesToRender())
		{
			// Frustum culling - skip shapes entirely outside viewport
			if (!this.isInViewport(shape, viewport)) continue;

			ctx.beginPath();
			this.applyPenStyle(ctx, shape);

			// Each shape knows how to draw itself
			shape.draw(ctx, this);
			shape.drawHandles(ctx, this);
		}

		// Draw symbol selection boxes and unlinked placeholders
		if (data._symbolInstances) {
			for (const symbol of data._symbolInstances) {
				if (!symbol.definition) {
					// Draw placeholder for unlinked symbol
					const screenPos = this.toScreen(symbol.x, symbol.y);
					ctx.strokeStyle = '#FF0000';
					ctx.lineWidth = 1;
					ctx.setLineDash([]);
					ctx.strokeRect(screenPos.x - 10, screenPos.y - 10, 20, 20);
					ctx.beginPath();
					ctx.moveTo(screenPos.x - 10, screenPos.y - 10);
					ctx.lineTo(screenPos.x + 10, screenPos.y + 10);
					ctx.moveTo(screenPos.x + 10, screenPos.y - 10);
					ctx.lineTo(screenPos.x - 10, screenPos.y + 10);
					ctx.stroke();
				} else if (symbol.selected) {
					// Draw selection bounding box
					const b = symbol.bounds;
					const tl = this.toScreen(b.x, b.y);
					const w = this.toScreenScale(b.width);
					const h = this.toScreenScale(b.height);

					ctx.strokeStyle = '#2563eb';
					ctx.lineWidth = 1;
					ctx.setLineDash([4, 4]);
					ctx.strokeRect(tl.x, tl.y, w, h);
					ctx.setLineDash([]);

					// Draw anchor point
					const anchorScreen = this.toScreen(symbol.x, symbol.y);
					ctx.fillStyle = '#2563eb';
					ctx.beginPath();
					ctx.arc(anchorScreen.x, anchorScreen.y, 4, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}

/* debugging - disabled for performance
		// Draw snap point indicators
		for(const intersection of data.getIntersectionCandidates())
		{
			const pt = this.toScreen(intersection.x, intersection.y);
			ctx.beginPath();
			ctx.strokeStyle = '#FF0000';
			ctx.lineWidth = 0.5;
			ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
			ctx.stroke();
		}
		// Draw snap point indicators
		for(const intersection of data.getPOICandidates())
		{
			const pt = this.toScreen(intersection.x, intersection.y);
			ctx.beginPath();
			ctx.strokeStyle = '#00FF00';
			ctx.lineWidth = 0.5;
			ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
			ctx.stroke();
		}
*/
		// Draw snap point indicators and their labels
		for(const snapPoint of data.snapPoints)
		{
			const pt = this.toScreen(snapPoint.x, snapPoint.y);
			ctx.beginPath();
			ctx.strokeStyle = '#2b6cb0';
			ctx.lineWidth = 0.5;
			ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
			ctx.stroke();

			// Draw label for this snap point if it has any
			if(snapPoint.label){
				this.drawSnapLabel(ctx, pt, snapPoint.label);
			}
		}


		// Draw snap point crosshair
		const s = this.toScreen(data.snapPoint.x, data.snapPoint.y);
		const cs = 3; // crosshair size in screen pixels

		ctx.strokeStyle = '#000';
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(s.x + cs, s.y + cs); ctx.lineTo(s.x - cs, s.y - cs); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(s.x - cs, s.y + cs); ctx.lineTo(s.x + cs, s.y - cs); ctx.stroke();

		// Draw snap label
		this.drawSnapLabel(ctx, s, data.snapPoint.label);

		// Draw selected control points
		this.drawSelectedControlPoints(ctx);

		// Draw marquee selection box
		this.drawMarquee(ctx);

		// Draw zoom box preview
		this.drawZoomRect(ctx);
	}

	// Draw snap type label next to the snap point
	drawSnapLabel(ctx, screenPos, label){
		if(!label) return;


		// XXX why is labels an array - should only be ONE label!
		//const labelText = labels.join(' ');
		const offsetX = 8;  // Offset from snap point
		const offsetY = -8;

		ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'bottom';
		const x = screenPos.x + offsetX;
		const y = screenPos.y + offsetY;

/*
// removed BG for now...

		// Measure text for background
		const metrics = ctx.measureText(labelText);
		const textWidth = metrics.width;
		const textHeight = 12;
		const padding = 2;


		// Draw semi-transparent background
		ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
		ctx.fillRect(
			x - padding,
			y - textHeight - padding,
			textWidth + padding * 2,
			textHeight + padding * 2
		);
*/
		// Draw text
		ctx.fillStyle = '#333';
		ctx.fillText(label, x, y);
	}

	drawSelectedControlPoints(ctx){
		const selectedPoints = data.getSelectedPoints();

		for(const [shape, indices] of selectedPoints.entries()){
			const pois = shape.getSnapPOIs();

			for(const index of indices){
				const poi = pois[index];
				if(!poi) continue;

				const pt = this.toScreen(poi.x, poi.y);

				// Draw filled square for selected control point
				ctx.fillStyle = '#FF0000';
				ctx.strokeStyle = '#000000';
				ctx.lineWidth = 0.5;

				const size = 3; // Half-size of square in screen pixels
				ctx.fillRect(pt.x - size, pt.y - size, size * 2, size * 2);
				ctx.strokeRect(pt.x - size, pt.y - size, size * 2, size * 2);
			}
		}
	}

	drawMarquee(ctx){
		if(!this.marqueeRect) return;

		const r = this.marqueeRect;

		// Marquee is in world coords, convert to screen
		const topLeft = this.toScreen(r.x, r.y);
		const width = this.toScreenScale(r.width);
		const height = this.toScreenScale(r.height);

		// Dashed blue outline
		ctx.strokeStyle = '#0066CC';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);
		ctx.setLineDash([]);

		// Semi-transparent fill
		ctx.fillStyle = 'rgba(0, 102, 204, 0.1)';
		ctx.fillRect(topLeft.x, topLeft.y, width, height);
	}

	// Cohen-Sutherland line clipping to viewport (screen coords)
	// Alt - try Liang Barsky Line Clipping Algorithm
	clipLineToViewport(p1, p2){
		const xmin = 0, ymin = 0;
		const xmax = stage.canvas.width;
		const ymax = stage.canvas.height;

		// Region codes
		const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;

		const computeCode = (x, y) => {
			let code = INSIDE;
			if(x < xmin) code |= LEFT;
			else if(x > xmax) code |= RIGHT;
			if(y < ymin) code |= TOP;
			else if(y > ymax) code |= BOTTOM;
			return code;
		};

		let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
		let code1 = computeCode(x1, y1);
		let code2 = computeCode(x2, y2);

		while(true){
			if(!(code1 | code2)){
				// Both inside
				return {x1, y1, x2, y2};
			} else if(code1 & code2){
				// Both outside same region - no intersection
				return null;
			} else {
				// Needs clipping
				const codeOut = code1 ? code1 : code2;
				let x, y;

				if(codeOut & BOTTOM){
					x = x1 + (x2 - x1) * (ymax - y1) / (y2 - y1);
					y = ymax;
				} else if(codeOut & TOP){
					x = x1 + (x2 - x1) * (ymin - y1) / (y2 - y1);
					y = ymin;
				} else if(codeOut & RIGHT){
					y = y1 + (y2 - y1) * (xmax - x1) / (x2 - x1);
					x = xmax;
				} else if(codeOut & LEFT){
					y = y1 + (y2 - y1) * (xmin - x1) / (x2 - x1);
					x = xmin;
				}

				if(codeOut === code1){
					x1 = x; y1 = y;
					code1 = computeCode(x1, y1);
				} else {
					x2 = x; y2 = y;
					code2 = computeCode(x2, y2);
				}
			}
		}
	}

	// Calculate visible arc angles for large circles (screen coords)
	getVisibleArcAngles(center, radius){
		const w = stage.canvas.width;
		const h = stage.canvas.height;
		const padding = 0.1; // Extra angle padding (radians)

		// Collect angles where circle intersects viewport edges
		const angles = [];

		// Left edge (x = 0)
		if(Math.abs(center.x) <= radius){
			const dy = Math.sqrt(radius * radius - center.x * center.x);
			angles.push(Math.atan2(center.y - dy - center.y, 0 - center.x));
			angles.push(Math.atan2(center.y + dy - center.y, 0 - center.x));
		}

		// Right edge (x = w)
		if(Math.abs(center.x - w) <= radius){
			const dy = Math.sqrt(radius * radius - (center.x - w) * (center.x - w));
			angles.push(Math.atan2(-dy, w - center.x));
			angles.push(Math.atan2(dy, w - center.x));
		}

		// Top edge (y = 0)
		if(Math.abs(center.y) <= radius){
			const dx = Math.sqrt(radius * radius - center.y * center.y);
			angles.push(Math.atan2(0 - center.y, center.x - dx - center.x));
			angles.push(Math.atan2(0 - center.y, center.x + dx - center.x));
		}

		// Bottom edge (y = h)
		if(Math.abs(center.y - h) <= radius){
			const dx = Math.sqrt(radius * radius - (center.y - h) * (center.y - h));
			angles.push(Math.atan2(h - center.y, -dx));
			angles.push(Math.atan2(h - center.y, dx));
		}

		if(angles.length < 2) return null; // Circle doesn't cross viewport meaningfully

		// Normalize angles to [0, 2PI]
		const normalized = angles.map(a => a < 0 ? a + Math.PI * 2 : a);
		const min = Math.min(...normalized);
		const max = Math.max(...normalized);

		// Add padding and return
		return {
			start: min - padding,
			end: max + padding
		};
	}

	drawZoomRect(ctx){
		if(!this.zoomRect) return;

		const r = this.zoomRect;

		// Convert world coords to screen
		const topLeft = this.toScreen(r.x, r.y);
		const width = this.toScreenScale(r.width);
		const height = this.toScreenScale(r.height);

		// Orange dashed outline for zoom box
		ctx.strokeStyle = '#FF6600';
		ctx.lineWidth = .5;
		ctx.setLineDash([6, 3]);
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);
		ctx.setLineDash([]);

		// Semi-transparent orange fill
		ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
		ctx.fillRect(topLeft.x, topLeft.y, width, height);
	}

	drawArrow(ctx, x, y, dirX, dirY, perpX, perpY, size){
		const arrowWidth = size * 0.4;

		// Arrow tip is at (x, y), pointing in (dirX, dirY) direction
		const baseX = x + dirX * size;
		const baseY = y + dirY * size;

		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(baseX + perpX * arrowWidth, baseY + perpY * arrowWidth);
		ctx.lineTo(baseX - perpX * arrowWidth, baseY - perpY * arrowWidth);
		ctx.closePath();
		ctx.fill();
	}

	getBounds(){

		return new Rectangle()
	}

}

