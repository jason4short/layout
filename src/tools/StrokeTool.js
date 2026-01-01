import {Shape} 			from '../geometry/Geometry.js';
import {Tool} 			from "./Tool.js";
import {Line} 			from '../geometry/Line.js';
import {Circle} 		from '../geometry/Circle.js';
import {Construction} 	from '../geometry/Construction.js';
import {Rectangle} 		from '../geometry/Rectangle.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';

// Direction encoding:
// 0 = right (E), 1 = upRight (NE), 2 = up (N), 3 = upLeft (NW)
// 4 = left (W), 5 = downLeft (SW), 6 = down (S), 7 = downRight (SE)

export class StrokeTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Gesture";
		this.usage 	= "Draw gestures to create construction lines or trigger commands.";
		this.cursor = "cursor_gesture";

		this.generateGuides 	= false;
		this.active 			= false;
		this.drawing 			= false;
		this.line 				= null;
		this.gestures			= [];

		// Tunable thresholds
		this.segmentThreshold	= 100;  // pixels before registering a gesture segment
		this.directionTolerance	= 2;    // minimum sector difference to register change

		// Gesture registry: gesture string -> action function
		this.gestureActions = {
			// Single direction gestures
			'2':   () => this.createConstruction(90),      // up = vertical
			'6':   () => this.createConstruction(90),      // down = vertical
			'0':   () => this.createConstruction(0),       // right = horizontal
			'4':   () => this.createConstruction(0),       // left = horizontal
			'3':   () => stage.popView(),                  // upLeft = zoom out
			'7':   () => this.zoomToBox(),                 // downRight = zoom box
			'1':   () => data.deleteConstructions(),       // upRight = clear constructions
			'5':   () => toolManager.setTool(toolManager.pointerTool), // downLeft = pointer

			// Compound gestures (add more as needed)
			'26':  () => this.createVerticalLine(),        // up-down = vertical line
			'62':  () => this.createVerticalLine(),        // down-up = vertical line
			'04':  () => this.createHorizontalLine(),      // right-left = horizontal line
			'40':  () => this.createHorizontalLine(),      // left-right = horizontal line
			'262': () => this.createCircleAtStart(),       // up-down-up = circle
			'626': () => this.createCircleAtStart(),       // down-up-down = circle
		};

		// Cache sorted keys for longest-match-first lookup
		this.sortedGestureKeys = Object.keys(this.gestureActions)
			.sort((a, b) => b.length - a.length);

		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}


	activate(){
		data.resetSnaps();		
		this.active 		= true;
// 		console.log("begin Stroke Tool");
// 		toolManager.addEventListener('mouseUp', 		this.onMouseUp);
// 		toolManager.addEventListener('mouseMove', 	this.onMouseMove);
// 		toolManager.addEventListener('mouseDown', 	this.onMouseDown);
	}

	deactivate(){
// 		console.log("exit Stroke Tool");
		this.active 		= false;
// 		toolManager.removeEventListener('mouseUp', 	this.onMouseUp);
// 		toolManager.removeEventListener('mouseMove', 	this.onMouseMove);
// 		toolManager.removeEventListener('mouseDown', 	this.onMouseDown);
	}
	reset(){
		this.gestures = [];
	}


	onMouseDown(e)
	{
		this.line = new Line([data.snapPoint.x, data.snapPoint.y, data.snapPoint.x, data.snapPoint.y]);
		// Store original start point for gesture actions
		this.originalStartPt = {x: data.snapPoint.x, y: data.snapPoint.y};
	}
	
	
	onMouseMove(e){
		if(this.line){
			this.line.end.x = e.x;
			this.line.end.y = e.y;

			if(this.line.length() > this.segmentThreshold)
			{
				const angleDeg = this.line.getAngleDeg();
				const newDirection = this.determineGestureFromAngle(angleDeg);
				const lastDirection = this.gestures[this.gestures.length - 1];

				// Hysteresis: only register change if direction differs significantly
				if(lastDirection === undefined){
					// First gesture segment
					this.gestures.push(newDirection);
					console.log("gesture: " + this.gestures.join(''));
				} else {
					// Check sector distance (with wrap-around for 0-7)
					const diff = Math.abs(newDirection - lastDirection);
					const sectorDiff = Math.min(diff, 8 - diff);

					if(sectorDiff >= this.directionTolerance){
						this.gestures.push(newDirection);
						console.log("gesture: " + this.gestures.join(''));
					}
				}

				// Reset line start to current position for next segment
				this.line.start.x = e.x;
				this.line.start.y = e.y;
			}

			// Show zoom box preview (from original start to current position)
			const x 		= Math.min(this.originalStartPt.x, this.line.end.x);
			const y 		= Math.min(this.originalStartPt.y, this.line.end.y);
			const width 	= Math.abs(this.line.end.x - this.originalStartPt.x);
			const height 	= Math.abs(this.line.end.y - this.originalStartPt.y);

			stage.renderer.zoomRect = new Rectangle(x, y, width, height);
			stage.render();
		}
	}

	onMouseUp(e){
		if(this.line){
			this.line.end.x = e.x;
			this.line.end.y = e.y;

			// Store line endpoints for gesture actions that need them
			this.gestureStartPt = {x: this.line.start.x, y: this.line.start.y};
			this.gestureEndPt = {x: this.line.end.x, y: this.line.end.y};

			const gesture = this.gestures.join('');
			console.log("final gesture: " + gesture);

			// Execute gesture using registry (longest match first)
			this.executeGesture(gesture);

			this.line = false;
			stage.renderer.zoomRect = null;
		}
		stage.render();
		this.reset();
	}

	// Execute gesture using registry with longest-match-first lookup
	executeGesture(gesture){
		if(!gesture) return false;

		// Try longest matches first
		for(const key of this.sortedGestureKeys){
			if(gesture === key || gesture.endsWith(key)){
				console.log("matched gesture: " + key);
				this.gestureActions[key]();
				return true;
			}
		}

		console.log("no gesture match for: " + gesture);
		return false;
	}

	// ---- Gesture Action Methods ----

	createConstruction(angle){
		data.addConstruction(new Construction([this.originalStartPt.x, this.originalStartPt.y, angle]));
	}

	zoomToBox(){
		const x = Math.min(this.originalStartPt.x, this.gestureEndPt.x);
		const y = Math.min(this.originalStartPt.y, this.gestureEndPt.y);
		const width = Math.abs(this.gestureEndPt.x - this.originalStartPt.x);
		const height = Math.abs(this.gestureEndPt.y - this.originalStartPt.y);

		// Only zoom if box has meaningful size
		if(width > 10 && height > 10){
			stage.zoomToRect(new Rectangle(x, y, width, height));
		}
	}

	createVerticalLine(){
		// Create a vertical line through the start point
		const lineData = new Line([
			this.originalStartPt.x, this.originalStartPt.y - 500,
			this.originalStartPt.x, this.originalStartPt.y + 500
		]);
		data.addShape(lineData);
	}

	createHorizontalLine(){
		// Create a horizontal line through the start point
		const lineData = new Line([
			this.originalStartPt.x - 500, this.originalStartPt.y,
			this.originalStartPt.x + 500, this.originalStartPt.y
		]);
		data.addShape(lineData);
	}

	createCircleAtStart(){
		// Create a circle centered at start with radius to end point
		const dx = this.gestureEndPt.x - this.originalStartPt.x;
		const dy = this.gestureEndPt.y - this.originalStartPt.y;
		const radius = Math.sqrt(dx * dx + dy * dy);

		// Use a reasonable default radius if gesture was too short
		const r = radius > 10 ? radius : 50;

		const circle = new Circle([this.originalStartPt.x, this.originalStartPt.y, r]);
		data.addShape(circle);
	}

	determineGestureFromAngle(angleDeg){
		// Normalize to [0, 360)
		let normalizedAngle = angleDeg % 360;
		if(normalizedAngle < 0){ normalizedAngle += 360; }

		// Shift so sector centers align with multiples of 45° (±22.5° boundaries)
		// Rounding to nearest multiple of 45° gives the correct sector.
		// Returns 0-7: 0=right(E), 1=upRight(NE), 2=up(N), 3=upLeft(NW),
		//              4=left(W), 5=downLeft(SW), 6=down(S), 7=downRight(SE)
		return Math.round(normalizedAngle / 45) % 8;
	}

}

