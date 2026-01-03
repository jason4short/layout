import {Tool} 			from "./Tool.js";
import {Line} 			from '../geometry/Line.js';
import {Circle} 		from '../geometry/Circle.js';
import {Construction} 	from '../geometry/Construction.js';
import {Rectangle} 		from '../geometry/Rectangle.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import {AddConstructionCommand, DeleteConstructionsCommand, AddShapeCommand} from '../core/Commands.js';

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
		this.gestures			= [];

		// Screen-space tracking for gesture detection
		this.screenStart 		= null;
		this.screenCurrent		= null;

		// World-space points for actions
		this.worldStart			= null;
		this.worldCurrent		= null;

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
			'1':   () => toolManager.setTool(toolManager.pointerTool),       // upRight = clear constructions
//			'5':   () =>  									, // downLeft = pointer

			// Compound gestures (add more as needed)
			'15':  () => this.deleteAllConstructions(),    // upright-downleft = delete constructions
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
		this.gestures 		= [];
		this.screenStart 	= null;
		this.screenCurrent 	= null;
		this.worldStart 	= null;
		this.worldCurrent 	= null;
	}

	onMouseDown(e)
	{
		// Track both screen and world coordinates
		this.screenStart 	= { x: e.screenX, y: e.screenY };
		this.screenCurrent 	= { x: e.screenX, y: e.screenY };

		// Use snap point for world coordinates (for construction lines)
		const snap = data.getCurrentSnapPoint();
		this.worldStart 	= { x: snap.x, y: snap.y };
		this.worldCurrent 	= { x: snap.x, y: snap.y };
	}

	onMouseMove(e){
		if(!this.screenStart) return;

		this.screenCurrent 	= { x: e.screenX, y: e.screenY };
		this.worldCurrent 	= { x: e.x, y: e.y };

		// Calculate screen-space distance and angle
		const dx = this.screenCurrent.x - this.screenStart.x;
		const dy = this.screenCurrent.y - this.screenStart.y;
		const screenLength = Math.sqrt(dx * dx + dy * dy);

		if(screenLength > this.segmentThreshold)
		{
			const angleDeg = Math.atan2(-dy, dx) * (180 / Math.PI);
			const newDirection = this.determineGestureFromAngle(angleDeg);
			const lastDirection = this.gestures[this.gestures.length - 1];

			// Hysteresis: only register change if direction differs significantly
			if(lastDirection === undefined){
				this.gestures.push(newDirection);
				console.log("gesture: " + this.gestures.join(''));
			} else {
				const diff = Math.abs(newDirection - lastDirection);
				const sectorDiff = Math.min(diff, 8 - diff);

				if(sectorDiff >= this.directionTolerance){
					this.gestures.push(newDirection);
					console.log("gesture: " + this.gestures.join(''));
				}
			}

			// Reset segment start to current position
			this.screenStart = { x: e.screenX, y: e.screenY };
		}

		// Show zoom box preview (world coordinates)
		const x 		= Math.min(this.worldStart.x, this.worldCurrent.x);
		const y 		= Math.min(this.worldStart.y, this.worldCurrent.y);
		const width 	= Math.abs(this.worldCurrent.x - this.worldStart.x);
		const height 	= Math.abs(this.worldCurrent.y - this.worldStart.y);

		stage.renderer.zoomRect = new Rectangle(x, y, width, height);
		stage.render();
	}

	onMouseUp(e){
		if(!this.screenStart) return;

		this.worldCurrent = { x: e.x, y: e.y };

		const gesture = this.gestures.join('');
		console.log("final gesture: " + gesture);

		this.executeGesture(gesture);

		stage.renderer.zoomRect = null;
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
		const construction = new Construction([this.worldStart.x, this.worldStart.y, angle]);
		undoManager.execute(new AddConstructionCommand(construction));
	}

	deleteAllConstructions(){
		if(data.constructions.length > 0){
			undoManager.execute(new DeleteConstructionsCommand());
		}
	}

	zoomToBox(){
		const x = Math.min(this.worldStart.x, this.worldCurrent.x);
		const y = Math.min(this.worldStart.y, this.worldCurrent.y);
		const width = Math.abs(this.worldCurrent.x - this.worldStart.x);
		const height = Math.abs(this.worldCurrent.y - this.worldStart.y);

		// Only zoom if box has meaningful size
		if(width > 10 && height > 10){
			stage.zoomToRect(new Rectangle(x, y, width, height));
		}
	}

	createVerticalLine(){
		const lineData = new Line([
			this.worldStart.x, this.worldStart.y - 500,
			this.worldStart.x, this.worldStart.y + 500
		]);
		undoManager.execute(new AddShapeCommand(lineData));
	}

	createHorizontalLine(){
		const lineData = new Line([
			this.worldStart.x - 500, this.worldStart.y,
			this.worldStart.x + 500, this.worldStart.y
		]);
		undoManager.execute(new AddShapeCommand(lineData));
	}

	createCircleAtStart(){
		const dx = this.worldCurrent.x - this.worldStart.x;
		const dy = this.worldCurrent.y - this.worldStart.y;
		const radius = Math.sqrt(dx * dx + dy * dy);
		const r = radius > 10 ? radius : 50;

		const circle = new Circle([this.worldStart.x, this.worldStart.y, r]);
		undoManager.execute(new AddShapeCommand(circle));
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

