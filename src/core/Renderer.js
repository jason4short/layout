import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape, PenStyle} from '../geometry/Geometry.js';

export class Renderer
{

	constructor()
	{
		this.marqueeRect = null; // Set by PointerTool during drag
		this.zoomRect = null;    // Set by StrokeTool during zoom gesture

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

		// Special handling for guide lines
		if(shape.type === Shape.GUIDE/* && shape.active*/) {
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

			if(shape.geometry === Shape.LINE){
				const start 	= this.toScreen(shape.start.x, shape.start.y);
				const end 		= this.toScreen(shape.end.x, shape.end.y);

				// Skip inactive guides
				//if(shape.type === Shape.GUIDE && !shape.active) continue;

				ctx.moveTo(start.x, start.y);
				ctx.lineTo(end.x, end.y);
				ctx.stroke();
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.CIRCLE){
				const center 	= this.toScreen(shape.x, shape.y);
				const radius 	= this.toScreenScale(shape.radius);
				ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
				ctx.stroke();
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.ARC){
				const center 	= this.toScreen(shape.x, shape.y);
				const radius 	= this.toScreenScale(shape.radius);
				ctx.arc(center.x, center.y, radius, shape.startAngle, shape.endAngle);
				ctx.stroke();
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.TANGENT_ARC){
				const center 	= this.toScreen(shape.x, shape.y);
				const radius 	= this.toScreenScale(shape.radius);
				ctx.arc(center.x, center.y, radius, shape.startAngle, shape.endAngle);
				ctx.stroke();
				this.resetPenStyle(ctx);

				// Draw tangent handle when control points are visible
				if(shape.showControlPoints || shape.selected){
					const startPt	= this.toScreen(shape.startPoint.x, shape.startPoint.y);
					const tangentPt = this.toScreen(shape.tangentPoint.x, shape.tangentPoint.y);
					const endPt 	= this.toScreen(shape.endPoint.x, shape.endPoint.y);

					// Draw tangent line from start to tangent handle
					ctx.beginPath();
					ctx.strokeStyle = '#AAAAAA';
					ctx.lineWidth = 0.5;
					ctx.setLineDash([2, 2]);
					ctx.moveTo(startPt.x, startPt.y);
					ctx.lineTo(tangentPt.x, tangentPt.y);
					ctx.stroke();
					ctx.setLineDash([]);

					// Draw control point handles
					ctx.lineWidth = 0.5;
					ctx.strokeStyle = '#666666';
					ctx.fillStyle = '#FFFFFF';
					const handleRadius = 4;

					// Start point
					ctx.beginPath();
					ctx.arc(startPt.x, startPt.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();

					// Tangent handle (diamond shape to differentiate)
					ctx.beginPath();
					ctx.fillStyle = '#FFCC00';
					ctx.moveTo(tangentPt.x, tangentPt.y - handleRadius);
					ctx.lineTo(tangentPt.x + handleRadius, tangentPt.y);
					ctx.lineTo(tangentPt.x, tangentPt.y + handleRadius);
					ctx.lineTo(tangentPt.x - handleRadius, tangentPt.y);
					ctx.closePath();
					ctx.fill();
					ctx.stroke();

					// End point
					ctx.beginPath();
					ctx.fillStyle = '#FFFFFF';
					ctx.arc(endPt.x, endPt.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();
				}

			} else if(shape.geometry === Shape.ELLIPSE){
				const center = this.toScreen(shape.x, shape.y);
				const radiusX = this.toScreenScale(shape.radiusX);
				const radiusY = this.toScreenScale(shape.radiusY);
				ctx.ellipse(center.x, center.y, radiusX, radiusY, shape.rotation, 0, Math.PI * 2);
				ctx.stroke();
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.ELLIPTICAL_ARC){
				const center = this.toScreen(shape.x, shape.y);
				const radiusX = this.toScreenScale(shape.radiusX);
				const radiusY = this.toScreenScale(shape.radiusY);
				ctx.ellipse(center.x, center.y, radiusX, radiusY, shape.rotation, shape.startAngle, shape.endAngle);
				ctx.stroke();
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.SPLINE){
				const p0 = this.toScreen(shape.p0.x, shape.p0.y);
				const p1 = this.toScreen(shape.p1.x, shape.p1.y);
				const p2 = this.toScreen(shape.p2.x, shape.p2.y);
				const p3 = this.toScreen(shape.p3.x, shape.p3.y);

				// Draw the cubic Bezier curve
				ctx.moveTo(p0.x, p0.y);
				ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
				ctx.stroke();
				this.resetPenStyle(ctx);

				// Only draw control points if toggled on or selected
				if(shape.showControlPoints || shape.selected){
					// Draw control polygon (gray lines)
					ctx.beginPath();
					ctx.strokeStyle = '#AAAAAA';
					ctx.lineWidth = 0.5;
					ctx.setLineDash([2, 2]);
					ctx.moveTo(p0.x, p0.y);
					ctx.lineTo(p1.x, p1.y);
					ctx.lineTo(p2.x, p2.y);
					ctx.lineTo(p3.x, p3.y);
					ctx.stroke();
					ctx.setLineDash([]);

					// Draw control point handles (circles)
					ctx.lineWidth = 0.5;
					ctx.strokeStyle = '#666666';
					ctx.fillStyle = '#FFFFFF';
					const handleRadius = 4;

					ctx.beginPath();
					ctx.arc(p0.x, p0.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();

					ctx.beginPath();
					ctx.arc(p1.x, p1.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();

					ctx.beginPath();
					ctx.arc(p2.x, p2.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();

					ctx.beginPath();
					ctx.arc(p3.x, p3.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();
				}

			} else if(shape.geometry === Shape.IMAGE){
				const topLeft = this.toScreen(shape.x, shape.y);
				const width = this.toScreenScale(shape.width);
				const height = this.toScreenScale(shape.height);

				// Save context for transforms
				ctx.save();

				// Apply opacity
				if(shape.opacity !== undefined && shape.opacity < 1){
					ctx.globalAlpha = shape.opacity;
				}

				// Draw the image if loaded
				if(shape.loaded && shape.imageElement){
					const img = shape.imageElement;
					const needsTransform = shape.rotation !== 0 || shape.flipX || shape.flipY;

					if(needsTransform){
						// Apply rotation and flip around center
						const centerX = topLeft.x + width / 2;
						const centerY = topLeft.y + height / 2;
						ctx.translate(centerX, centerY);
						if(shape.rotation !== 0) ctx.rotate(shape.rotation);
						if(shape.flipX || shape.flipY) ctx.scale(shape.flipX ? -1 : 1, shape.flipY ? -1 : 1);
						ctx.translate(-centerX, -centerY);
						ctx.drawImage(img, topLeft.x, topLeft.y, width, height);
					} else {
						// No transform - use optimized partial draw for high zoom
						const canvasW = stage.canvas.clientWidth;
						const canvasH = stage.canvas.clientHeight;

						// Clamp to visible area
						const dstLeft = Math.max(0, topLeft.x);
						const dstTop = Math.max(0, topLeft.y);
						const dstRight = Math.min(canvasW, topLeft.x + width);
						const dstBottom = Math.min(canvasH, topLeft.y + height);

						if(dstRight > dstLeft && dstBottom > dstTop){
							// Calculate corresponding source region
							const srcLeft = ((dstLeft - topLeft.x) / width) * img.naturalWidth;
							const srcTop = ((dstTop - topLeft.y) / height) * img.naturalHeight;
							const srcRight = ((dstRight - topLeft.x) / width) * img.naturalWidth;
							const srcBottom = ((dstBottom - topLeft.y) / height) * img.naturalHeight;

							ctx.drawImage(img,
								srcLeft, srcTop, srcRight - srcLeft, srcBottom - srcTop,
								dstLeft, dstTop, dstRight - dstLeft, dstBottom - dstTop
							);
						}
					}
				} else {
					// Draw placeholder rectangle
					ctx.fillStyle = shape.error ? '#FFEEEE' : '#F0F0F0';
					ctx.fillRect(topLeft.x, topLeft.y, width, height);

					// Draw X pattern for missing image
					if(shape.error){
						ctx.strokeStyle = '#CC0000';
						ctx.lineWidth = 1;
						ctx.beginPath();
						ctx.moveTo(topLeft.x, topLeft.y);
						ctx.lineTo(topLeft.x + width, topLeft.y + height);
						ctx.moveTo(topLeft.x + width, topLeft.y);
						ctx.lineTo(topLeft.x, topLeft.y + height);
						ctx.stroke();
					}
				}

				// Draw border (dashed if locked)
				ctx.strokeStyle = shape.selected ? '#FF0000' : (shape.locked ? '#999999' : '#666666');
				ctx.lineWidth = 0.5;
				if(shape.locked && !shape.selected){
					ctx.setLineDash([4, 4]);
				}
				ctx.strokeRect(topLeft.x, topLeft.y, width, height);
				ctx.setLineDash([]);

				// Restore context after rotation (before drawing handles)
				ctx.restore();

				// Draw corner handles when selected (and not locked)
				// These are drawn in screen space at the rotated corner positions
				if(shape.selected && !shape.locked){
					const handleRadius = 4;
					ctx.lineWidth = 0.5;
					ctx.strokeStyle = '#666666';
					ctx.fillStyle = '#FFFFFF';

					// Get rotated corners in world coords and convert to screen
					const pois = shape.getSnapPOIs();
					const corners = pois.slice(0, 4).map(p => this.toScreen(p.x, p.y));

					for(const corner of corners){
						ctx.beginPath();
						ctx.arc(corner.x, corner.y, handleRadius, 0, Math.PI * 2);
						ctx.fill();
						ctx.stroke();
					}
				}

			} else if(shape.geometry === Shape.DIMENSION){
				this.drawDimension(ctx, shape);
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
		// Draw snap point indicators
		for(const intersection of data.snapPoints)
		{
			const pt = this.toScreen(intersection.x, intersection.y);
			ctx.beginPath();
			ctx.strokeStyle = '#2b6cb0';
			ctx.lineWidth = 0.5;
			ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
			ctx.stroke();
		}


		// Draw snap point crosshair
		const s = this.toScreen(data.snapPoint.x, data.snapPoint.y);
		const cs = 3; // crosshair size in screen pixels

		ctx.strokeStyle = '#000';
		ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(s.x + cs, s.y + cs); ctx.lineTo(s.x - cs, s.y - cs); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(s.x - cs, s.y + cs); ctx.lineTo(s.x + cs, s.y - cs); ctx.stroke();

		// Draw selected control points
		this.drawSelectedControlPoints(ctx);

		// Draw marquee selection box
		this.drawMarquee(ctx);

		// Draw zoom box preview
		this.drawZoomRect(ctx);
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

	drawDimension(ctx, shape){
		const color = shape.selected ? '#FF0000' : '#111111';
		const arrowSize = 8;  // Screen pixels
		const textOffset = 4; // Gap between line and text

		// Convert all points to screen coordinates
		const dimStart 		= this.toScreen(shape.dimLineStart.x, 	shape.dimLineStart.y);
		const dimEnd 		= this.toScreen(shape.dimLineEnd.x, 	shape.dimLineEnd.y);
		const textPos 		= this.toScreen(shape.textPosition.x, 	shape.textPosition.y);
		const ext1Start 	= this.toScreen(shape.extLine1Start.x, 	shape.extLine1Start.y);
		const ext1End 		= this.toScreen(shape.extLine1End.x, 	shape.extLine1End.y);
		const ext2Start 	= this.toScreen(shape.extLine2Start.x, 	shape.extLine2Start.y);
		const ext2End 		= this.toScreen(shape.extLine2End.x, 	shape.extLine2End.y);

		ctx.strokeStyle 	= color;
		ctx.fillStyle 		= color;
		ctx.lineWidth 		= 0.5;

		// Draw extension lines
		ctx.beginPath();
		ctx.moveTo(ext1Start.x, ext1Start.y);
		ctx.lineTo(ext1End.x, 	ext1End.y);
		ctx.moveTo(ext2Start.x, ext2Start.y);
		ctx.lineTo(ext2End.x, 	ext2End.y);
		ctx.stroke();

		// Calculate direction vector for dimension line (for arrows)
		const dx = dimEnd.x - dimStart.x;
		const dy = dimEnd.y - dimStart.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len < 1) return; // Too small to draw

		const unitX = dx / len;
		const unitY = dy / len;

		// Perpendicular for arrow heads
		const perpX = -unitY;
		const perpY = unitX;

		// Get text dimensions for gap calculation
		ctx.font = '12px Arial';
		const displayText = shape.getDisplayText('', 2);
		const textMetrics = ctx.measureText(displayText);
		const textWidth = textMetrics.width + 8; // Add padding
		const halfTextWidth = textWidth / 2;

		// Calculate gap in dimension line for text
		const gapStart = {
			x: textPos.x - unitX * halfTextWidth,
			y: textPos.y - unitY * halfTextWidth
		};
		const gapEnd = {
			x: textPos.x + unitX * halfTextWidth,
			y: textPos.y + unitY * halfTextWidth
		};

		// Draw dimension line with gap for text
		ctx.beginPath();
		ctx.moveTo(dimStart.x, dimStart.y);
		ctx.lineTo(gapStart.x, gapStart.y);
		ctx.moveTo(gapEnd.x, gapEnd.y);
		ctx.lineTo(dimEnd.x, dimEnd.y);
		ctx.stroke();

		// Draw arrow at start (pointing inward toward text)
		this.drawArrow(ctx, dimStart.x, dimStart.y, unitX, unitY, perpX, perpY, arrowSize);

		// Draw arrow at end (pointing inward toward text)
		this.drawArrow(ctx, dimEnd.x, dimEnd.y, -unitX, -unitY, perpX, perpY, arrowSize);

		// Draw text
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(displayText, textPos.x, textPos.y);

		// Draw control point handles when selected
		if(shape.selected || shape.showControlPoints){
			const handleRadius = 4;
			ctx.lineWidth = 0.5;
			ctx.strokeStyle = '#666666';
			ctx.fillStyle = '#FFFFFF';

			// Start point
			const startPt = this.toScreen(shape.start.x, shape.start.y);
			ctx.beginPath();
			ctx.arc(startPt.x, startPt.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();

			// End point
			const endPt = this.toScreen(shape.end.x, shape.end.y);
			ctx.beginPath();
			ctx.arc(endPt.x, endPt.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();

			// Text/offset handle (diamond)
			ctx.fillStyle = '#FFCC00';
			ctx.beginPath();
			ctx.moveTo(textPos.x, textPos.y - handleRadius);
			ctx.lineTo(textPos.x + handleRadius, textPos.y);
			ctx.lineTo(textPos.x, textPos.y + handleRadius);
			ctx.lineTo(textPos.x - handleRadius, textPos.y);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
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

