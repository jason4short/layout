import { Shape } from '../geometry/Geometry.js';
import data from '../data/Data.js';

/**
 * Convert shapes to Gcode format for plotter output
 * Supports native G02/G03 arc commands for better quality
 */

// Configuration defaults
const DEFAULT_CONFIG = {
	feedRate: 3200,
	penDownFeed: 40,
	penUpZ: 0.15,
	penDownZ: 0.05,
	penOffset: { x: 0, y: 0 },
	chordTolerance: 0.1,        // Max deviation from true curve (mm) for splines/ellipses
	maxSubdivisions: 8,         // Max recursion depth to prevent infinite loops
	// GRBL settings (optional - set to override machine defaults)
	setGrblArcSettings: false,  // Set to true to emit $11/$12 in header
	arcTolerance: 0.002,        // $12 - Arc tolerance in mm
	junctionDeviation: 0.010    // $11 - Junction deviation in mm
};

// Command types
const CMD = {
	POLYLINE: 'polyline',
	ARC: 'arc',
	CIRCLE: 'circle'
};

// Transform world coordinates to paper-relative coordinates (mm)
function worldToPaper(worldX, worldY, paper) {
	return {
		x: worldX - paper.x,
		y: worldY - paper.y
	};
}

// Flatten primitives into basic shapes (lines, arcs, etc.)
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

// Check if shape bounds intersect with paper display bounds
function shapeIntersectsPaper(shape, paper, displayWidth, displayHeight) {
	if (!shape.bounds) return true;

	const paperRight = paper.x + displayWidth;
	const paperBottom = paper.y + displayHeight;
	const shapeRight = shape.bounds.x + shape.bounds.width;
	const shapeBottom = shape.bounds.y + shape.bounds.height;

	if (shape.bounds.x >= paperRight || shapeRight <= paper.x ||
		shape.bounds.y >= paperBottom || shapeBottom <= paper.y) {
		return false;
	}
	return true;
}

// Get start point of a command
function getStartPoint(cmd) {
	switch (cmd.type) {
		case CMD.POLYLINE:
			return cmd.points[0];
		case CMD.ARC:
			return cmd.start;
		case CMD.CIRCLE:
			// Circle starts at angle 0 (rightmost point)
			return { x: cmd.center.x + cmd.radius, y: cmd.center.y };
	}
}

// Get end point of a command
function getEndPoint(cmd) {
	switch (cmd.type) {
		case CMD.POLYLINE:
			return cmd.points[cmd.points.length - 1];
		case CMD.ARC:
			return cmd.end;
		case CMD.CIRCLE:
			// Circle ends where it starts
			return { x: cmd.center.x + cmd.radius, y: cmd.center.y };
	}
}

// Convert a LINE shape to command
function lineToCommand(shape, paper) {
	const start = worldToPaper(shape.start.x, shape.start.y, paper);
	const end = worldToPaper(shape.end.x, shape.end.y, paper);
	return {
		type: CMD.POLYLINE,
		points: [start, end]
	};
}

// Convert a CIRCLE shape to command (native arc)
function circleToCommand(shape, paper) {
	const center = worldToPaper(shape.x, shape.y, paper);
	return {
		type: CMD.CIRCLE,
		center: center,
		radius: shape.radius
	};
}

// Convert an ARC shape to command (native arc)
function arcToCommand(shape, paper) {
	const center = worldToPaper(shape.x, shape.y, paper);
	const r = shape.radius;
	const startAngle = shape.startAngle;
	const endAngle = shape.endAngle;

	// Calculate start and end points
	const start = {
		x: center.x + Math.cos(startAngle) * r,
		y: center.y + Math.sin(startAngle) * r
	};
	const end = {
		x: center.x + Math.cos(endAngle) * r,
		y: center.y + Math.sin(endAngle) * r
	};

	// Determine if clockwise or counterclockwise
	// In CAD, positive angle = CCW. For Gcode with inverted Y, we flip direction.
	let sweep = endAngle - startAngle;
	if (sweep < 0) sweep += Math.PI * 2;

	// sweep > 0 means CCW in world coords
	// With Y inverted for plotter, CCW becomes CW visually
	const clockwise = true; // We always go "clockwise" in the sweep direction

	return {
		type: CMD.ARC,
		start: start,
		end: end,
		center: center,
		radius: r,
		clockwise: clockwise,
		sweep: sweep
	};
}

