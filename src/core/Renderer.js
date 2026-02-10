import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape, PenStyle} from '../geometry/Geometry.js';
import toolManager from '../tools/ToolManager.js';
import { renderWallBoolean } from '../geometry/utils/WallBooleanUtils.js';

// Cache for frame transforms during render
let frameTransformCache = new Map();

// Theme presets: background + pen style colors + UI colors
export const ThemePresets = {
	light: {
		name: 'Light',
		background: '#E5E5E5',
		foreground: '#333333',
		wallFill: '#D0D0D0',
		colors: {
			[PenStyle.VISIBLE]:      '#111111',
			[PenStyle.CONSTRUCTION]: '#B400F5',
			[PenStyle.CENTERLINE]:   '#00CC00',
			[PenStyle.HIDDEN]:       '#666666',
			[PenStyle.PHANTOM]:      '#888888',
			[PenStyle.OUTLINE]:      '#000000',
			[PenStyle.DIMENSION]:    '#0000FF'
		}
	},
	dark: {
		name: 'Dark',
		background: '#1E1E1E',
		foreground: '#EEEEEE',
		wallFill: '#3A3A3A',
		colors: {
			[PenStyle.VISIBLE]:      '#DDDDDD',
			[PenStyle.CONSTRUCTION]: '#E066FF',
			[PenStyle.CENTERLINE]:   '#33FF66',
			[PenStyle.HIDDEN]:       '#888888',
			[PenStyle.PHANTOM]:      '#AAAAAA',
			[PenStyle.OUTLINE]:      '#FFFFFF',
			[PenStyle.DIMENSION]:    '#66AAFF'
		}
	},
	blueprint: {
		name: 'Blueprint',
		background: '#0A2463',
		foreground: '#FFFFFF',
		wallFill: '#1A3473',
		colors: {
			[PenStyle.VISIBLE]:      '#FFFFFF',
			[PenStyle.CONSTRUCTION]: '#87CEEB',
			[PenStyle.CENTERLINE]:   '#90EE90',
			[PenStyle.HIDDEN]:       '#B0C4DE',
			[PenStyle.PHANTOM]:      '#ADD8E6',
			[PenStyle.OUTLINE]:      '#FFFFFF',
			[PenStyle.DIMENSION]:    '#FFD700'
		}
	}
};

export class Renderer
{

	constructor()
	{
		this.marqueeRect = null; // Set by PointerTool during drag
		this.zoomRect = null;    // Set by StrokeTool during zoom gesture
		this.textCursorInfo = null; // Updated via events from TextTool

		// Pen style definitions: dash patterns and widths (colors come from theme)
		this.penStyleDefs = {
			[PenStyle.VISIBLE]:      { dash: [],                   width: 0.5 },
			[PenStyle.CONSTRUCTION]: { dash: [1, 4],               width: 0.5 },
			[PenStyle.CENTERLINE]:   { dash: [12, 3, 3, 3],        width: 0.5 },
			[PenStyle.HIDDEN]:       { dash: [6, 3],               width: 0.5 },
			[PenStyle.PHANTOM]:      { dash: [12, 3, 2, 3, 2, 3],  width: 0.5 },
			[PenStyle.OUTLINE]:      { dash: [],                   width: 1.5 },
			[PenStyle.DIMENSION]:    { dash: [],                   width: 0.5 }
		};

		// Optional lightweight render profiling (disabled by default).
		this.debugRenderTiming = false;
		this._timingFrames = 0;
		this._timingTotals = { walls: 0, hatch: 0, shapes: 0, total: 0 };
	}

	// Get effective color for a pen style (theme + overrides)
	getPenStyleColor(penStyle) {
		// Check for user override first
		if (data.penStyleOverrides && data.penStyleOverrides[penStyle]) {
			return data.penStyleOverrides[penStyle];
		}
		// Fall back to theme
		const theme = ThemePresets[data.theme] || ThemePresets.light;
		return theme.colors[penStyle] || '#000000';
	}

	// Get full pen style (color + dash + width)
	getPenStyle(penStyle) {
		const def = this.penStyleDefs[penStyle] || this.penStyleDefs[PenStyle.VISIBLE];
		return {
			color: this.getPenStyleColor(penStyle),
			dash: def.dash,
			width: def.width
		};
	}

