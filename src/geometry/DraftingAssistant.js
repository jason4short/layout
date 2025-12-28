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
	
	
	// seek - find the nearest relevant snap instance
	snap(mouse)
	{
		let snap 	= false;
		
		this.activateGuides(mouse, data.getGuides());
		
		// P1 - special geometry features - endpoints, centerpoints, mid points, etc...
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getPOICandidates());		
		if(snap){
			data.setCurrentSnapPoint(snap, true);
			return;
		}
		
		// P2 - special geometry features - endpoints, centerpoints, mid points, etc...
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getIntersectionCandidates());		
		if(snap){
			data.setCurrentSnapPoint(snap, true);
			return;
		}

		// P3 - on geometry itself - 
		snap = this.findNearestSnapPoint_OnShape(mouse, [...data.shapes, ...data.constructions]);

		// P4 - on guides
		if(!snap){
			snap = this.findNearestSnapPoint_OnShape(mouse, data.guides);
		}

		if(snap){
			data.setCurrentSnapPoint(snap, false);

		}else{
			// no snap, just return the mouse
			// XXX send null
			data.setCurrentSnapPoint(new SnapPoint(mouse.x, mouse.y));
		}
	}


	findNearestSnapPoint_Geometry(mouse, candidates){
		for(const point of candidates){
			const d = this.getDistance(mouse, point, MAX_SNAP_PX);

			// find the first POI within range
			// we exit immediately
			if(d < MAX_SNAP_PX){
// 				if(point.type === Shape.GUIDE){
// 					snap = shape.getGeoSnap(mouse, mouseRect, MAX_SNAP_PX);
// 					shape.active = (snap != null);
// 				}
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
			let snap = shape.getGeoSnap(mouse, mouseRect, MAX_SNAP_PX);

			if(snap){
				snap.shape = shape;
				if(!closestSnap) {
					closestSnap = snap;
					//data.selectedShape = shape;
				}else if(snap.distance < closestSnap.distance){
					closestSnap = snap;
					//data.selectedShape = shape;
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
		
		// XXX
		// angle 45

		// angle -45
	  
	}


	// store the snap points and create guide geometry
	// snaps is a hash of keys and points
	createGuidesXXX(snaps, key, point, limit = 4)
	{
		// XXX replace snaps with a ring buffer? 

		// only new snap points
		if (!snaps.has(key)) { 
		
			snaps.set(key, point);
			
			if (snaps.size > limit){
				// XXX does this really work? 
				const firstKey = snaps.keys().next().value;
				snaps.delete(firstKey);
			}
	
			// XXX we reset guides for now when a point gets reset
			data.clearGuides();

			// create guide geometry
			for (const point of snaps.values()) {
				//console.log(point);

				// vert
				data.addGuide(new Guide([point.x, point.y, 90]));
				
				// horz
				data.addGuide(new Guide([point.x, point.y, 0]));
				
				// XXX
				// angle 45

				// angle -45
			  
			}
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