// Calculate point on ellipse at given angle
function ellipsePoint(center, rx, ry, rotation, angle) {
	let x = Math.cos(angle) * rx;
	let y = Math.sin(angle) * ry;

	if (rotation !== 0) {
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);
		const rotX = x * cos - y * sin;
		const rotY = x * sin + y * cos;
		x = rotX;
		y = rotY;
	}

	return { x: center.x + x, y: center.y + y };
}

// Recursive subdivision of ellipse arc based on chord tolerance
function subdivideEllipseArc(center, rx, ry, rotation, startAngle, endAngle, tolerance, depth, maxDepth, points) {
	const midAngle = (startAngle + endAngle) / 2;

	// Points at start, mid, and end of this arc segment
	const pStart = ellipsePoint(center, rx, ry, rotation, startAngle);
	const pMid = ellipsePoint(center, rx, ry, rotation, midAngle);
	const pEnd = ellipsePoint(center, rx, ry, rotation, endAngle);

	// Chord midpoint (straight line from start to end)
	const chordMid = { x: (pStart.x + pEnd.x) / 2, y: (pStart.y + pEnd.y) / 2 };

	// Chord error
	const error = Math.hypot(pMid.x - chordMid.x, pMid.y - chordMid.y);

	if (error <= tolerance || depth >= maxDepth) {
		// Flat enough - add end point
		points.push(pEnd);
	} else {
		// Subdivide
		subdivideEllipseArc(center, rx, ry, rotation, startAngle, midAngle, tolerance, depth + 1, maxDepth, points);
		subdivideEllipseArc(center, rx, ry, rotation, midAngle, endAngle, tolerance, depth + 1, maxDepth, points);
	}
}

// Convert an ELLIPSE shape to polyline with adaptive subdivision
function ellipseToCommand(shape, paper, config) {
	const center = worldToPaper(shape.x, shape.y, paper);
	const rx = shape.radiusX;
	const ry = shape.radiusY;
	const rotation = shape.rotation || 0;

	// Start with first point
	const startPoint = ellipsePoint(center, rx, ry, rotation, 0);
	const points = [startPoint];

	// Subdivide the full ellipse (0 to 2π)
	// Split into 4 quadrants to start for better initial distribution
	const quadrants = 4;
	for (let i = 0; i < quadrants; i++) {
		const startAngle = (i / quadrants) * Math.PI * 2;
		const endAngle = ((i + 1) / quadrants) * Math.PI * 2;
		subdivideEllipseArc(center, rx, ry, rotation, startAngle, endAngle,
			config.chordTolerance, 0, config.maxSubdivisions, points);
	}

	return {
		type: CMD.POLYLINE,
		points: points
	};
}

// Evaluate cubic bezier at parameter t
function bezierPoint(p0, p1, p2, p3, t) {
	const mt = 1 - t;
	const mt2 = mt * mt;
	const mt3 = mt2 * mt;
	const t2 = t * t;
	const t3 = t2 * t;

	return {
		x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
		y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
	};
}

// Split cubic bezier into two halves using de Casteljau's algorithm
function splitBezier(p0, p1, p2, p3) {
	// Midpoints
	const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
	const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
	const p23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };

	const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
	const p123 = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 };

	const mid = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 };

	return {
		left: [p0, p01, p012, mid],
		right: [mid, p123, p23, p3]
	};
}

// Recursive subdivision based on chord tolerance
function subdivideBezier(p0, p1, p2, p3, tolerance, depth, maxDepth, points) {
	// Calculate point on curve at t=0.5
	const curvePoint = bezierPoint(p0, p1, p2, p3, 0.5);

	// Calculate midpoint of chord (straight line from p0 to p3)
	const chordMid = { x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2 };

	// Chord error = distance between curve midpoint and chord midpoint
	const error = Math.hypot(curvePoint.x - chordMid.x, curvePoint.y - chordMid.y);

	if (error <= tolerance || depth >= maxDepth) {
		// Flat enough - add end point (start point already added by caller)
		points.push(p3);
	} else {
		// Subdivide and recurse
		const { left, right } = splitBezier(p0, p1, p2, p3);
		subdivideBezier(left[0], left[1], left[2], left[3], tolerance, depth + 1, maxDepth, points);
		subdivideBezier(right[0], right[1], right[2], right[3], tolerance, depth + 1, maxDepth, points);
	}
}

