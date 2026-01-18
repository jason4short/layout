const MAX_SNAP_PX = 12; // snap if within 20 screen pixels

import data 			from '../data/Data.js';
import stage 			from '../core/Stage.js';

import {Point} 			from './Point.js';
import {SnapPoint} 		from './SnapPoint.js';
import {Shape} 			from './Geometry.js';
import {Rectangle} 		from './Rectangle.js';
import {Construction} 	from './Construction.js';
import {Guide} 			from './Guide.js';

// const pixelTolerance = 8;					// e.g., 8px snap radius
// const worldUnitsPerPixel = view.scale;		// however you represent world<->screen scale
// const cursorWorldPoint = { x: worldX, y: worldY };


// tracks the last N number of snap points

class DraftingAssistant
{
	constructor(){
        if (!DraftingAssistant.instance) {
            DraftingAssistant.instance = this;
        }
	}
	  // In Renderer.draw(), temporarily add:

	// seek the nearest relevant snap point
	snap(mouse, generateGuides = true){
	
		let snap = null;
	
		// are we on a guide? - clean up later with a test of active guides
		//this.activateGuides(mouse, data.getGuides());

		// 1: snap on features of real geometry (endpoints, quadrants, etc...)
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getPOICandidates());
		if(snap){
			//console.log("POI "+snap);
			this.setCurrentSnapPoint(snap, generateGuides); // store snap point as a DA Snap
			return;
		}

		// 2, 3: snap on intersections of real geometry and constructions
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getIntersectionCandidates());
		if(snap){
			//console.log("IXD "+snap);
			this.setCurrentSnapPoint(snap, generateGuides); // store snap point as a DA Snap
			return;
		}

		// 4: snap on intersections of guides and geometry
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getGuideIntersectionCandidates());
		if(snap){
			//console.log("Guide IX "+snap);
			this.setCurrentSnapPoint(snap, false); // do not store snap point as a DA Snap
			return;
		}

		// 5: snap on real geometry
		snap = this.findNearestSnapPoint_OnShape(mouse, data.getShapes());
		if(snap){
			//console.log("on"+snap);
			this.setCurrentSnapPoint(snap, false); // do not store snap point as a DA Snap
			return;
		}

		// 6: snap on guides
		snap = this.findNearestSnapPoint_OnShape(mouse, data.getGuides());
		if(snap){
			//console.log("on G"+snap);
			this.setCurrentSnapPoint(snap, false); // do not store snap point as a DA Snap
			return;
		}

		// no snap, just return the mouse
		// Floor to integers to reduce duplicate snap point calculations
		this.setCurrentSnapPoint(new SnapPoint(mouse.x, mouse.y), false);
// 		this.setCurrentSnapPoint(new SnapPoint(Math.floor(mouse.x), Math.floor(mouse.y)), false);	
	}
	
	// tracks the current snapped point
	setCurrentSnapPoint(p, store){ 
		data.snapPoint = p;

		if(store){
			data.addSnapPoint(p);
			// generate DA guides for each point 
			// XXX - could be optimized but there aren't many guides?
			// points with guides could be skipped
			data.clearGuides();
			for(const snapPoint of data.snapPoints){
				this.createGuides(snapPoint);
			}
		}
	}
	
	getCurrentSnapPoint(){ 
		return data.snapPoint;
	}
		
	findNearestSnapPoint_Geometry(mouse, candidates){
		// Compare in screen space using screen pixel tolerance
		const screenMouse = { x: mouse.screenX, y: mouse.screenY };

		for(const point of candidates){
			// Skip points belonging to excluded shapes
			// Handle both POIs (single shape) and Intersections (two shapes)

			// XXX this is neat, but maybe too much?
			// consider a flag on the shapes to allow DA interaction
			///*
			if(point.shapes){
				// Intersection object - skip if either shape is excluded
				if(point.shapes.some(s => data.isExcludedFromSnap(s))){
					continue;
				}
			} else if(point.shape && data.isExcludedFromSnap(point.shape)){
				continue;
			}


// 			if(point.sourceShapes.some(shape => data.isExcludedFromSnap(shape))){
// 				continue;
// 			}			
			//*/
			
// 			if(point.shapes){
// 				continue;
// 			}
// 			
// 			if(point.shapes && point.shapes.selected){
// 				continue;
// 			}
			
			// Convert POI to screen space for comparison
			const screenPOI = stage.worldToScreen(point.x, point.y);

			// Chebyshev distance
			const d = Math.max(Math.abs(screenMouse.x - screenPOI.x), Math.abs(screenMouse.y - screenPOI.y));

			// find the first POI within range
			// we exit immediately, returning the world-space point
			if(d < MAX_SNAP_PX){
				return point;
			}
		}
		return false;
	}
		
	activateGuides(mouse, geoSet){
		// Shape.getGeoSnap works in world space, so convert screen tolerance to world
		const worldTolerance = MAX_SNAP_PX / stage.zoom;
		
		const mouseRect = new Rectangle(
			mouse.x - worldTolerance,
			mouse.y - worldTolerance,
			worldTolerance * 2,
			worldTolerance * 2
		);

		for(const shape of geoSet) {
			let snap = shape.getGeoSnap(mouse, mouseRect, worldTolerance);
			shape.active = (snap != null);
		}
	}

	findNearestSnapPoint_OnShape(mouse, geoSet){
		// Shape.getGeoSnap works in world space, so convert screen tolerance to world
		const worldTolerance = MAX_SNAP_PX / stage.zoom;
		
		const mouseRect = new Rectangle(
			mouse.x - worldTolerance,
			mouse.y - worldTolerance,
			worldTolerance * 2,
			worldTolerance * 2
		);

		let closestSnap = null;

		for(const shape of geoSet) {
			// Skip excluded shapes
			if(data.isExcludedFromSnap(shape)){
				continue;
			}

			let snap = shape.getGeoSnap(mouse, mouseRect, worldTolerance);

			if(snap){
				snap.shape = shape;
				if(!closestSnap) {
					closestSnap = snap;
				}else if(snap.distance < closestSnap.distance){
					closestSnap = snap;
				}
			}
		}
		return closestSnap;
	}


	// store the snap points and create guide geometry
	// snaps is a hash of keys and points
	createGuides(snapPoint)
	{
// 		return;
		
		const screenLength = stage.worldToScreenScale(1000);
		
		// vert
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, 90, screenLength]));

		// horz
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, 0, screenLength]));

		// 45°
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, 45, screenLength]));

		// -45°
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, -45, screenLength]));

		// Tangent and perpendicular guides if snap point is on a shape
		if (snapPoint.shape && typeof snapPoint.shape.getTangentAngle === 'function') {
		
			const tangentAngle = snapPoint.shape.getTangentAngle(snapPoint);
			data.addGuide(new Guide([snapPoint.x, snapPoint.y, tangentAngle]));

			// Perpendicular to tangent (normal)
			data.addGuide(new Guide([snapPoint.x, snapPoint.y, tangentAngle + 90]));
		}
	}

}

const instance = new DraftingAssistant();
//Object.freeze(instance); // Optional: Prevent modifications to the instance
export default instance;

