import {Point} 				from './Point.js';
import {Rectangle} 			from './Rectangle.js';
import * as VectorUtils 	from './utils/VectorUtils.js';
import * as TransformUtils 	from './utils/TransformUtils.js';

export const Shape = Object.freeze({
	/*geometry*/
	POINT: "point",
	LINE: "line",
	CIRCLE: "circle",
	ARC: "arc",
	TANGENT_ARC: "tangent_arc",
	ELLIPSE: "ellipse",
	ELLIPTICAL_ARC: "elliptical_arc",
	SPLINE: "spline",
	IMAGE: "image",
	DIMENSION: "dimension",
	RADIAL_DIMENSION: "radial_dimension",
	ANGLE_DIMENSION: "angle_dimension",
	TEXT: "text",
	OUTLINE_TEXT: "outline_text",
	PAPER: "paper",
	FRAME: "frame",
	SYMBOL: "symbol",
	BOARD: "board",
	SLOT: "slot",
	POLYGON: "polygon",
	AUTO_LAYOUT_FRAME: "auto_layout_frame",
	MIRROR: "mirror",

	/*types*/
	CONSTRUCTION: "construction",
	SNAP_POINT: "snap_point",
	GUIDE: "guide",
	PLAIN: "plain"
});

// Snap types for labeling snap points
export const SnapType = Object.freeze({
	ENDPOINT: "endpoint",
	MIDPOINT: "midpoint",
	CENTER: "center",
	QUADRANT: "quadrant",
	RADIUS: "radius",
	ON: "on",
	INTERSECT: "intersect",
	ALIGN_X: "align:x",
	ALIGN_Y: "align:y",
	ALIGN_45: "align:45°",
	ALIGN_NEG45: "align:45°",
	TANGENT: "tangent",
	PERPENDICULAR: "perpendicular",
	MIRRORED: "mirrored"
});

// Guide types for drafting assistant guides
export const GuideType = Object.freeze({
	HORIZONTAL: "align:x",   // align:y
	VERTICAL: "align:y",       // align:x
	DIAGONAL_45: "align:45°",
	DIAGONAL_NEG45: "align:45°",
	TANGENT: "tangent",
	PERPENDICULAR: "perpendicular"
});

// Pen styles control visual appearance (color, dash pattern, width)
export const PenStyle = Object.freeze({
	VISIBLE: "visible",         // Default solid line
	CONSTRUCTION: "construction", // Light dashed (for construction geometry)
	CENTERLINE: "centerline",   // Long-short-long dash pattern
	HIDDEN: "hidden",           // Dashed line for hidden edges
	PHANTOM: "phantom",         // Long-dash-dot-dot pattern
	OUTLINE: "outline",          // Thicker solid line
	DIMENSION: "dimension"        // blue solid line
});

export class Geometry
{
	constructor()
	{
		this.selected 			= false;
		this.showControlPoints 	= false;  // Toggle with Cmd+click
		this.locked 			= false;  // Locked shapes cannot be selected
		this.stroke 			= '#000';
		this.bounds 			= new Rectangle();
		this.penStyle 			= PenStyle.VISIBLE;  // Default pen style
		this.groupId 			= null;  // ID of group this shape belongs to (null = ungrouped)
		this.frameId 			= null;  // ID of frame this shape belongs to (null = world coords)
		this.colorToken 		= null;  // Reference to color palette token ID
	}

	/**
	 * Return a new vector that goes from startPoint to endPoint.
	 */
	vectorBetweenPoints(startPoint, endPoint)
	{
		return VectorUtils.vectorBetweenPoints(startPoint, endPoint);
	}

	getTangentAngle(point) {
		return null;
	}

	/**
	 * Returns the inspector schema for this geometry.
	 * Override in subclasses to define inspectable properties.
	 * @returns {Object} Schema with name and sections array
	 */
	getInspectorSchema() {
		return {
			name: 'Shape',
			sections: []
		};
	}

	/**
	 * Returns the display label for this shape (used in UI labels, tooltips).
	 * Override in subclasses that have labels (Frame, Paper, SymbolInstance).
	 * @returns {string|null} Label text or null if no label
	 */
	getLabel() {
		return null;
	}

	/**
	 * Returns whether this shape is a container that holds other shapes.
	 * Only Frame returns true - shapes with frameId belong to that Frame.
	 * Note: Paper is NOT a container (just a print reference area).
	 * Note: SymbolInstance is NOT a container (references shapes from source frame).
	 * @returns {boolean} True if this shape contains other shapes
	 */
	isContainer() {
		return false;
	}

	/**
	 * Draw this shape to the canvas context.
	 * Override in subclasses to implement shape-specific rendering.
	 * @param {CanvasRenderingContext2D} ctx - The canvas context
	 * @param {Renderer} renderer - Renderer instance for coordinate conversion helpers
	 */
	draw(ctx, renderer) {
		// Base implementation does nothing - subclasses override
	}