// Convert a SPLINE (cubic bezier) to polyline with adaptive subdivision
function splineToCommand(shape, paper, config) {
	const p0 = worldToPaper(shape.p0.x, shape.p0.y, paper);
	const p1 = worldToPaper(shape.p1.x, shape.p1.y, paper);
	const p2 = worldToPaper(shape.p2.x, shape.p2.y, paper);
	const p3 = worldToPaper(shape.p3.x, shape.p3.y, paper);

	const points = [p0]; // Start with first point
	subdivideBezier(p0, p1, p2, p3, config.chordTolerance, 0, config.maxSubdivisions, points);

	return {
		type: CMD.POLYLINE,
		points: points
	};
}

// Convert a shape to command(s)
function shapeToCommands(shape, paper, config) {
	switch (shape.geometry) {
		case Shape.LINE:
			return [lineToCommand(shape, paper)];

		case Shape.CIRCLE:
			return [circleToCommand(shape, paper)];

		case Shape.ARC:
		case Shape.TANGENT_ARC:
			if (shape.radius <= 0) return [];
			return [arcToCommand(shape, paper)];

		case Shape.ELLIPSE:
			return [ellipseToCommand(shape, paper, config)];

		case Shape.SPLINE:
			return [splineToCommand(shape, paper, config)];

		// Skip non-drawable shapes
		case Shape.TEXT:
		case Shape.DIMENSION:
		case Shape.IMAGE:
		case Shape.PAPER:
		case Shape.FRAME:
			return [];

		default:
			console.warn('Gcode export: Unknown geometry type', shape.geometry);
			return [];
	}
}

// Sort commands to minimize plotter travel (nearest neighbor algorithm)
function sortCommandsForPlotter(commands) {
	if (commands.length === 0) return [];

	const remaining = [...commands];
	const sorted = [remaining.shift()];

	while (remaining.length > 0) {
		const lastCmd = sorted[sorted.length - 1];
		const lastPoint = getEndPoint(lastCmd);

		let closestIndex = 0;
		let minDistance = Infinity;

		for (let i = 0; i < remaining.length; i++) {
			const startPoint = getStartPoint(remaining[i]);
			const distance = Math.hypot(
				startPoint.x - lastPoint.x,
				startPoint.y - lastPoint.y
			);

			if (distance < minDistance) {
				minDistance = distance;
				closestIndex = i;
			}
		}

		sorted.push(remaining.splice(closestIndex, 1)[0]);
	}

	return sorted;
}

// Write Gcode header
function writeHeader(content, config) {
	content.push('%');
	content.push('M3');
	content.push('G21 (All units in mm)');
	content.push('G90 ; Set absolute positioning');

	// Optional GRBL arc/motion settings
	if (config.setGrblArcSettings) {
		content.push(`$11=${config.junctionDeviation.toFixed(4)} ; Junction deviation`);
		content.push(`$12=${config.arcTolerance.toFixed(4)} ; Arc tolerance`);
	}

	content.push('G10 P0 L20 X0 Y0');
	content.push('G10 P0 L20 Z0 ; Set current position as Z=0');
	content.push('G28.1');
	content.push('G01 Z0.150000 F10.0 (lift)');
	content.push('; end header');
}

// Write Gcode footer
function writeFooter(content) {
	content.push('');
	content.push('; begin footer');
	content.push('G00 Z0.200000');
	content.push('M5');
	content.push('G00 X0.0000 Y0.0000');
	content.push('M2');
	content.push('%');
	content.push('; end footer');
}

// Apply Y inversion and pen offset
function transformPoint(pt, config, paperHeight) {
	return {
		x: pt.x + config.penOffset.x,
		y: paperHeight - pt.y - config.penOffset.y
	};
}

// Emit a polyline command
function emitPolyline(cmd, config, paperHeight, feed, content) {
	const points = cmd.points;
	if (points.length < 2) return;

	// Move to start
	const start = transformPoint(points[0], config, paperHeight);
	content.push(`G00 X${start.x.toFixed(3)} Y${start.y.toFixed(3)} ${feed} (Travel)`);

	// Pen down
	content.push(`G01 Z${config.penDownZ.toFixed(5)} F${config.penDownFeed}.0 (Pen)`);

	// Draw lines
	for (let i = 1; i < points.length; i++) {
		const pt = transformPoint(points[i], config, paperHeight);
		content.push(`G01 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} ${feed}`);
	}

	// Pen up
	content.push(`G01 Z${config.penUpZ.toFixed(5)} F${config.penDownFeed}.0 (lift)`);
}

