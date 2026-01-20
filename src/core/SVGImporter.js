import { Shape, PenStyle } from '../geometry/Geometry.js';
import { Line } from '../geometry/Line.js';
import { Circle } from '../geometry/Circle.js';
import { Arc } from '../geometry/Arc.js';
import { Ellipse } from '../geometry/Ellipse.js';
import { Spline } from '../geometry/Spline.js';
import { Text } from '../geometry/Text.js';

/**
 * SVG Importer - converts SVG files to native shapes
 */

// Parse SVG string and return array of shapes
export function importSVG(svgString, offsetX = 0, offsetY = 0) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgString, 'image/svg+xml');

	// Check for parse errors
	const parseError = doc.querySelector('parsererror');
	if (parseError) {
		console.error('SVG parse error:', parseError.textContent);
		return [];
	}

	const svg = doc.querySelector('svg');
	if (!svg) {
		console.error('No SVG element found');
		return [];
	}

	// Get viewBox for coordinate scaling
	const viewBox = parseViewBox(svg);
	const svgWidth = parseLength(svg.getAttribute('width')) || viewBox.width || 100;
	const svgHeight = parseLength(svg.getAttribute('height')) || viewBox.height || 100;

	// Calculate scale factor (convert to mm if needed)
	const scale = {
		x: 1,
		y: 1,
		offsetX: offsetX - viewBox.x,
		offsetY: offsetY - viewBox.y
	};

	const shapes = [];
	processElement(svg, shapes, scale, getIdentityTransform());

	return shapes;
}

// Parse viewBox attribute
function parseViewBox(svg) {
	const vb = svg.getAttribute('viewBox');
	if (!vb) return { x: 0, y: 0, width: 0, height: 0 };

	const parts = vb.split(/[\s,]+/).map(parseFloat);
	return {
		x: parts[0] || 0,
		y: parts[1] || 0,
		width: parts[2] || 0,
		height: parts[3] || 0
	};
}

// Parse length value (handle units)
function parseLength(str) {
	if (!str) return null;
	const match = str.match(/^([\d.]+)(px|mm|in|pt|cm)?$/);
	if (!match) return parseFloat(str) || null;

	let value = parseFloat(match[1]);
	const unit = match[2] || 'px';

	// Convert to mm (assuming 96 DPI for px)
	switch (unit) {
		case 'mm': return value;
		case 'cm': return value * 10;
		case 'in': return value * 25.4;
		case 'pt': return value * 25.4 / 72;
		case 'px':
		default: return value * 25.4 / 96;
	}
}

// Identity transform matrix
function getIdentityTransform() {
	return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

// Multiply two transform matrices
function multiplyTransform(t1, t2) {
	return {
		a: t1.a * t2.a + t1.c * t2.b,
		b: t1.b * t2.a + t1.d * t2.b,
		c: t1.a * t2.c + t1.c * t2.d,
		d: t1.b * t2.c + t1.d * t2.d,
		e: t1.a * t2.e + t1.c * t2.f + t1.e,
		f: t1.b * t2.e + t1.d * t2.f + t1.f
	};
}

// Apply transform to a point
function transformPoint(x, y, t, scale) {
	const tx = t.a * x + t.c * y + t.e;
	const ty = t.b * x + t.d * y + t.f;
	return {
		x: tx * scale.x + scale.offsetX,
		y: ty * scale.y + scale.offsetY
	};
}

// Parse transform attribute
function parseTransform(str) {
	if (!str) return getIdentityTransform();

	let result = getIdentityTransform();
	const transforms = str.match(/(\w+)\s*\(([^)]+)\)/g) || [];

	for (const transform of transforms) {
		const match = transform.match(/(\w+)\s*\(([^)]+)\)/);
		if (!match) continue;

		const type = match[1];
		const args = match[2].split(/[\s,]+/).map(parseFloat);

		let t = getIdentityTransform();

		switch (type) {
			case 'translate':
				t.e = args[0] || 0;
				t.f = args[1] || 0;
				break;
			case 'scale':
				t.a = args[0] || 1;
				t.d = args[1] !== undefined ? args[1] : t.a;
				break;
			case 'rotate':
				const angle = (args[0] || 0) * Math.PI / 180;
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				if (args.length === 3) {
					// rotate(angle, cx, cy)
					const cx = args[1], cy = args[2];
					t = { a: cos, b: sin, c: -sin, d: cos, e: cx - cos*cx + sin*cy, f: cy - sin*cx - cos*cy };
				} else {
					t = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
				}
				break;
			case 'skewX':
				t.c = Math.tan((args[0] || 0) * Math.PI / 180);
				break;
			case 'skewY':
				t.b = Math.tan((args[0] || 0) * Math.PI / 180);
				break;
			case 'matrix':
				t = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
				break;
		}

		result = multiplyTransform(result, t);
	}

	return result;
}

