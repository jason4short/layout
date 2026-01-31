import { Shape } from '../geometry/Geometry.js';

/**
 * Convert shapes to DXF format (AutoCAD R2000 compatible)
 * Uses ASCII DXF format with minimal structure for broad compatibility
 * Exports all shapes in world coordinates
 */

// Flatten primitives into basic shapes
function flattenShapes(shapes) {
	const result = [];
	for (const shape of shapes) {
		if (shape.createShapes) {
			result.push(...shape.createShapes());
		} else if (shape.createLines) {
			result.push(...shape.createLines());
		} else {
			result.push(shape);
		}
	}
	return result;
}

// Calculate bounding box of all shapes
function calculateBounds(shapes) {
	let minX = Infinity, minY = Infinity;
	let maxX = -Infinity, maxY = -Infinity;

	for (const shape of shapes) {
		if (shape.bounds) {
			minX = Math.min(minX, shape.bounds.x);
			minY = Math.min(minY, shape.bounds.y);
			maxX = Math.max(maxX, shape.bounds.x + shape.bounds.width);
			maxY = Math.max(maxY, shape.bounds.y + shape.bounds.height);
		}
	}

	if (minX === Infinity) {
		return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
	}

	return { minX, minY, maxX, maxY };
}

// Write a DXF group code and value pair
function dxf(code, value) {
	return `  ${code}\n${value}`;
}

// Write DXF header section
function writeHeader(lines, displayWidth, displayHeight) {
	lines.push(dxf(0, 'SECTION'));
	lines.push(dxf(2, 'HEADER'));

	// AutoCAD version (AC1015 = AutoCAD 2000, widely compatible)
	lines.push(dxf(9, '$ACADVER'));
	lines.push(dxf(1, 'AC1015'));

	// Units - 4 = millimeters
	lines.push(dxf(9, '$INSUNITS'));
	lines.push(dxf(70, '4'));

	// Drawing extents
	lines.push(dxf(9, '$EXTMIN'));
	lines.push(dxf(10, '0.0'));
	lines.push(dxf(20, '0.0'));
	lines.push(dxf(30, '0.0'));

	lines.push(dxf(9, '$EXTMAX'));
	lines.push(dxf(10, displayWidth.toFixed(6)));
	lines.push(dxf(20, displayHeight.toFixed(6)));
	lines.push(dxf(30, '0.0'));

	lines.push(dxf(0, 'ENDSEC'));
}

// Write minimal tables section (required for valid DXF)
function writeTables(lines) {
	lines.push(dxf(0, 'SECTION'));
	lines.push(dxf(2, 'TABLES'));

	// Layer table with default layer 0
	lines.push(dxf(0, 'TABLE'));
	lines.push(dxf(2, 'LAYER'));
	lines.push(dxf(70, '1'));

	lines.push(dxf(0, 'LAYER'));
	lines.push(dxf(2, '0'));
	lines.push(dxf(70, '0'));
	lines.push(dxf(62, '7'));  // Color: white/black
	lines.push(dxf(6, 'CONTINUOUS'));

	lines.push(dxf(0, 'ENDTAB'));
	lines.push(dxf(0, 'ENDSEC'));
}

// Write LINE entity
function writeLine(lines, start, end) {
	lines.push(dxf(0, 'LINE'));
	lines.push(dxf(8, '0'));  // Layer
	lines.push(dxf(10, start.x.toFixed(6)));
	lines.push(dxf(20, start.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));
	lines.push(dxf(11, end.x.toFixed(6)));
	lines.push(dxf(21, end.y.toFixed(6)));
	lines.push(dxf(31, '0.0'));
}

// Write CIRCLE entity
function writeCircle(lines, center, radius) {
	lines.push(dxf(0, 'CIRCLE'));
	lines.push(dxf(8, '0'));  // Layer
	lines.push(dxf(10, center.x.toFixed(6)));
	lines.push(dxf(20, center.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));
	lines.push(dxf(40, radius.toFixed(6)));
}

// Write ARC entity
// DXF arcs use center, radius, start angle, end angle (degrees, CCW from +X)
function writeArc(lines, center, radius, startAngleDeg, endAngleDeg) {
	lines.push(dxf(0, 'ARC'));
	lines.push(dxf(8, '0'));  // Layer
	lines.push(dxf(10, center.x.toFixed(6)));
	lines.push(dxf(20, center.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));
	lines.push(dxf(40, radius.toFixed(6)));
	lines.push(dxf(50, startAngleDeg.toFixed(6)));
	lines.push(dxf(51, endAngleDeg.toFixed(6)));
}

// Write ELLIPSE entity
// DXF ellipses use center, major axis endpoint (relative), ratio, start/end params
function writeEllipse(lines, center, radiusX, radiusY, rotation) {
	lines.push(dxf(0, 'ELLIPSE'));
	lines.push(dxf(8, '0'));  // Layer

	// Center point
	lines.push(dxf(10, center.x.toFixed(6)));
	lines.push(dxf(20, center.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));

	// Major axis endpoint (relative to center)
	// For rotation, we need to rotate the major axis vector
	const majorX = Math.cos(rotation) * radiusX;
	const majorY = Math.sin(rotation) * radiusX;
	lines.push(dxf(11, majorX.toFixed(6)));
	lines.push(dxf(21, majorY.toFixed(6)));
	lines.push(dxf(31, '0.0'));

	// Ratio of minor to major axis
	const ratio = radiusY / radiusX;
	lines.push(dxf(40, ratio.toFixed(6)));

	// Start and end parameters (0 to 2π for full ellipse)
	lines.push(dxf(41, '0.0'));
	lines.push(dxf(42, (Math.PI * 2).toFixed(6)));
}