	// Get foreground/text color from theme
	getForegroundColor() {
		const theme = ThemePresets[data.theme] || ThemePresets.light;
		return theme.foreground;
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
			const style = this.getPenStyle(PenStyle.CONSTRUCTION);
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
		const style			= this.getPenStyle(penStyle);

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

	// Check if user is actively moving/dragging shapes
	isInteracting() {
		const tool = toolManager.currentTool;
		return tool && (tool.isMoving || tool.isDragging);
	}

	// Draw hatch segments with batched stroke
	drawHatchSegments(ctx, segments) {
		ctx.beginPath();
		for (const seg of segments) {
			const p1 = this.toScreen(seg.x1, seg.y1);
			const p2 = this.toScreen(seg.x2, seg.y2);
			ctx.moveTo(p1.x, p1.y);
			ctx.lineTo(p2.x, p2.y);
		}
		ctx.stroke();
	}

	// Draw hatch fill for a shape
	drawHatch(ctx, shape) {
		const segments = shape.getHatchSegments();
		if (segments.length === 0) return;

		const penStyle = shape.penStyle || PenStyle.VISIBLE;
		const style = this.getPenStyle(penStyle);

		if (shape.selected) {
			ctx.strokeStyle = '#FF0000';
		} else if (shape.colorToken) {
			const token = data.getColorToken(shape.colorToken);
			ctx.strokeStyle = token ? token.color : style.color;
		} else {
			ctx.strokeStyle = style.color;
		}

		ctx.lineWidth = style.width;
		ctx.setLineDash([]);
		this.drawHatchSegments(ctx, segments);
	}

	// Draw hatch fill for a group of shapes
	drawGroupHatch(ctx, groupId) {
		const segments = data.getGroupHatchSegments(groupId);
		if (segments.length === 0) return;

		const style = this.getPenStyle(PenStyle.VISIBLE);
		const shapes = data.getGroupShapes(groupId);
		const anySelected = shapes.some(s => s.selected);

		ctx.strokeStyle = anySelected ? '#FF0000' : style.color;
		ctx.lineWidth = style.width;
		ctx.setLineDash([]);
		this.drawHatchSegments(ctx, segments);
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

	beginFrameTransform(ctx, frameId, screenOrigin) {
		if (!frameId) return false;
		const frame = this.getFrameTransform(frameId);
		if (!frame) return false;
		ctx.save();
		const screenOffset = stage.worldToScreen(frame.x, frame.y);
		ctx.translate(screenOffset.x - screenOrigin.x, screenOffset.y - screenOrigin.y);
		return true;
	}

	endFrameTransform(ctx, didTransform) {
		if (didTransform) ctx.restore();
	}

	buildRenderQueues(viewport) {
		const wallsByFrame = new Map(); // frameId (or null) -> Wall[]
		const otherShapes = [];

		for (const shape of data.getShapesToRender()) {
			// Frustum culling - skip shapes entirely outside viewport
			if (!this.isInViewport(shape, viewport)) continue;

			if (shape.geometry === Shape.WALL) {
				const key = shape.frameId || '__world__';
				if (!wallsByFrame.has(key)) wallsByFrame.set(key, []);
				wallsByFrame.get(key).push(shape);
			} else {
				otherShapes.push(shape);
			}
		}

		return { wallsByFrame, otherShapes };
	}

	drawWallsPass(ctx, wallsByFrame, screenOrigin) {
		for (const [frameKey, walls] of wallsByFrame) {
			const frameId = frameKey === '__world__' ? null : frameKey;
			const didFrameTransform = this.beginFrameTransform(ctx, frameId, screenOrigin);

			const theme = ThemePresets[data.theme] || ThemePresets.light;
			const strokeColor = this.getPenStyleColor(PenStyle.VISIBLE);
			const fillColor = theme.wallFill || '#CCCCCC';

			renderWallBoolean(ctx, this, walls, fillColor, strokeColor, 1);

			// Draw selected walls with selection highlight on top
			for (const wall of walls) {
				if (wall.selected) {
					const corners = wall.getCorners();
					const screen = corners.map(c => this.toScreen(c.x, c.y));
					ctx.beginPath();
					ctx.moveTo(screen[0].x, screen[0].y);
					for (let i = 1; i < 4; i++) {
						ctx.lineTo(screen[i].x, screen[i].y);
					}
					ctx.closePath();
					ctx.strokeStyle = '#FF0000';
					ctx.lineWidth = 1;
					ctx.setLineDash([]);
					ctx.stroke();
				}
				wall.drawHandles(ctx, this);
			}

			this.endFrameTransform(ctx, didFrameTransform);
		}
	}

	drawGroupHatchPass(ctx, interacting) {
		if (interacting) return;
		for (const [groupId, group] of data.groups) {
			if (group.hatchType && group.hatchType !== 'none') {
				this.drawGroupHatch(ctx, groupId);
			}
		}
	}

	drawOtherShapesPass(ctx, otherShapes, screenOrigin, interacting) {
		// Keep frame transforms active across contiguous shapes in the same frame
		// to avoid per-shape save/restore churn.
		let activeFrameId = null;
		let hasActiveFrameTransform = false;

		for (const shape of otherShapes) {
			const shapeFrameId = shape.frameId || null;

			if (shapeFrameId !== activeFrameId) {
				if (hasActiveFrameTransform) {
					ctx.restore();
					hasActiveFrameTransform = false;
				}

				activeFrameId = shapeFrameId;
				if (activeFrameId) {
					hasActiveFrameTransform = this.beginFrameTransform(ctx, activeFrameId, screenOrigin);
				}
			}

			// Draw hatch fill underneath outline — skip during drags
			if (!interacting && shape.hatchType && shape.hatchType !== 'none') {
				this.drawHatch(ctx, shape);
			}

			ctx.beginPath();
			this.applyPenStyle(ctx, shape);
			shape.draw(ctx, this);
			shape.drawHandles(ctx, this);
		}

		if (hasActiveFrameTransform) {
			this.endFrameTransform(ctx, hasActiveFrameTransform);
		}
	}

	drawSymbolLabelsPass(ctx) {
		// Instances are expanded in getShapesToRender() but we need to draw their labels
		if (data._symbolInstances) {
			for (const symbol of data._symbolInstances) {
				symbol.draw(ctx, this);
			}
		}
	}

	drawActiveFrameIndicator(ctx) {
		// Draw active frame indicator (shows which frame new shapes will be added to)
		if (!data.activeFrameId) return;
		const activeFrame = data.getFrame(data.activeFrameId);
		if (!activeFrame) return;

		const topLeft = this.toScreen(activeFrame.x, activeFrame.y);
		const width = this.toScreenScale(activeFrame.width);
		const height = this.toScreenScale(activeFrame.height);

		ctx.strokeStyle = '#10b981'; // Green to indicate "active/ready"
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);
		ctx.setLineDash([]);

		// Draw "Active" badge at top-right
		const badgeText = 'Active';
		ctx.font = '10px sans-serif';
		const metrics = ctx.measureText(badgeText);
		const badgeWidth = metrics.width + 8;
		const badgeHeight = 16;
		const badgeX = topLeft.x + width - badgeWidth - 4;
		const badgeY = topLeft.y + 4;

		ctx.fillStyle = '#10b981';
		ctx.beginPath();
		ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
		ctx.fill();

		ctx.fillStyle = '#ffffff';
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';
		ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
	}

	drawOverlayPass(ctx) {
		// Draw snap point indicators (small circles at stored snap points)
		// Source snap points show guide relationship labels (align:x, tangent, etc.)
		for (const snapPoint of data.snapPoints) {
			const pt = this.toScreen(snapPoint.x, snapPoint.y);
			ctx.beginPath();
			ctx.strokeStyle = '#2b6cb0';
			ctx.lineWidth = 0.5;
			ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
			ctx.stroke();

			// Draw guide relationship label for this source snap point
			if (snapPoint.label) {
				this.drawSnapLabel(ctx, pt, snapPoint.label);
			}
		}

		// Draw snap point crosshair
		const s = this.toScreen(data.snapPoint.x, data.snapPoint.y);
		const cs = 3; // crosshair size in screen pixels

		ctx.strokeStyle = this.getForegroundColor();
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

	draw()
	{
		const totalStart = this.debugRenderTiming ? performance.now() : 0;
		let ctx = stage.ctx;
		ctx.fillStyle = data.backgroundColor;
		ctx.fillRect(0, 0, stage.canvas.width, stage.canvas.height);

		// Calculate viewport once for frustum culling
		const viewport = this.getViewport();
		const screenOrigin = stage.worldToScreen(0, 0);

		// Track interaction state for hatch optimization
		const interacting = this.isInteracting();
		if ((!interacting && this._wasInteracting) || data.hatchDirty) {
			// Finished dragging or undo/redo — invalidate all hatch caches
			data.invalidateAllGroupHatch();
			for (const shape of data.shapes) {
				shape._hatchCache = null;
			}
			data.hatchDirty = false;
		}
		this._wasInteracting = interacting;

		// Clear frame transform cache
		frameTransformCache.clear();
		const { wallsByFrame, otherShapes } = this.buildRenderQueues(viewport);

		// Render walls first (underneath other geometry)
		const wallsStart = this.debugRenderTiming ? performance.now() : 0;
		this.drawWallsPass(ctx, wallsByFrame, screenOrigin);
		if (this.debugRenderTiming) {
			this._timingTotals.walls += (performance.now() - wallsStart);
		}

		// Render group hatch fills (underneath shapes) — skip during drags
		const hatchStart = this.debugRenderTiming ? performance.now() : 0;
		this.drawGroupHatchPass(ctx, interacting);
		if (this.debugRenderTiming) {
			this._timingTotals.hatch += (performance.now() - hatchStart);
		}

		// Render all other shapes on top of walls.
		const shapesStart = this.debugRenderTiming ? performance.now() : 0;
		this.drawOtherShapesPass(ctx, otherShapes, screenOrigin, interacting);
		if (this.debugRenderTiming) {
			this._timingTotals.shapes += (performance.now() - shapesStart);
		}

		this.drawSymbolLabelsPass(ctx);
		this.drawActiveFrameIndicator(ctx);

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
		this.drawOverlayPass(ctx);

		if (this.debugRenderTiming) {
			this._timingTotals.total += (performance.now() - totalStart);
			this._timingFrames++;
			if (this._timingFrames >= 60) {
				const f = this._timingFrames;
				console.log(`[render] avg ms over ${f} frames: total=${(this._timingTotals.total / f).toFixed(2)}, walls=${(this._timingTotals.walls / f).toFixed(2)}, hatch=${(this._timingTotals.hatch / f).toFixed(2)}, shapes=${(this._timingTotals.shapes / f).toFixed(2)}`);
				this._timingFrames = 0;
				this._timingTotals = { walls: 0, hatch: 0, shapes: 0, total: 0 };
			}
		}
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

		// Draw semi-transparent background using canvas background color
		const bg = data.backgroundColor;
		const r = parseInt(bg.slice(1, 3), 16);
		const g = parseInt(bg.slice(3, 5), 16);
		const b = parseInt(bg.slice(5, 7), 16);
		ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
		ctx.fillRect(
			x - padding,
			y - textHeight - padding,
			textWidth + padding * 2,
			textHeight + padding * 2
		);

		// Draw text using theme foreground color
		ctx.fillStyle = this.getForegroundColor();
		ctx.fillText(labelText, x, y);
	}

	drawSelectedControlPoints(ctx){
		const selectedPoints = data.getSelectedPoints();

		for(const [shape, indices] of selectedPoints.entries()){
			const pois = shape.getSnapPOIs();

			// Get frame offset if shape belongs to a frame (POIs are in local coords)
			let frameOffsetX = 0;
			let frameOffsetY = 0;
			if (shape.frameId) {
				const frame = data.getFrame(shape.frameId);
				if (frame) {
					frameOffsetX = frame.x;
					frameOffsetY = frame.y;
				}
			}

			for(const index of indices){
				const poi = pois[index];
				if(!poi) continue;

				// Convert from local to world coords, then to screen
				const worldX = poi.x + frameOffsetX;
				const worldY = poi.y + frameOffsetY;
				const pt = this.toScreen(worldX, worldY);

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

		// Draw frame border (50% transparent)
		ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
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
