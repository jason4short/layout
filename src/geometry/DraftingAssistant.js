const MAX_SNAP_PX = 12; // snap if within 12 screen pixels

import data 			from '../data/Data.js';
import stage 			from '../core/Stage.js';

import {Point} 			from './Point.js';
import {SnapPoint} 		from './SnapPoint.js';			
import {Rectangle} 		from './Rectangle.js';
import {Construction} 	from './Construction.js';
import {Guide} 			from './Guide.js';
import {	Shape, 
			SnapType, 
			GuideType} 	from './Geometry.js';

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
	snap(mouse, generateGuides = true){

		let snap = null;
		
		// turn all guides off
		this.deActivateGuides();
		
		// 1: snap on features of real geometry (endpoints, quadrants, etc...)
		snap = this.findNearestSnapPoint_Geometry(mouse, data.getPOICandidates());
		if(snap){
			// POI type is now embedded in the snap point by each shape's getSnapPOIs()
			snap.label = snap.type ? [snap.type] : [];
			this.setCurrentSnapPoint(snap, generateGuides);
			return;
		}

		// 2, 3: snap on intersections of real geometry and constructions
		snap  = this.findNearestSnapPoint_Geometry(mouse, data.getIntersectionCandidates());
		if(snap){
			snap.label = [SnapType.INTERSECT];
			this.setCurrentSnapPoint(snap, generateGuides);
			return;
		}

		// 4: snap on intersections of guides and geometry
		snap  = this.findNearestSnapPoint_Geometry(mouse, data.getGuideIntersectionCandidates());
		if(snap){
			snap.label = [SnapType.INTERSECT];
			
			if(snap.shapeA && snap.shapeA.type == Shape.GUIDE)
				snap.shapeA.active = true;
			if(snap.shapeB && snap.shapeB.type == Shape.GUIDE)
				snap.shapeB.active = true;
			
			this.setCurrentSnapPoint(snap, false);
			return;
		}

		// 5: snap on real geometry
		snap  = this.findNearestSnapPoint_OnShape(mouse, data.getShapes());
		if(snap){
			snap.label = [SnapType.ON];
			this.setCurrentSnapPoint(snap, false);
			return;
		}

		// 6: snap on guides
		snap  = this.findNearestSnapPoint_OnShape(mouse, data.getGuides());
		if(snap){
			// Activate the guide BEFORE setCurrentSnapPoint so updateSourceSnapPointLabels can see it
			snap.shape.active = true;

			// Cursor shows "on" - the guide relationship label appears on the source snap point
			snap.label = [SnapType.ON];

			this.setCurrentSnapPoint(snap, false);
			return;
		}

		// no snap, just return the mouse
		const noSnap = new SnapPoint(mouse.x, mouse.y);
		noSnap.label = [];
		this.setCurrentSnapPoint(noSnap, false);
	}

	// Convert GuideType to SnapType label for display
	getGuideLabelFromType(guideType){
		switch(guideType){
			case GuideType.VERTICAL:
				return SnapType.ALIGN_X;
				
			case GuideType.HORIZONTAL:
				return SnapType.ALIGN_Y;
				
			case GuideType.DIAGONAL_45:
				return SnapType.ALIGN_45;
				
			case GuideType.DIAGONAL_NEG45:
				return SnapType.ALIGN_NEG45;
				
			case GuideType.TANGENT:
				return SnapType.TANGENT;
				
			case GuideType.PERPENDICULAR:
				return SnapType.PERPENDICULAR;
				
			default:
				return null;
		}
	}


	// tracks the current snapped point
	setCurrentSnapPoint(p, store){
		// Preserve the POI type label before it gets cleared by updateSourceSnapPointLabels
		const poiLabel = p.label;

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

		// Update labels on source snap points based on active guides
		// (source points show guide relationship: align:x, tangent, etc.)
		this.updateSourceSnapPointLabels(data.getGuides());

		// Restore POI type label on current snap point
		// (updateSourceSnapPointLabels clears labels on stored snap points,
		// which includes the current one when store=true)
		if(poiLabel){
			data.snapPoint.label = poiLabel;
		}
	}

	deActivateGuides(){
		for(const guide of data.getGuides()) {
			guide.active = false;
		}
	}
	
	// Update labels on stored snap points based on which of their guides are active
	// Source snap points show guide relationship labels (align:x, tangent, etc.)
	updateSourceSnapPointLabels(guides){
		// Clear labels on all stored snap points
		for(const snapPoint of data.snapPoints){
			snapPoint.label = null;
		}

		// Add relationship labels based on active guides
		for(const guide of guides){
			if(!guide.active) continue;
			if(!guide.sourceSnapPoint) continue;

			// Convert GuideType to SnapType label (e.g., VERTICAL -> "align:x")
			const label = this.getGuideLabelFromType(guide.guideType);
			if(label){
				guide.sourceSnapPoint.label = label;
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
		
	findNearestSnapPoint_OnShape(mouse, geoSet){
		// Shape.getGeoSnap works in shape's local space
		// For shapes in frames, convert mouse to frame-local coords
		const worldTolerance = MAX_SNAP_PX / stage.zoom;

		let closestSnap = null;

		for(const shape of geoSet) {
			// Skip excluded shapes
			if(data.isExcludedFromSnap(shape)){
				continue;
			}

			// Get frame if shape belongs to one
			const frame = shape.frameId ? data.getFrame(shape.frameId) : null;

			// Convert mouse to shape's coordinate space
			let localMouse = mouse;
			let localRect;

			if(frame){
				// Transform mouse to frame-local coords
				const localPt = frame.worldToLocal(mouse.x, mouse.y);
				localMouse = { x: localPt.x, y: localPt.y };
				localRect = new Rectangle(
					localPt.x - worldTolerance,
					localPt.y - worldTolerance,
					worldTolerance * 2,
					worldTolerance * 2
				);
			} else {
				localRect = new Rectangle(
					mouse.x - worldTolerance,
					mouse.y - worldTolerance,
					worldTolerance * 2,
					worldTolerance * 2
				);
			}

			// Get snap in shape's local coords
			let snap = shape.getGeoSnap(localMouse, localRect, worldTolerance);

			if(snap){
				// Transform result back to world coords if needed
				if(frame){
					const worldPt = frame.localToWorld(snap.x, snap.y);
					snap.x = worldPt.x;
					snap.y = worldPt.y;
				}

				// AutoLayoutFrame provides snappable edges but shouldn't be a selectable target
				snap.shape = (shape.geometry === Shape.AUTO_LAYOUT_FRAME) ? null : shape;
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
		// Convert 2000 screen pixels to world units so guides fill the screen at any zoom
		const guideLength = stage.screenToWorldScale(2000);

		// Helper to create guide and link to source
		const addGuide = (params) => {
			const guide = new Guide(params);
			guide.sourceSnapPoint = snapPoint;
			data.addGuide(guide);
		};

		// Vertical guide (align:x)
		addGuide([snapPoint.x, snapPoint.y, 90, guideLength, GuideType.VERTICAL]);

		// Horizontal guide (align:y)
		addGuide([snapPoint.x, snapPoint.y, 0, guideLength, GuideType.HORIZONTAL]);

		// 45° diagonal
		addGuide([snapPoint.x, snapPoint.y, 45, guideLength, GuideType.DIAGONAL_45]);

		// -45° diagonal
		addGuide([snapPoint.x, snapPoint.y, -45, guideLength, GuideType.DIAGONAL_NEG45]);

		// Tangent and perpendicular guides if snap point is on a shape
		if (snapPoint.shape) {
			const tangentAngle = snapPoint.shape.getTangentAngle(snapPoint);
			if(tangentAngle != null){
				addGuide([snapPoint.x, snapPoint.y, tangentAngle, guideLength, GuideType.TANGENT]);
				addGuide([snapPoint.x, snapPoint.y, tangentAngle + 90, guideLength, GuideType.PERPENDICULAR]);
			}
		}
	}


}

const instance = new DraftingAssistant();
//Object.freeze(instance); // Optional: Prevent modifications to the instance
export default instance;

