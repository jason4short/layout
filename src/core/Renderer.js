import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape} from '../geometry/Geometry.js';

export class Renderer
{
	// private members

	constructor()
	{
		this.marqueeRect = null; // Set by PointerTool during drag
	}



//data
	draw()
	{
		let ctx = stage.ctx;
		ctx.clearRect(0, 0, stage.canvas.width, stage.canvas.height);
		
		// force override?
        //throw new Error("Method 'draw()' must be implemented.");
    	
		for(const shape of data.getShapesToRender())
		{
			ctx.beginPath();
			//ctx.strokeStyle = shape.selected ? '#2b6cb0' : (shape.stroke || '#111');
			ctx.strokeStyle = shape.selected ? '#FF0000' : (shape.stroke || '#111');
			ctx.lineWidth = .5; //(shape.strokeWidth ?? 1) / (state.view.scale * dpr);

			if(shape.geometry === Shape.LINE){
			
				if(shape.type === Shape.PLAIN){
					ctx.moveTo(shape.start.x, shape.start.y);
					ctx.lineTo(shape.end.x, shape.end.y);
					ctx.stroke();
					
				}else if(shape.type === Shape.CONSTRUCTION){
					ctx.setLineDash([1, 4]); // 4px dash, 4px gap
					ctx.strokeStyle = "#B400F5";   // pale blue hex
					ctx.moveTo(shape.start.x, shape.start.y);
					ctx.lineTo(shape.end.x, shape.end.y);
					ctx.stroke();
					ctx.setLineDash([]); // 4px dash, 4px gap
					
				} else if(shape.type === Shape.GUIDE && shape.active){
					ctx.setLineDash([1, 4]); // 4px dash, 4px gap
					ctx.strokeStyle = "#ff0000";   // pale blue hex
					ctx.moveTo(shape.start.x, shape.start.y);
					ctx.lineTo(shape.end.x, shape.end.y);
					ctx.stroke();
					ctx.setLineDash([]); // 4px dash, 4px gap
				}
				
			} else if(shape.geometry === Shape.CIRCLE){
				ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
				ctx.stroke();

			} else if(shape.geometry === Shape.ARC){
				ctx.arc(shape.x, shape.y, shape.radius, shape.startAngle, shape.endAngle);
				ctx.stroke();

			} else if(shape.geometry === Shape.ELLIPSE){
				ctx.ellipse(shape.x, shape.y, shape.radiusX, shape.radiusY, shape.rotation, 0, Math.PI * 2);
				ctx.stroke();

			} else if(shape.geometry === Shape.ELLIPTICAL_ARC){
				ctx.ellipse(shape.x, shape.y, shape.radiusX, shape.radiusY, shape.rotation, shape.startAngle, shape.endAngle);
				ctx.stroke();

			} else if(shape.geometry === Shape.SPLINE){
				// Draw the cubic Bezier curve
				//ctx.beginPath();
				//ctx.strokeStyle = shape.selected ? '#FF0000' : '#2563eb';  // Blue spline
				//ctx.lineWidth = 1.5;
				ctx.moveTo(shape.p0.x, shape.p0.y);
				ctx.bezierCurveTo(
					shape.p1.x, shape.p1.y,
					shape.p2.x, shape.p2.y,
					shape.p3.x, shape.p3.y
				);
				ctx.stroke();

				// Only draw control points if toggled on or selected
				if(shape.showControlPoints || shape.selected){
					// Draw control polygon (gray lines)
					ctx.beginPath();
					ctx.strokeStyle = '#AAAAAA';
					ctx.lineWidth = 0.5;
					ctx.setLineDash([2, 2]);
					ctx.moveTo(shape.p0.x, shape.p0.y);
					ctx.lineTo(shape.p1.x, shape.p1.y);
					ctx.lineTo(shape.p2.x, shape.p2.y);
					ctx.lineTo(shape.p3.x, shape.p3.y);
					ctx.stroke();
					ctx.setLineDash([]);

					// Draw control point handles (circles)
					ctx.lineWidth = 0.5;
					ctx.strokeStyle = '#666666';
					ctx.fillStyle = '#FFFFFF';
					const handleRadius = 4;

					// p0 - start
					ctx.beginPath();
					ctx.arc(shape.p0.x, shape.p0.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();

					// p1 - handle 1
					ctx.beginPath();
					ctx.arc(shape.p1.x, shape.p1.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();

					// p2 - handle 2
					ctx.beginPath();
					ctx.arc(shape.p2.x, shape.p2.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();

					// p3 - end
					ctx.beginPath();
					ctx.arc(shape.p3.x, shape.p3.y, handleRadius, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();
				}
			}
		}
		
// 		for(const intersection of data.getIntersections()) // ... combines the arrays // getGuidesToRender
// 		{
// 			ctx.beginPath();
// 			ctx.strokeStyle = '#2b6cb0';
// 			ctx.lineWidth = .5; //(shape.strokeWidth ?? 1) / (state.view.scale * dpr);
// 			ctx.arc(intersection.x, intersection.y, 2, 0, Math.PI * 2);
// 			ctx.stroke();
// 		}

		for(const intersection of data.snapPoints) // ... combines the arrays // getGuidesToRender
		{
			ctx.beginPath();
			ctx.strokeStyle = '#2b6cb0';
			ctx.lineWidth = .5; //(shape.strokeWidth ?? 1) / (state.view.scale * dpr);
			ctx.arc(intersection.x, intersection.y, 2, 0, Math.PI * 2);
			ctx.stroke();
		}
		
		
		// draw snap point
		const s = data.snapPoint;

		ctx.strokeStyle = '#000';
		ctx.beginPath();ctx.moveTo(s.x+3, s.y+3); ctx.lineTo(s.x-3, s.y-3); ctx.stroke();
		ctx.beginPath();ctx.moveTo(s.x-3, s.y+3); ctx.lineTo(s.x+3, s.y-3); ctx.stroke();

		// Draw selected control points
		this.drawSelectedControlPoints(ctx);

		// Draw marquee selection box
		this.drawMarquee(ctx);
	}

	drawSelectedControlPoints(ctx){
		const selectedPoints = data.getSelectedPoints();

		for(const [shape, indices] of selectedPoints.entries()){
			const pois = shape.getSnapPOIs();

			for(const index of indices){
				const poi = pois[index];
				if(!poi) continue;

				// Draw filled square for selected control point
				ctx.fillStyle = '#FF0000';
				ctx.strokeStyle = '#000000';
				ctx.lineWidth = 0.5;

				const size = 2; // Half-size of square
				ctx.fillRect(poi.x - size, poi.y - size, size * 2, size * 2);
				ctx.strokeRect(poi.x - size, poi.y - size, size * 2, size * 2);
			}
		}
	}

	drawMarquee(ctx){
		if(!this.marqueeRect) return;

		const r = this.marqueeRect;

		// Dashed blue outline
		ctx.strokeStyle = '#0066CC';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		ctx.strokeRect(r.x, r.y, r.width, r.height);
		ctx.setLineDash([]);

		// Semi-transparent fill
		ctx.fillStyle = 'rgba(0, 102, 204, 0.1)';
		ctx.fillRect(r.x, r.y, r.width, r.height);
	}

	
	getBounds(){
	
		return new Rectangle()
	}
	

}