	/**
	 * Draw control point handles when shape is selected.
	 * Override in subclasses for custom handle rendering.
	 * @param {CanvasRenderingContext2D} ctx - The canvas context
	 * @param {Renderer} renderer - Renderer instance for coordinate conversion helpers
	 */
	drawHandles(ctx, renderer) {
		// Show handles if explicitly requested (Cmd+click) OR if primitive is selected
		const showHandles = this.showControlPoints || (this.selected && this.showHandlesWhenSelected);
		if (!showHandles) return;

		const pois = this.getSnapPOIs();
		const handleRadius = 4;

		ctx.lineWidth = 0.5;
		ctx.strokeStyle = '#666666';
		ctx.fillStyle = '#FFFFFF';

		for (const poi of pois) {
			if (!poi) continue;
			const pt = renderer.toScreen(poi.x, poi.y);
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}

	dotProduct(vectorA, vectorB)
	{
		return VectorUtils.dotProduct(vectorA, vectorB);
	}

	/**
	 * Return the squared length of a vector.
	 */
	vectorLengthSquared(vector)
	{
		return VectorUtils.lengthSquared(vector);
	}

	/**
	 * Return the length of a vector.
	 */
	vectorLength(vector)
	{
		return VectorUtils.length(vector);
	}

	/**
	 * Return the squared distance between two points.
	 */
	squaredDistanceBetweenPoints(firstPoint, secondPoint)
	{
		return VectorUtils.distanceSquared(firstPoint, secondPoint);
	}

	/**
	 * Return the distance between two points.
	 */
	distanceBetweenPoints(firstPoint, secondPoint)
	{
		return VectorUtils.distance(firstPoint, secondPoint);
	}

	/**
	 * Clamp a number into the inclusive range [minimumValue, maximumValue].
	 */
	clampNumber(value, minimumValue, maximumValue)
	{
		return VectorUtils.clamp(value, minimumValue, maximumValue);
	}

	/**
	 * Return a normalized version of the input vector.
	 */
	normalizeVector(vector)
	{
		return VectorUtils.normalize(vector);
	}

	/**
	 * Return the scalar projection of vectorToProject onto directionVector.
	 */
	projectScalarOntoVector(vectorToProject, directionVector)
	{
		return VectorUtils.projectScalar(vectorToProject, directionVector);
	}

	/**
	 * Return the closest point on the segment [segmentStart, segmentEnd] to a point.
	 * If returnParametricT is true, returns { point, t } where t is clamped to [0, 1].
	 */
	closestPointOnSegment(point, segmentStart, segmentEnd, returnParametricT = false)
	{
		const result = VectorUtils.closestPointOnSegment(point, segmentStart, segmentEnd, returnParametricT);

		if (returnParametricT) {
			// Convert plain object to Point for backward compatibility
			return {
				point: new Point(result.point.x, result.point.y),
				t: result.t
			};
		}

		return new Point(result.x, result.y);
	}

	// ========== Transform Methods ==========
	// Default implementations for shapes that define getTransformablePoints().
	// Shapes with additional properties (radius, angles, etc.) should override.

	/**
	 * Return array of Point objects that should be transformed.
	 * Override in subclasses to enable default transform implementations.
	 * @returns {Point[]} Array of transformable points
	 */
	getTransformablePoints() {
		return [];
	}

	/**
	 * Translate the shape by offset.
	 * @param {number} dx - X offset
	 * @param {number} dy - Y offset
	 */
	translate(dx, dy) {
		for (const pt of this.getTransformablePoints()) {
			TransformUtils.translatePointInPlace(pt, dx, dy);
		}
		this.update();
	}

	/**
	 * Scale the shape relative to an anchor point.
	 * @param {number} anchorX - Anchor x coordinate
	 * @param {number} anchorY - Anchor y coordinate
	 * @param {number} factor - Scale factor
	 */
	scale(anchorX, anchorY, factor) {
		for (const pt of this.getTransformablePoints()) {
			TransformUtils.scalePointInPlace(pt, anchorX, anchorY, factor);
		}
		this.update();
	}

	/**
	 * Rotate the shape around an anchor point.
	 * @param {number} anchorX - Anchor x coordinate
	 * @param {number} anchorY - Anchor y coordinate
	 * @param {number} angleRad - Rotation angle in radians
	 */
	rotate(anchorX, anchorY, angleRad) {
		for (const pt of this.getTransformablePoints()) {
			TransformUtils.rotatePointInPlace(pt, anchorX, anchorY, angleRad);
		}
		this.update();
	}

	/**
	 * Mirror the shape across a line defined by two points.
	 * @param {number} x1 - Line point 1 x
	 * @param {number} y1 - Line point 1 y
	 * @param {number} x2 - Line point 2 x
	 * @param {number} y2 - Line point 2 y
	 */
	mirror(x1, y1, x2, y2) {
		for (const pt of this.getTransformablePoints()) {
			TransformUtils.mirrorPointInPlace(pt, x1, y1, x2, y2);
		}
		this.update();
	}

	/**
	 * Update computed properties after transforms.
	 * Override in subclasses.
	 */
	update() {
		// Base implementation does nothing
	}

	// ========== Abstract Tool Interface ==========
	// These methods allow tools to interact with shapes without
	// knowing their specific types. Override in subclasses as needed.

	/**
	 * Clone this shape for drag operations (Option+drag).
	 * Override in subclasses that need special clone behavior.
	 * e.g., symbol sources create instances instead of clones.
	 * @returns {Geometry} The cloned shape (or instance)
	 */
	cloneForDrag() {
		return this.clone();
	}

	/**
	 * Get the type of a control point for tool behavior.
	 * @param {number} index - POI index
	 * @returns {string} 'move' | 'resize' | 'rotate' | etc.
	 */
	getControlPointType(index) {
		return 'move';
	}

	/**
	 * Check if this shape is a container (has child shapes).
	 * @returns {boolean}
	 */
	isContainer() {
		return false;
	}

	/**
	 * Get shapes contained within this shape.
	 * Only meaningful if isContainer() returns true.
	 * @returns {Geometry[]}
	 */
	getContainedShapes() {
		return [];
	}

	/**
	 * Handle double-click on this shape.
	 * Override to implement edit-on-double-click behavior.
	 * @param {Object} clickPos - {x, y} world coordinates
	 * @param {Object} context - {toolManager, data, stage} for actions
	 * @returns {boolean} true if handled, false to continue default behavior
	 */
	handleDoubleClick(clickPos, context) {
		return false;
	}
}
