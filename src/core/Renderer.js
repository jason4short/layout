import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape, PenStyle} from '../geometry/Geometry.js';
import toolManager from '../tools/ToolManager.js';

// Cache for frame transforms during render
let frameTransformCache = new Map();

export class Renderer
{

	constructor()
	{
		this.marqueeRect = null; // Set by PointerTool during drag
		this.zoomRect = null;    // Set by StrokeTool during zoom gesture
		this.textCursorInfo = null; // Updated via events from TextTool

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

	init(){
		// Subscribe to text cursor updates
		stage.addEventListener('text-cursor-update', (info) => {this.textCursorInfo = info;});	
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

		// Use color token if assigned, otherwise use pen style default
		if (shape.colorToken) {
			const token = data.getColorToken(shape.colorToken);
			ctx.strokeStyle = token ? token.color : style.color;
		} else {
			ctx.strokeStyle = style.color;
		}
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

		// TODO: Frame shapes have local coords that need proper transform
		// For now, skip culling for shapes in frames to avoid incorrect clipping
		if (shape.frameId) {
			return true;
		}

		// AABB intersection test
		return !(
			bounds.x + bounds.width < viewport.minX ||
			bounds.x > viewport.maxX ||
			bounds.y + bounds.height < viewport.minY ||
			bounds.y > viewport.maxY
		);
	}

	/**
	 * Get frame transform (cached for performance).
	 */
	getFrameTransform(frameId) {
		if (!frameId) return null;

		// Check cache first
		if (frameTransformCache.has(frameId)) {
			return frameTransformCache.get(frameId);
		}

		// Look up frame and cache
		const frame = data.getFrame(frameId);
		if (frame) {
			frameTransformCache.set(frameId, frame);
		}
		return frame;
	}

	draw()
	{
		let ctx = stage.ctx;
		ctx.clearRect(0, 0, stage.canvas.width, stage.canvas.height);

		// Calculate viewport once for frustum culling
		const viewport = this.getViewport();

		// Clear frame transform cache
		frameTransformCache.clear();

		for(const shape of data.getShapesToRender())
		{
			// Frustum culling - skip shapes entirely outside viewport
			if (!this.isInViewport(shape, viewport)) continue;

			ctx.beginPath();
			this.applyPenStyle(ctx, shape);

			// If shape belongs to a frame, apply frame transform
			// Shapes inside frames store LOCAL coordinates
			if (shape.frameId) {
				const frame = this.getFrameTransform(shape.frameId);
				if (frame) {
					ctx.save();
					// Apply frame transform: translate by frame position
					const screenOffset = stage.worldToScreen(frame.x, frame.y);
					const screenOrigin = stage.worldToScreen(0, 0);
					ctx.translate(screenOffset.x - screenOrigin.x, screenOffset.y - screenOrigin.y);
				}
			}

			// Each shape knows how to draw itself
			shape.draw(ctx, this);
			shape.drawHandles(ctx, this);

			// Restore if we applied a frame transform
			if (shape.frameId) {
				const frame = this.getFrameTransform(shape.frameId);
				if (frame) {
					ctx.restore();
				}
			}
		}

		// No bounding boxes for groups or symbol instances
		// Instances are drawn via getShapesForRender() and show selection on their geometry

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
		// Draw snap point indicators (small circles at stored snap points)
		// Source snap points show guide relationship labels (align:x, tangent, etc.)
		for(const snapPoint of data.snapPoints)
		{
			const pt = this.toScreen(snapPoint.x, snapPoint.y);
			ctx.beginPath();
			ctx.strokeStyle = '#2b6cb0';
			ctx.lineWidth = 0.5;
			ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
			ctx.stroke();

			// Draw guide relationship label for this source snap point
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

		// Draw editing group indicator
		this.drawEditingGroup(ctx);

		// Draw auto-layout frame for selected groups
		this.drawAutoLayoutFrame(ctx);

		// Draw marquee selection box
		this.drawMarquee(ctx);

		// Draw zoom box preview
		this.drawZoomRect(ctx);
	}

	// Draw snap type label next to the snap point
	drawSnapLabel(ctx, screenPos, label){
		if(!label || (Array.isArray(label) && label.length === 0)) return;

		// Convert array to string if needed
		const labelText = Array.isArray(label) ? label.join(' + ') : label;

		const offsetX = 8;  // Offset from snap point
		const offsetY = -8;

		ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'bottom';
		const x = screenPos.x + offsetX;
		const y = screenPos.y + offsetY;

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

		// Draw text
		ctx.fillStyle = '#333';
		ctx.fillText(labelText, x, y);
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

	drawEditingGroup(ctx){
		if(!data.isEditingGroup()) return;

		const bounds = data.getGroupBounds(data.editingGroupId);
		if(!bounds) return;

		// Convert to screen coords
		const topLeft = this.toScreen(bounds.x, bounds.y);
		const width = this.toScreenScale(bounds.width);
		const height = this.toScreenScale(bounds.height);

		// Padding around the group
		const padding = 8;

		// Dashed blue outline
		ctx.strokeStyle = '#2563eb';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([6, 4]);
		ctx.strokeRect(
			topLeft.x - padding,
			topLeft.y - padding,
			width + padding * 2,
			height + padding * 2
		);
		ctx.setLineDash([]);

		// Draw "Editing Group" label
		ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'bottom';
		ctx.fillStyle = '#2563eb';
		ctx.fillText('Editing Group', topLeft.x - padding, topLeft.y - padding - 4);
	}

	// Draw auto-layout frame and resize handles for selected groups
	drawAutoLayoutFrame(ctx){
		// Find if selection represents an auto-layout group
		const selected = data.getSelected();
		if(selected.length === 0) return;

		// Check if all selected shapes belong to the same auto-layout group
		const groupId = this.findSelectedAutoLayoutGroup(selected);
		if(!groupId) return;

		const group = data.groups.get(groupId);
		if(!group || !group.autoLayout) return;

		const bounds = data.getAutoLayoutBounds(groupId);
		if(!bounds) return;

		// Convert to screen coords
		const topLeft = this.toScreen(bounds.x, bounds.y);
		const width = this.toScreenScale(bounds.width);
		const height = this.toScreenScale(bounds.height);

		// Draw subtle fill
		ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
		ctx.fillRect(topLeft.x, topLeft.y, width, height);

		// Draw frame border
		ctx.strokeStyle = '#3b82f6';
		ctx.lineWidth = 1;
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);

		// Draw resize handles
		this.drawAutoLayoutHandles(ctx, bounds, group);

		// Store for hit testing
		this.autoLayoutFrame = { groupId, bounds };
	}

	// Find if selected shapes all belong to the same auto-layout group
	findSelectedAutoLayoutGroup(selected){
		if(selected.length === 0) return null;

		// Get the root group of the first selected shape
		let groupId = selected[0].groupId;
		if(!groupId) return null;

		// Walk up to root group
		groupId = data.getRootGroupId(groupId);

		// Check if this group has autoLayout enabled
		const group = data.groups.get(groupId);
		if(!group || !group.autoLayout) return null;

		// Verify all selected shapes belong to this group
		const groupShapes = data.getGroupShapes(groupId);
		const groupShapeSet = new Set(groupShapes);
		for(const shape of selected){
			if(!groupShapeSet.has(shape)) return null;
		}

		return groupId;
	}

	// Draw resize handles for auto-layout frame
	drawAutoLayoutHandles(ctx, bounds, group){
		const handleSize = 6;

		// Corner positions (world coords)
		const corners = [
			{ x: bounds.x, y: bounds.y, cursor: 'nwse-resize', corner: 'tl' },
			{ x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize', corner: 'tr' },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize', corner: 'br' },
			{ x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize', corner: 'bl' }
		];

		// Edge midpoint positions
		const edges = [
			{ x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'ns-resize', edge: 'top' },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'ew-resize', edge: 'right' },
			{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 'ns-resize', edge: 'bottom' },
			{ x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'ew-resize', edge: 'left' }
		];

		ctx.fillStyle = '#FFFFFF';
		ctx.strokeStyle = '#3b82f6';
		ctx.lineWidth = 1;

		// Draw corner handles (squares)
		for(const corner of corners){
			const pt = this.toScreen(corner.x, corner.y);
			ctx.fillRect(pt.x - handleSize/2, pt.y - handleSize/2, handleSize, handleSize);
			ctx.strokeRect(pt.x - handleSize/2, pt.y - handleSize/2, handleSize, handleSize);
		}

		// Draw edge handles (smaller squares)
		const edgeSize = 4;
		for(const edge of edges){
			const pt = this.toScreen(edge.x, edge.y);
			ctx.fillRect(pt.x - edgeSize/2, pt.y - edgeSize/2, edgeSize, edgeSize);
			ctx.strokeRect(pt.x - edgeSize/2, pt.y - edgeSize/2, edgeSize, edgeSize);
		}

		// Store handle positions for hit testing (in world coords)
		this.autoLayoutHandles = { corners, edges };
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

