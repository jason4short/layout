import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape} from '../geometry/Geometry.js';

export class Renderer
{

	constructor()
	{
		this.marqueeRect = null; // Set by PointerTool during drag
		this.zoomRect = null;    // Set by StrokeTool during zoom gesture
	}

	// Helper to convert world point to screen
	toScreen(worldX, worldY) {
		return stage.worldToScreen(worldX, worldY);
	}

	// Helper to convert world distance to screen pixels
	toScreenScale(worldValue) {
		return stage.worldToScreenScale(worldValue);
	}

	draw()
	{
		let ctx = stage.ctx;
		ctx.clearRect(0, 0, stage.canvas.width, stage.canvas.height);

		for(const shape of data.getShapesToRender())
		{
			ctx.beginPath();
			ctx.strokeStyle = shape.selected ? '#FF0000' : (shape.stroke || '#111');
			ctx.lineWidth = 0.5;

			if(shape.geometry === Shape.LINE){
				const start = this.toScreen(shape.start.x, shape.start.y);
				const end = this.toScreen(shape.end.x, shape.end.y);

				if(shape.type === Shape.PLAIN){
					ctx.moveTo(start.x, start.y);
					ctx.lineTo(end.x, end.y);
					ctx.stroke();

				}else if(shape.type === Shape.CONSTRUCTION){
					ctx.setLineDash([1, 4]);
					ctx.strokeStyle = "#B400F5";
					ctx.moveTo(start.x, start.y);
					ctx.lineTo(end.x, end.y);
					ctx.stroke();
					ctx.setLineDash([]);

				} else if(shape.type === Shape.GUIDE && shape.active){
					ctx.setLineDash([1, 4]);
					ctx.strokeStyle = "#ff0000";
					ctx.moveTo(start.x, start.y);
					ctx.lineTo(end.x, end.y);
					ctx.stroke();
					ctx.setLineDash([]);
				}

			} else if(shape.geometry === Shape.CIRCLE){
				const center = this.toScreen(shape.x, shape.y);
				const radius = this.toScreenScale(shape.radius);
				ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
				ctx.stroke();

			} else if(shape.geometry === Shape.ARC){
				const center = this.toScreen(shape.x, shape.y);
				const radius = this.toScreenScale(shape.radius);
				ctx.arc(center.x, center.y, radius, shape.startAngle, shape.endAngle);
				ctx.stroke();

			} else if(shape.geometry === Shape.ELLIPSE){
				const center = this.toScreen(shape.x, shape.y);
				const radiusX = this.toScreenScale(shape.radiusX);
				const radiusY = this.toScreenScale(shape.radiusY);
				ctx.ellipse(center.x, center.y, radiusX, radiusY, shape.rotation, 0, Math.PI * 2);
				ctx.stroke();

			} else if(shape.geometry === Shape.ELLIPTICAL_ARC){
				const center = this.toScreen(shape.x, shape.y);
				const radiusX = this.toScreenScale(shape.radiusX);
				const radiusY = this.toScreenScale(shape.radiusY);
				ctx.ellipse(center.x, center.y, radiusX, radiusY, shape.rotation, shape.startAngle, shape.endAngle);
				ctx.stroke();

			} else if(shape.geometry === Shape.SPLINE){
				const p0 = this.toScreen(shape.p0.x, shape.p0.y);
				const p1 = this.toScreen(shape.p1.x, shape.p1.y);
				const p2 = this.toScreen(shape.p2.x, shape.p2.y);
				const p3 = this.toScreen(shape.p3.x, shape.p3.y);

				// Draw the cubic Bezier curve
				ctx.moveTo(p0.x, p0.y);
				ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
				ctx.stroke();

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
			}
		}

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
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 3]);
		ctx.strokeRect(topLeft.x, topLeft.y, width, height);
		ctx.setLineDash([]);

		// Semi-transparent orange fill
		ctx.fillStyle = 'rgba(255, 102, 0, 0.1)';
		ctx.fillRect(topLeft.x, topLeft.y, width, height);
	}


	getBounds(){

		return new Rectangle()
	}

}

