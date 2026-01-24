import { Tool } from './Tool.js';
import { Shape } from '../geometry/Geometry.js';
import { Polygon } from '../geometry/Polygon.js';
import { AddShapeCommand } from '../core/Commands.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import da from '../geometry/DraftingAssistant.js';

const MIN_RAD = 5;  // Minimum radius in screen pixels

/**
 * PolygonTool - Create regular polygons using center + radius drag.
 *
 * Same interaction pattern as CircleTool:
 * - Click to set center, drag to set radius
 * - Option-click to place polygon with last radius
 * - Number of sides configurable in inspector (default 6 = hexagon)
 */
export class PolygonTool extends Tool {
	constructor() {
		super();

		this.name = "Polygon";
		this.usage = "Click to set center, drag to set radius. Use inspector to change sides.";

		this.generateGuides = true;

		this.polygon = null;
		this.prevPolygon = null;
		this.lastRadius = 50;  // Default radius for option-click
		this.defaultSides = 6;  // Default hexagon

		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.updateRadius = this.updateRadius.bind(this);
	}

	begin() {
		// Reset state when tool is activated
	}

	deactivate(){
		// Cleanup when leaving tool
	}

	updateCursor() {
		stage.setCursor('crosshair');
	}

	reset() {
		if (this.polygon) {
			this.polygon = null;
		}
		data.resetSnaps();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e) {
		data.resetSnaps();

		// Option-click: create polygon with stored radius at click point
		if (stage.optionKey) {
			const snapPt = da.getCurrentSnapPoint();
			const polygon = new Polygon([snapPt.x, snapPt.y, this.lastRadius, this.defaultSides]);
			undoManager.execute(new AddShapeCommand(polygon));
			this.prevPolygon = polygon;
			stage.setInputCallback(this.updateRadius);
			stage.setDimensionInputValue(this.lastRadius * 2);  // Show diameter
			stage.render();
			return;
		}

		if (this.polygon) {
			// Second click: commit on mouseUp
		} else {
			// First click: start new polygon at snap point
			const snapPt = da.getCurrentSnapPoint();

			// Set up drafting assistant from center point
			da.setCurrentSnapPoint(snapPt, true);

			this.polygon = new Polygon([snapPt.x, snapPt.y, 0, this.defaultSides]);
			data.addTempShape(this.polygon);
		}
	}

	onMouseMove(e) {
		if (!this.polygon) return;

		const currentPoint = da.getCurrentSnapPoint();
		this.polygon.radius = this.distanceBetweenPoints(this.polygon, currentPoint);
		// Update angle to current drag direction
		this.polygon.radiusAngle = Math.atan2(currentPoint.y - this.polygon.y, currentPoint.x - this.polygon.x);
		this.polygon.update();

		stage.render();
	}

	onMouseUp(e) {
		data.resetSnaps();
		if (!this.polygon) return;

		// Update radius and angle from current snap point
		const currentPoint = da.getCurrentSnapPoint();
		this.polygon.radius = this.distanceBetweenPoints(this.polygon, currentPoint);
		this.polygon.radiusAngle = Math.atan2(currentPoint.y - this.polygon.y, currentPoint.x - this.polygon.x);

		// Check minimum radius in screen space
		const screenRadius = stage.worldToScreenScale(this.polygon.radius);
		if (screenRadius < MIN_RAD) {
			// Too small, keep defining
		} else {
			this.polygon.update();
			undoManager.execute(new AddShapeCommand(this.polygon));
			data.clearTempShapes();

			// Store for editing and next option-click
			this.prevPolygon = this.polygon;
			this.lastRadius = this.polygon.radius;
			this.defaultSides = this.polygon.sides;

			// Show radius in input field (as diameter)
			stage.setInputCallback(this.updateRadius);
			stage.setDimensionInputValue(this.lastRadius * 2);

			this.polygon = null;
		}

		stage.render();
	}

	updateRadius(newDiameter) {
		const d = parseFloat(newDiameter);
		if (isNaN(d) || d <= 0) return;

		if (this.prevPolygon) {
			this.prevPolygon.radius = d / 2;
			this.prevPolygon.update();
			stage.render();
		}

		// Update stored radius for next option-click
		this.lastRadius = d / 2;
	}
}