// Write SPLINE entity (cubic bezier)
function writeSpline(lines, p0, p1, p2, p3) {
	lines.push(dxf(0, 'SPLINE'));
	lines.push(dxf(8, '0'));  // Layer

	// Spline flags: 8 = planar, 1 = closed (we use 8 for open planar)
	lines.push(dxf(70, '8'));

	// Degree (3 = cubic)
	lines.push(dxf(71, '3'));

	// Number of knots (degree + control points + 1 = 3 + 4 + 1 = 8)
	lines.push(dxf(72, '8'));

	// Number of control points
	lines.push(dxf(73, '4'));

	// Knot values for clamped cubic bezier: [0,0,0,0,1,1,1,1]
	lines.push(dxf(40, '0.0'));
	lines.push(dxf(40, '0.0'));
	lines.push(dxf(40, '0.0'));
	lines.push(dxf(40, '0.0'));
	lines.push(dxf(40, '1.0'));
	lines.push(dxf(40, '1.0'));
	lines.push(dxf(40, '1.0'));
	lines.push(dxf(40, '1.0'));

	// Control points
	lines.push(dxf(10, p0.x.toFixed(6)));
	lines.push(dxf(20, p0.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));

	lines.push(dxf(10, p1.x.toFixed(6)));
	lines.push(dxf(20, p1.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));

	lines.push(dxf(10, p2.x.toFixed(6)));
	lines.push(dxf(20, p2.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));

	lines.push(dxf(10, p3.x.toFixed(6)));
	lines.push(dxf(20, p3.y.toFixed(6)));
	lines.push(dxf(30, '0.0'));
}

// Write TEXT entity
function writeText(lines, x, y, height, text, rotation = 0) {
	lines.push(dxf(0, 'TEXT'));
	lines.push(dxf(8, '0'));  // Layer
	lines.push(dxf(10, x.toFixed(6)));
	lines.push(dxf(20, y.toFixed(6)));
	lines.push(dxf(30, '0.0'));
	lines.push(dxf(40, height.toFixed(6)));
	lines.push(dxf(1, text));
	if (rotation !== 0) {
		lines.push(dxf(50, (rotation * 180 / Math.PI).toFixed(6)));
	}
}

// Convert a shape to DXF entities (using world coordinates directly)
function shapeToDXF(shape, lines) {
	switch (shape.geometry) {
		case Shape.LINE: {
			writeLine(lines, shape.start, shape.end);
			break;
		}

		case Shape.CIRCLE: {
			writeCircle(lines, { x: shape.x, y: shape.y }, shape.radius);
			break;
		}

		case Shape.ARC:
		case Shape.TANGENT_ARC: {
			if (shape.radius <= 0) break;
			// Convert radians to degrees
			const startDeg = shape.startAngle * 180 / Math.PI;
			const endDeg = shape.endAngle * 180 / Math.PI;
			writeArc(lines, { x: shape.x, y: shape.y }, shape.radius, startDeg, endDeg);
			break;
		}

		case Shape.ELLIPSE: {
			writeEllipse(lines, { x: shape.x, y: shape.y }, shape.radiusX, shape.radiusY, shape.rotation || 0);
			break;
		}

		case Shape.SPLINE: {
			writeSpline(lines, shape.p0, shape.p1, shape.p2, shape.p3);
			break;
		}

		case Shape.TEXT: {
			const height = shape.fontSize || 12;
			writeText(lines, shape.x, shape.y, height, shape.text || '', shape.rotation || 0);
			break;
		}

		case Shape.DIMENSION:
		case Shape.RADIAL_DIMENSION:
		case Shape.ANGLE_DIMENSION:
			// TODO: Could export as dimension entities, for now skip
			break;

		case Shape.IMAGE:
		case Shape.PAPER:
		case Shape.FRAME:
			// Not exported
			break;

		default:
			console.warn('DXF export: Unknown geometry type', shape.geometry);
	}
}

/**
 * Export shapes to DXF string
 * @param {Array} shapes - Array of shape objects to export
 * @returns {string} DXF document as string
 */
export function exportToDXF(shapes) {
	// Flatten and filter shapes
	const flatShapes = flattenShapes(shapes).filter(shape =>
		shape.geometry !== Shape.PAPER &&
		shape.geometry !== Shape.IMAGE
	);

	// Calculate bounds from all shapes
	const bounds = calculateBounds(flatShapes);

	const lines = [];

	// Write sections
	writeHeader(lines, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
	writeTables(lines);

	// Entities section
	lines.push(dxf(0, 'SECTION'));
	lines.push(dxf(2, 'ENTITIES'));

	for (const shape of flatShapes) {
		shapeToDXF(shape, lines);
	}

	lines.push(dxf(0, 'ENDSEC'));

	// EOF
	lines.push(dxf(0, 'EOF'));

	return lines.join('\n');
}

/**
 * Trigger DXF download
 * @param {string} dxfContent - DXF document string
 * @param {string} fileName - File name for download
 */
export function downloadDXF(dxfContent, fileName = 'drawing.dxf') {
	const blob = new Blob([dxfContent], { type: 'application/dxf' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
