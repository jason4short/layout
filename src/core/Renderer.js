import stage from './Stage.js';
import data from '../data/Data.js';
import {Shape} from '../geometry/Geometry.js';

export class Renderer
{
	// private members

	constructor()
	{
		
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

	}

	
	getBounds(){
	
		return new Rectangle()
	}
	

}

