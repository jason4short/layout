import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape, PenStyle} from '../geometry/Geometry.js';
import toolManager from '../tools/ToolManager.js';

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

			if(shape.geometry === Shape.LINE){
				let start 	= this.toScreen(shape.start.x, shape.start.y);
				let end 	= this.toScreen(shape.end.x, shape.end.y);

				// Clip line to viewport (important for dashed lines performance)
				const clipped = this.clipLineToViewport(start, end);
				if(clipped){
					ctx.moveTo(clipped.x1, clipped.y1);
					ctx.lineTo(clipped.x2, clipped.y2);
					ctx.stroke();
				}
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.CIRCLE){
				const center 	= this.toScreen(shape.x, shape.y);
				const radius 	= this.toScreenScale(shape.radius);

				// Optimization: when radius is huge, only draw visible arc
				if(radius > 2000){
					const angles = this.getVisibleArcAngles(center, radius);
					if(angles){
						ctx.arc(center.x, center.y, radius, angles.start, angles.end);
					}
				} else {
					ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
				}
				ctx.stroke();
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.ARC){
				const center 	= this.toScreen(shape.x, shape.y);
				const radius 	= this.toScreenScale(shape.radius);

				// Optimization: when radius is huge, clip to visible portion
				if(radius > 2000){
					const visible = this.getVisibleArcAngles(center, radius);
					if(visible){
						const clampedStart = Math.max(shape.startAngle, visible.start);
						const clampedEnd = Math.min(shape.endAngle, visible.end);
						if(clampedEnd > clampedStart){
							ctx.arc(center.x, center.y, radius, clampedStart, clampedEnd);
						}
					}
				} else {
					ctx.arc(center.x, center.y, radius, shape.startAngle, shape.endAngle);
				}
				ctx.stroke();
				this.resetPenStyle(ctx);

			} else if(shape.geometry === Shape.TANGENT_ARC){
				const center 	= this.toScreen(shape.x, shape.y);
				const radius 	= this.toScreenScale(shape.radius);

				// Optimization: when radius is huge, clip to visible portion
// 				if(radius > 2000){
// 					const visible = this.getVisibleArcAngles(center, radius);
// 					if(visible){
// 						const clampedStart = Math.max(shape.startAngle, visible.start);
// 						const clampedEnd = Math.min(shape.endAngle, visible.end);
// 						if(clampedEnd > clampedStart){
// 							ctx.arc(center.x, center.y, radius, clampedStart, clampedEnd);
// 						}
// 					}
// 				} else {
					ctx.arc(center.x, center.y, radius, shape.startAngle, shape.endAngle);
// 				}
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

			} else if(shape.geometry === Shape.TEXT){
				this.drawText(ctx, shape);
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

	drawText(ctx, shape){
		const color = '#111111'; // Text stays black even when selected

		// Convert position to screen coordinates
		const screenPos = this.toScreen(shape.x, shape.y);

		// Scale font size with zoom for world-space text
		const screenFontSize = shape.fontSize * stage.zoom;

		// Build font string
		const fontStyle = shape.fontStyle === 'italic' ? 'italic' : '';
		const fontWeight = shape.fontWeight === 'bold' ? 'bold' : '';
		ctx.font = `${fontStyle} ${fontWeight} ${screenFontSize}px ${shape.fontFamily}`.trim();
		ctx.fillStyle = color;
		ctx.textAlign = 'left'; // Always left for cursor positioning
		ctx.textBaseline = 'top';

		// Handle rotation
		if(shape.rotation !== 0){
			ctx.save();
			ctx.translate(screenPos.x, screenPos.y);
			ctx.rotate(shape.rotation);
			this.drawTextContent(ctx, shape, 0, 0, screenFontSize);
			ctx.restore();
		} else {
			this.drawTextContent(ctx, shape, screenPos.x, screenPos.y, screenFontSize);
		}

		// Draw cursor and selection if this text is being edited
		const cursorInfo = toolManager.textTool?.getCursorInfo?.();
		if(cursorInfo && cursorInfo.text === shape){
			// Draw selection highlight first (behind cursor)
			if(cursorInfo.selectionStart !== undefined){
				this.drawTextSelection(ctx, shape, screenPos, screenFontSize, cursorInfo.selectionStart, cursorInfo.selectionEnd);
			}
			// Draw cursor
			if(cursorInfo.cursorVisible){
				this.drawTextCursor(ctx, shape, screenPos, screenFontSize, cursorInfo.position);
			}
		}

		// Draw bounding box when selected
		if(shape.selected || shape.showControlPoints){
			this.drawTextBounds(ctx, shape, screenPos, screenFontSize);
		}
	}

	drawTextContent(ctx, shape, x, y, fontSize){
		const lineHeight = fontSize * 1.2;
		const lines = shape.text.split('\n');

		// Calculate bounding width in screen space
		const screenBoxWidth = shape.boxWidth ? shape.boxWidth * stage.zoom : null;

		for(let i = 0; i < lines.length; i++){
			let line = lines[i];

			// Word wrap if bounding box is set
			if(screenBoxWidth){
				const words = line.split(' ');
				let currentLine = '';

				for(const word of words){
					const testLine = currentLine ? currentLine + ' ' + word : word;
					const metrics = ctx.measureText(testLine);

					if(metrics.width > screenBoxWidth && currentLine){
						ctx.fillText(currentLine, x, y);
						y += lineHeight;
						currentLine = word;
					} else {
						currentLine = testLine;
					}
				}
				if(currentLine){
					ctx.fillText(currentLine, x, y);
					y += lineHeight;
				}
			} else {
				ctx.fillText(line, x, y);
				y += lineHeight;
			}
		}
	}

	drawTextBounds(ctx, shape, screenPos, fontSize){
		// Calculate bounds in screen space
		let screenWidth = shape.textWidth * stage.zoom;
		let screenHeight = shape.textHeight * stage.zoom;

		// Measure actual text if needed
		const lines = shape.text.split('\n');
		let maxWidth = 0;
		for(const line of lines){
			const metrics = ctx.measureText(line);
			maxWidth = Math.max(maxWidth, metrics.width);
		}
		if(!shape.boxWidth) screenWidth = maxWidth;
		if(!shape.boxHeight) screenHeight = lines.length * fontSize * 1.2;

		// Calculate left edge based on alignment
		let left = screenPos.x;
		if(shape.alignment === 'center') left = screenPos.x - screenWidth / 2;
		else if(shape.alignment === 'right') left = screenPos.x - screenWidth;

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
		for(const corner of corners){
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

	drawTextCursor(ctx, shape, screenPos, fontSize, cursorPos){
		// Calculate cursor X position by measuring text up to cursor
		const textBeforeCursor = shape.text.slice(0, cursorPos);
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

	drawTextSelection(ctx, shape, screenPos, fontSize, selStart, selEnd){
		const lineHeight = fontSize * 1.2;
		const allLines = shape.text.split('\n');

		// Find line and column for start and end positions
		const getLineCol = (pos) => {
			let charCount = 0;
			for(let i = 0; i < allLines.length; i++){
				const lineLen = allLines[i].length;
				if(pos <= charCount + lineLen){
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
		for(const line of allLines){
			const w = ctx.measureText(line).width;
			if(w > maxTextWidth) maxTextWidth = w;
		}
		// Use box width if set, otherwise use measured width + small padding
		const selectionEdge = shape.boxWidth
			? shape.boxWidth * stage.zoom
			: maxTextWidth + fontSize * 0.5;

		ctx.fillStyle = 'rgba(66, 133, 244, 0.3)'; // Light blue selection highlight

		for(let lineIdx = startLC.line; lineIdx <= endLC.line; lineIdx++){
			const line = allLines[lineIdx];
			const lineY = screenPos.y + (lineIdx * lineHeight);

			// Calculate start X for this line's selection
			let startCol = 0;
			if(lineIdx === startLC.line){
				startCol = startLC.col;
			}

			// Measure start position
			const startX = screenPos.x + ctx.measureText(line.slice(0, startCol)).width;

			// Calculate end X - extend to edge if not the last selected line
			let endX;
			if(lineIdx === endLC.line){
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

	getBounds(){

		return new Rectangle()
	}

}