// Parse stroke style to PenStyle
function parseStrokeStyle(element) {
	const stroke = element.getAttribute('stroke') ||
				   getComputedStyle(element, 'stroke') ||
				   '#000000';
	const dashArray = element.getAttribute('stroke-dasharray');

	if (dashArray && dashArray !== 'none') {
		// Dashed line - could be hidden, centerline, etc.
		return PenStyle.HIDDEN;
	}

	return PenStyle.VISIBLE;
}

// Get computed style from element or its ancestors
function getComputedStyle(element, prop) {
	let el = element;
	while (el && el.getAttribute) {
		const val = el.getAttribute(prop);
		if (val) return val;
		el = el.parentElement;
	}
	return null;
}

// Process an SVG element recursively
function processElement(element, shapes, scale, parentTransform) {
	// Combine with element's own transform
	const localTransform = parseTransform(element.getAttribute('transform'));
	const transform = multiplyTransform(parentTransform, localTransform);

	// Process based on element type
	const tagName = element.tagName.toLowerCase();

	switch (tagName) {
		case 'line':
			processLine(element, shapes, scale, transform);
			break;
		case 'circle':
			processCircle(element, shapes, scale, transform);
			break;
		case 'ellipse':
			processEllipse(element, shapes, scale, transform);
			break;
		case 'rect':
			processRect(element, shapes, scale, transform);
			break;
		case 'path':
			processPath(element, shapes, scale, transform);
			break;
		case 'polyline':
			processPolyline(element, shapes, scale, transform, false);
			break;
		case 'polygon':
			processPolyline(element, shapes, scale, transform, true);
			break;
		case 'text':
			processText(element, shapes, scale, transform);
			break;
	}

	// Process children (g, svg, etc.)
	for (const child of element.children) {
		processElement(child, shapes, scale, transform);
	}
}

// Process <line> element
function processLine(element, shapes, scale, transform) {
	const x1 = parseFloat(element.getAttribute('x1')) || 0;
	const y1 = parseFloat(element.getAttribute('y1')) || 0;
	const x2 = parseFloat(element.getAttribute('x2')) || 0;
	const y2 = parseFloat(element.getAttribute('y2')) || 0;

	const p1 = transformPoint(x1, y1, transform, scale);
	const p2 = transformPoint(x2, y2, transform, scale);

	const line = new Line([p1.x, p1.y, p2.x, p2.y]);
	line.penStyle = parseStrokeStyle(element);
	shapes.push(line);
}

// Process <circle> element
function processCircle(element, shapes, scale, transform) {
	const cx = parseFloat(element.getAttribute('cx')) || 0;
	const cy = parseFloat(element.getAttribute('cy')) || 0;
	const r = parseFloat(element.getAttribute('r')) || 0;

	const center = transformPoint(cx, cy, transform, scale);
	// Note: transform may distort circle into ellipse, ignoring for now
	const radius = r * scale.x;

	const circle = new Circle([center.x, center.y, radius]);
	circle.penStyle = parseStrokeStyle(element);
	shapes.push(circle);
}

// Process <ellipse> element
function processEllipse(element, shapes, scale, transform) {
	const cx = parseFloat(element.getAttribute('cx')) || 0;
	const cy = parseFloat(element.getAttribute('cy')) || 0;
	const rx = parseFloat(element.getAttribute('rx')) || 0;
	const ry = parseFloat(element.getAttribute('ry')) || 0;

	const center = transformPoint(cx, cy, transform, scale);

	const ellipse = new Ellipse([center.x, center.y, rx * scale.x, ry * scale.y]);
	ellipse.penStyle = parseStrokeStyle(element);
	shapes.push(ellipse);
}

