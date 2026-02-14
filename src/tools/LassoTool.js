import { PointerTool } from './PointerTool.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class LassoTool extends PointerTool
{
	constructor()
	{
		super();

		this.name = "Lasso";
		this.usage = "Drag to lasso select. Click to select. Drag shape to move.";
		this.lassoPoints = [];
	}

	updateCursor(){
		stage.setCursor('crosshair');
	}

	onMouseDown(e){
		if(stage.shiftKey){
			// Shift = additive lasso. Skip PointerTool's click-selection logic
			// which clears partial point selections when clicking unselected shapes.
			data.resetSnaps();
			this.dragStart = {x: e.x, y: e.y, screenX: e.screenX, screenY: e.screenY};
			this.isDragging = false;
			this.isMoving = false;
			this.moveTarget = null;
			return;
		}

		super.onMouseDown(e);
	}

	onMouseMove(e){
		if(!this.dragStart) return;

		// Let super handle move, label drag, group resize, and threshold detection
		super.onMouseMove(e);

		// If super started a marquee drag, replace with lasso behavior
		if(this.isDragging){
			// Clear the rectangle marquee that super may have set
			this.marqueeRect = null;
			stage.renderer.marqueeRect = null;

			// Collect lasso points in world coords
			this.lassoPoints.push({x: e.x, y: e.y});
			stage.renderer.lassoPolygon = this.lassoPoints;
			stage.render();
		}
	}

	onMouseUp(e){
		// If finishing a lasso drag, handle selection ourselves
		if(this.isDragging && this.lassoPoints.length > 2){
			data.selectByLasso(this.lassoPoints, stage.shiftKey);
			this.resetDrag();
			stage.render();
			return;
		}

		// All other paths (move, clone, label, resize, click) handled by super
		super.onMouseUp(e);
	}

	resetDrag(){
		super.resetDrag();
		this.lassoPoints = [];
		stage.renderer.lassoPolygon = null;
	}
}
