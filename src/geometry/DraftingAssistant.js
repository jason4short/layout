const MAX_SNAP_PX = 20; // intersections only snap if within 12px on screen

import data 			from '../data/Data.js';

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
	
	// seek the nearest relevant snap point
	snap(mouse, generateGuides = true)
	{
		let snap = null;
		// are we on a guide? - clean up later with a test of active guides
		this.activateGuides(mouse, data.getGuides());

		// 1: snap on features of real geometry (endpoints, quadrants, etc...)
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getPOICandidates());
		if(snap){
			data.setCurrentSnapPoint(snap, generateGuides); // store snap point as a DA Snap
			return;
		}

		// 2, 3: snap on intersections of real geometry and constructions
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getIntersectionCandidates());
		if(snap){
			data.setCurrentSnapPoint(snap, generateGuides); // store snap point as a DA Snap
			return;
		}

		// 4: snap on intersections of guides and geometry
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getGuideIntersectionCandidates());
		if(snap){
			data.setCurrentSnapPoint(snap, false); // do not store snap point as a DA Snap
			return;
		}

		// 5: snap on real geometry
		snap = this.findNearestSnapPoint_OnShape(mouse, data.getShapes());
		if(snap){
			data.setCurrentSnapPoint(snap, false); // do not store snap point as a DA Snap
			return;
		}

		// 6: snap on guides
		snap = this.findNearestSnapPoint_OnShape(mouse, data.getGuides());
		if(snap){
			data.setCurrentSnapPoint(snap, false); // do not store snap point as a DA Snap
			return;
		}

		// no snap, just return the mouse
		data.setCurrentSnapPoint(new SnapPoint(mouse.x, mouse.y));
	}
	
	findNearestSnapPoint_Geometry(mouse, candidates){
		for(const point of candidates){
			// Skip points belonging to excluded shapes
			if(point.shape && data.isExcludedFromSnap(point.shape)){
				continue;
			}

			const d = this.getDistance(mouse, point, MAX_SNAP_PX);

			// find the first POI within range
			// we exit immediately
			if(d < MAX_SNAP_PX){
				return point
			}
		}
		return false;
	}

	activateGuides(mouse, geoSet){
		const mouseRect = new Rectangle(mouse.x-10, mouse.y-10, 20, 20);

		for(const shape of geoSet) {
			let snap = shape.getGeoSnap(mouse, mouseRect, MAX_SNAP_PX);
			shape.active = (snap != null);
		}
	}

	findNearestSnapPoint_OnShape(mouse, geoSet){
		let closestSnap = null;
		const mouseRect = new Rectangle(mouse.x-10, mouse.y-10, 20, 20);

		for(const shape of geoSet) {
			// Skip excluded shapes
			if(data.isExcludedFromSnap(shape)){
				continue;
			}

			let snap = shape.getGeoSnap(mouse, mouseRect, MAX_SNAP_PX);

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
		// vert
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, 90]));

		// horz
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, 0]));

		// 45°
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, 45]));

		// -45°
		data.addGuide(new Guide([snapPoint.x, snapPoint.y, -45]));

		// Tangent and perpendicular guides if snap point is on a shape
		if (snapPoint.shape && typeof snapPoint.shape.getTangentAngle === 'function') {
			const tangentAngle = snapPoint.shape.getTangentAngle(snapPoint);
			data.addGuide(new Guide([snapPoint.x, snapPoint.y, tangentAngle]));
			// Perpendicular to tangent (normal)
			data.addGuide(new Guide([snapPoint.x, snapPoint.y, tangentAngle + 90]));
		}
	}



	getDistance(a, b, min)
	{
		const dx = b.x - a.x;
		if(dx > min)
			return min+1;

		const dy = b.y - a.y;		
		if(dy > min)
			return min+1;

		return Math.sqrt(dx * dx + dy * dy);
	}
}

const instance = new DraftingAssistant();
//Object.freeze(instance); // Optional: Prevent modifications to the instance
export default instance;