// Emit a native arc command (G02/G03)
function emitArc(cmd, config, paperHeight, feed, content) {
	const start = transformPoint(cmd.start, config, paperHeight);
	const end = transformPoint(cmd.end, config, paperHeight);
	const center = transformPoint(cmd.center, config, paperHeight);

	// I, J are offsets from start point to center
	const i = center.x - start.x;
	const j = center.y - start.y;

	// Move to start
	content.push(`G00 X${start.x.toFixed(3)} Y${start.y.toFixed(3)} ${feed} (Travel)`);

	// Pen down
	content.push(`G01 Z${config.penDownZ.toFixed(5)} F${config.penDownFeed}.0 (Pen)`);

	// Arc command - G02 = CW, G03 = CCW
	// With Y inverted, the visual direction flips
	// Original CCW (positive sweep) becomes visual CW after Y invert -> use G02
	const arcCmd = cmd.clockwise ? 'G02' : 'G03';
	content.push(`${arcCmd} X${end.x.toFixed(3)} Y${end.y.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)} ${feed}`);

	// Pen up
	content.push(`G01 Z${config.penUpZ.toFixed(5)} F${config.penDownFeed}.0 (lift)`);
}

// Emit a full circle (two 180° arcs)
function emitCircle(cmd, config, paperHeight, feed, content) {
	const center = transformPoint(cmd.center, config, paperHeight);
	const r = cmd.radius;

	// Start at rightmost point (0°)
	const startX = center.x + r;
	const startY = center.y;

	// Opposite point (180°)
	const midX = center.x - r;
	const midY = center.y;

	// Move to start
	content.push(`G00 X${startX.toFixed(3)} Y${startY.toFixed(3)} ${feed} (Travel)`);

	// Pen down
	content.push(`G01 Z${config.penDownZ.toFixed(5)} F${config.penDownFeed}.0 (Pen)`);

	// First half: G02 from right to left (I=-r, J=0 relative to start)
	content.push(`G02 X${midX.toFixed(3)} Y${midY.toFixed(3)} I${(-r).toFixed(3)} J0.000 ${feed}`);

	// Second half: G02 from left to right (I=r, J=0 relative to mid)
	content.push(`G02 X${startX.toFixed(3)} Y${startY.toFixed(3)} I${r.toFixed(3)} J0.000 ${feed}`);

	// Pen up
	content.push(`G01 Z${config.penUpZ.toFixed(5)} F${config.penDownFeed}.0 (lift)`);
}

// Convert commands to Gcode
function commandsToGcode(commands, config, paperHeight) {
	const content = [];
	const feed = `F${config.feedRate}`;

	writeHeader(content, config);
	content.push('');
	content.push('; begin paths');

	const sortedCommands = sortCommandsForPlotter(commands);

	for (const cmd of sortedCommands) {
		switch (cmd.type) {
			case CMD.POLYLINE:
				emitPolyline(cmd, config, paperHeight, feed, content);
				break;
			case CMD.ARC:
				emitArc(cmd, config, paperHeight, feed, content);
				break;
			case CMD.CIRCLE:
				emitCircle(cmd, config, paperHeight, feed, content);
				break;
		}
	}

	content.push('; end paths');
	writeFooter(content);

	return content;
}

/**
 * Export shapes to Gcode string
 * @param {Array} shapes - Array of shape objects to export
 * @param {Paper} paper - Paper object defining the viewport and dimensions
 * @param {Object} options - Optional configuration overrides
 * @returns {string} Gcode document as string
 */
export function exportToGcode(shapes, paper, options = {}) {
	const config = { ...DEFAULT_CONFIG, ...options };

	// Display dimensions for bounds checking
	const displayScale = 100 / (paper.scale || 100);
	const displayWidth = paper.width * displayScale;
	const displayHeight = paper.height * displayScale;

	// Flatten primitives into basic shapes, then collect commands
	const flatShapes = flattenShapes(shapes);
	const allCommands = [];

	for (const shape of flatShapes) {
		// Skip non-exportable shapes
		if (shape.geometry === Shape.PAPER) continue;
		if (shape.geometry === Shape.IMAGE) continue;

		// Skip shapes outside paper bounds
		if (!shapeIntersectsPaper(shape, paper, displayWidth, displayHeight)) continue;

		// Convert shape to command(s)
		const commands = shapeToCommands(shape, paper, config);
		allCommands.push(...commands);
	}

	// Generate Gcode
	const gcode = commandsToGcode(allCommands, config, displayHeight);

	return gcode.join('\n');
}

/**
 * Trigger Gcode download
 * @param {string} gcodeContent - Gcode document string
 * @param {string} fileName - File name for download
 */
export function downloadGcode(gcodeContent, fileName = 'drawing.gcode') {
	const blob = new Blob([gcodeContent], { type: 'text/plain;charset=UTF-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