// Process <rect> element (as 4 lines)
function processRect(element, shapes, scale, transform) {
	const x = parseFloat(element.getAttribute('x')) || 0;
	const y = parseFloat(element.getAttribute('y')) || 0;
	const width = parseFloat(element.getAttribute('width')) || 0;
	const height = parseFloat(element.getAttribute('height')) || 0;

	const p1 = transformPoint(x, y, transform, scale);
	const p2 = transformPoint(x + width, y, transform, scale);
	const p3 = transformPoint(x + width, y + height, transform, scale);
	const p4 = transformPoint(x, y + height, transform, scale);

	const penStyle = parseStrokeStyle(element);

	// Create 4 lines
	const lines = [
		new Line([p1.x, p1.y, p2.x, p2.y]),
		new Line([p2.x, p2.y, p3.x, p3.y]),
		new Line([p3.x, p3.y, p4.x, p4.y]),
		new Line([p4.x, p4.y, p1.x, p1.y])
	];

	for (const line of lines) {
		line.penStyle = penStyle;
		shapes.push(line);
	}
}

// Process <polyline> or <polygon> element
function processPolyline(element, shapes, scale, transform, closed) {
	const points = element.getAttribute('points');
	if (!points) return;

	const coords = points.trim().split(/[\s,]+/).map(parseFloat);
	if (coords.length < 4) return;

	const penStyle = parseStrokeStyle(element);

	for (let i = 0; i < coords.length - 2; i += 2) {
		const p1 = transformPoint(coords[i], coords[i + 1], transform, scale);
		const p2 = transformPoint(coords[i + 2], coords[i + 3], transform, scale);

		const line = new Line([p1.x, p1.y, p2.x, p2.y]);
		line.penStyle = penStyle;
		shapes.push(line);
	}

	// Close polygon
	if (closed && coords.length >= 4) {
		const p1 = transformPoint(coords[coords.length - 2], coords[coords.length - 1], transform, scale);
		const p2 = transformPoint(coords[0], coords[1], transform, scale);

		const line = new Line([p1.x, p1.y, p2.x, p2.y]);
		line.penStyle = penStyle;
		shapes.push(line);
	}
}

// Process <text> element
function processText(element, shapes, scale, transform) {
	const x = parseFloat(element.getAttribute('x')) || 0;
	const y = parseFloat(element.getAttribute('y')) || 0;
	const content = element.textContent || '';

	if (!content.trim()) return;

	const pos = transformPoint(x, y, transform, scale);

	const fontSize = parseFloat(element.getAttribute('font-size')) || 12;
	const fontFamily = element.getAttribute('font-family') || 'sans-serif';

	const text = new Text([pos.x, pos.y, content]);
	text.fontSize = fontSize;
	text.fontFamily = fontFamily;
	shapes.push(text);
}

// Process <path> element
function processPath(element, shapes, scale, transform) {
	const d = element.getAttribute('d');
	if (!d) return;

	const penStyle = parseStrokeStyle(element);
	const commands = parsePath(d);

	let currentX = 0, currentY = 0;
	let startX = 0, startY = 0;
	let lastControlX = 0, lastControlY = 0;

	for (const cmd of commands) {
		const type = cmd.type;
		const args = cmd.args;
		const relative = cmd.relative;

		switch (type) {
			case 'M': // Move to
				if (relative) {
					currentX += args[0];
					currentY += args[1];
				} else {
					currentX = args[0];
					currentY = args[1];
				}
				startX = currentX;
				startY = currentY;

				// Handle implicit lineto commands after M
				for (let i = 2; i < args.length; i += 2) {
					const x = relative ? currentX + args[i] : args[i];
					const y = relative ? currentY + args[i + 1] : args[i + 1];

					const p1 = transformPoint(currentX, currentY, transform, scale);
					const p2 = transformPoint(x, y, transform, scale);

					const line = new Line([p1.x, p1.y, p2.x, p2.y]);
					line.penStyle = penStyle;
					shapes.push(line);

					currentX = x;
					currentY = y;
				}
				break;

			case 'L': // Line to
				for (let i = 0; i < args.length; i += 2) {
					const x = relative ? currentX + args[i] : args[i];
					const y = relative ? currentY + args[i + 1] : args[i + 1];

					const p1 = transformPoint(currentX, currentY, transform, scale);
					const p2 = transformPoint(x, y, transform, scale);

					const line = new Line([p1.x, p1.y, p2.x, p2.y]);
					line.penStyle = penStyle;
					shapes.push(line);

					currentX = x;
					currentY = y;
				}
				break;

			case 'H': // Horizontal line
				for (const arg of args) {
					const x = relative ? currentX + arg : arg;

					const p1 = transformPoint(currentX, currentY, transform, scale);
					const p2 = transformPoint(x, currentY, transform, scale);

					const line = new Line([p1.x, p1.y, p2.x, p2.y]);
					line.penStyle = penStyle;
					shapes.push(line);

					currentX = x;
				}
				break;

			case 'V': // Vertical line
				for (const arg of args) {
					const y = relative ? currentY + arg : arg;

					const p1 = transformPoint(currentX, currentY, transform, scale);
					const p2 = transformPoint(currentX, y, transform, scale);

					const line = new Line([p1.x, p1.y, p2.x, p2.y]);
					line.penStyle = penStyle;
					shapes.push(line);

					currentY = y;
				}
				break;

			case 'C': // Cubic bezier
				for (let i = 0; i < args.length; i += 6) {
					const x1 = relative ? currentX + args[i] : args[i];
					const y1 = relative ? currentY + args[i + 1] : args[i + 1];
					const x2 = relative ? currentX + args[i + 2] : args[i + 2];
					const y2 = relative ? currentY + args[i + 3] : args[i + 3];
					const x = relative ? currentX + args[i + 4] : args[i + 4];
					const y = relative ? currentY + args[i + 5] : args[i + 5];

					const p0 = transformPoint(currentX, currentY, transform, scale);
					const p1 = transformPoint(x1, y1, transform, scale);
					const p2 = transformPoint(x2, y2, transform, scale);
					const p3 = transformPoint(x, y, transform, scale);

					const spline = new Spline([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
					spline.penStyle = penStyle;
					shapes.push(spline);

					lastControlX = x2;
					lastControlY = y2;
					currentX = x;
					currentY = y;
				}
				break;

			case 'S': // Smooth cubic bezier
				for (let i = 0; i < args.length; i += 4) {
					// Reflect last control point
					const x1 = 2 * currentX - lastControlX;
					const y1 = 2 * currentY - lastControlY;
					const x2 = relative ? currentX + args[i] : args[i];
					const y2 = relative ? currentY + args[i + 1] : args[i + 1];
					const x = relative ? currentX + args[i + 2] : args[i + 2];
					const y = relative ? currentY + args[i + 3] : args[i + 3];

					const p0 = transformPoint(currentX, currentY, transform, scale);
					const p1 = transformPoint(x1, y1, transform, scale);
					const p2 = transformPoint(x2, y2, transform, scale);
					const p3 = transformPoint(x, y, transform, scale);

					const spline = new Spline([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
					spline.penStyle = penStyle;
					shapes.push(spline);

					lastControlX = x2;
					lastControlY = y2;
					currentX = x;
					currentY = y;
				}
				break;

			case 'Q': // Quadratic bezier - convert to cubic
				for (let i = 0; i < args.length; i += 4) {
					const qx1 = relative ? currentX + args[i] : args[i];
					const qy1 = relative ? currentY + args[i + 1] : args[i + 1];
					const x = relative ? currentX + args[i + 2] : args[i + 2];
					const y = relative ? currentY + args[i + 3] : args[i + 3];

					// Convert quadratic to cubic control points
					const cx1 = currentX + 2/3 * (qx1 - currentX);
					const cy1 = currentY + 2/3 * (qy1 - currentY);
					const cx2 = x + 2/3 * (qx1 - x);
					const cy2 = y + 2/3 * (qy1 - y);

					const p0 = transformPoint(currentX, currentY, transform, scale);
					const p1 = transformPoint(cx1, cy1, transform, scale);
					const p2 = transformPoint(cx2, cy2, transform, scale);
					const p3 = transformPoint(x, y, transform, scale);

					const spline = new Spline([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]);
					spline.penStyle = penStyle;
					shapes.push(spline);

					lastControlX = qx1;
					lastControlY = qy1;
					currentX = x;
					currentY = y;
				}
				break;

			case 'A': // Arc - convert to line segments or arcs
				for (let i = 0; i < args.length; i += 7) {
					const rx = args[i];
					const ry = args[i + 1];
					const rotation = args[i + 2] * Math.PI / 180;
					const largeArc = args[i + 3];
					const sweep = args[i + 4];
					const x = relative ? currentX + args[i + 5] : args[i + 5];
					const y = relative ? currentY + args[i + 6] : args[i + 6];

					// Convert arc to line segments (simplified approach)
					const arcShapes = convertArcToShapes(
						currentX, currentY, x, y,
						rx, ry, rotation, largeArc, sweep,
						transform, scale, penStyle
					);
					shapes.push(...arcShapes);

					currentX = x;
					currentY = y;
				}
				break;

			case 'Z': // Close path
				if (currentX !== startX || currentY !== startY) {
					const p1 = transformPoint(currentX, currentY, transform, scale);
					const p2 = transformPoint(startX, startY, transform, scale);

					const line = new Line([p1.x, p1.y, p2.x, p2.y]);
					line.penStyle = penStyle;
					shapes.push(line);
				}
				currentX = startX;
				currentY = startY;
				break;
		}
	}
}

// Parse SVG path d attribute
function parsePath(d) {
	const commands = [];
	const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
	let match;

	while ((match = regex.exec(d)) !== null) {
		const type = match[1].toUpperCase();
		const relative = match[1] !== match[1].toUpperCase();
		const argsStr = match[2].trim();

		let args = [];
		if (argsStr) {
			// Handle negative numbers and comma/space separation
			args = argsStr.match(/-?[\d.]+(?:e[-+]?\d+)?/gi)?.map(parseFloat) || [];
		}

		commands.push({ type, args, relative });
	}

	return commands;
}

// Convert SVG arc to shapes (simplified - uses line approximation for complex cases)
function convertArcToShapes(x1, y1, x2, y2, rx, ry, rotation, largeArc, sweep, transform, scale, penStyle) {
	const shapes = [];

	// Handle degenerate cases
	if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) {
		const p1 = transformPoint(x1, y1, transform, scale);
		const p2 = transformPoint(x2, y2, transform, scale);
		const line = new Line([p1.x, p1.y, p2.x, p2.y]);
		line.penStyle = penStyle;
		shapes.push(line);
		return shapes;
	}

	// For circular arcs with no rotation, create proper Arc
	if (Math.abs(rx - ry) < 0.001 && Math.abs(rotation) < 0.001) {
		const result = computeArcCenter(x1, y1, x2, y2, rx, largeArc, sweep);
		if (result) {
			const center = transformPoint(result.cx, result.cy, transform, scale);
			const p1t = transformPoint(x1, y1, transform, scale);
			const p2t = transformPoint(x2, y2, transform, scale);

			const startAngle = Math.atan2(p1t.y - center.y, p1t.x - center.x);
			const endAngle = Math.atan2(p2t.y - center.y, p2t.x - center.x);

			const arc = new Arc([center.x, center.y, rx * scale.x, startAngle, endAngle]);
			arc.penStyle = penStyle;
			shapes.push(arc);
			return shapes;
		}
	}

	// Fallback: approximate with line segments
	const segments = 16;
	let prevX = x1, prevY = y1;

	for (let i = 1; i <= segments; i++) {
		const t = i / segments;
		const x = x1 + (x2 - x1) * t;
		const y = y1 + (y2 - y1) * t;

		const p1 = transformPoint(prevX, prevY, transform, scale);
		const p2 = transformPoint(x, y, transform, scale);

		const line = new Line([p1.x, p1.y, p2.x, p2.y]);
		line.penStyle = penStyle;
		shapes.push(line);

		prevX = x;
		prevY = y;
	}

	return shapes;
}

// Compute arc center from SVG arc parameters
function computeArcCenter(x1, y1, x2, y2, r, largeArc, sweep) {
	const dx = (x1 - x2) / 2;
	const dy = (y1 - y2) / 2;

	let d = dx * dx + dy * dy;
	let sq = (r * r) / d - 1;

	if (sq < 0) {
		// Radius too small, scale up
		r = Math.sqrt(d);
		sq = 0;
	}

	sq = Math.sqrt(sq) * (largeArc === sweep ? -1 : 1);

	const cx = (x1 + x2) / 2 + sq * dy;
	const cy = (y1 + y2) / 2 - sq * dx;

	return { cx, cy };
}

// Trigger file picker and import SVG
export function openSVGFile(callback) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.svg';

	input.onchange = (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const svgString = event.target.result;
			const shapes = importSVG(svgString);
			callback(shapes, file.name);
		};
		reader.readAsText(file);
	};

	input.click();
}
