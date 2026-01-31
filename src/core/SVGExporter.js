import { Shape, PenStyle } from '../geometry/Geometry.js';
import data from '../data/Data.js';

/**
 * Convert shapes to SVG format for export
 */

// Pen style to SVG stroke attributes
function penStyleToSVG(penStyle) {
	switch (penStyle) {
		case PenStyle.VISIBLE:
			return { stroke: '#000000', strokeWidth: 0.5, dashArray: null };
		case PenStyle.CONSTRUCTION:
			return { stroke: '#888888', strokeWidth: 0.25, dashArray: '2,2' };
		case PenStyle.CENTERLINE:
			return { stroke: '#000000', strokeWidth: 0.25, dashArray: '8,2,2,2' };
		case PenStyle.HIDDEN:
			return { stroke: '#000000', strokeWidth: 0.35, dashArray: '3,2' };
		case PenStyle.PHANTOM:
			return { stroke: '#000000', strokeWidth: 0.25, dashArray: '10,2,2,2,2,2' };
		case PenStyle.OUTLINE:
			return { stroke: '#000000', strokeWidth: 0.7, dashArray: null };
		case PenStyle.DIMENSION:
			return { stroke: '#0066CC', strokeWidth: 0.35, dashArray: null };
		default:
			return { stroke: '#000000', strokeWidth: 0.5, dashArray: null };
	}
}

// Get shape color (from token or pen style default)
function getShapeColor(shape) {
	if (shape.colorToken) {
		const token = data.getColorToken(shape.colorToken);
		if (token) return token.color;
	}
	return penStyleToSVG(shape.penStyle).stroke;
}

// Build SVG style string from shape (uses color token if present)
function buildStyleAttr(shape) {
	const penStyle = penStyleToSVG(shape.penStyle);
	const color = getShapeColor(shape);
	let attrs = `stroke="${color}" stroke-width="${penStyle.strokeWidth}" fill="none"`;
	if (penStyle.dashArray) {
		attrs += ` stroke-dasharray="${penStyle.dashArray}"`;
	}
	return attrs;
}

// Transform world coordinates to paper-relative coordinates
function worldToPaper(worldX, worldY, paper) {
	return {
		x: worldX - paper.x,
		y: worldY - paper.y
	};
}

// Convert a single shape to SVG element string
function shapeToSVG(shape, paper) {
	const style = buildStyleAttr(shape);

	switch (shape.geometry) {
		case Shape.LINE: {
			const start = worldToPaper(shape.start.x, shape.start.y, paper);
			const end = worldToPaper(shape.end.x, shape.end.y, paper);
			return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" ${style}/>`;
		}

		case Shape.CIRCLE: {
			const center = worldToPaper(shape.x, shape.y, paper);
			return `<circle cx="${center.x}" cy="${center.y}" r="${shape.radius}" ${style}/>`;
		}

		case Shape.ARC: {
			const center = worldToPaper(shape.x, shape.y, paper);
			const r = shape.radius;
			const startAngle = shape.startAngle;
			const endAngle = shape.endAngle;

			// Calculate start and end points
			const startX = center.x + Math.cos(startAngle) * r;
			const startY = center.y + Math.sin(startAngle) * r;
			const endX = center.x + Math.cos(endAngle) * r;
			const endY = center.y + Math.sin(endAngle) * r;

			// Determine arc sweep
			let sweep = endAngle - startAngle;
			if (sweep < 0) sweep += Math.PI * 2;
			const largeArc = sweep > Math.PI ? 1 : 0;
			const sweepFlag = 1; // Clockwise

			return `<path d="M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${endX} ${endY}" ${style}/>`;
		}

		case Shape.TANGENT_ARC: {
			// Similar to ARC but uses the calculated center and angles
			const center = worldToPaper(shape.x, shape.y, paper);
			const r = shape.radius;

			if (r <= 0) return '';

			const startAngle = shape.startAngle;
			const endAngle = shape.endAngle;

			const startX = center.x + Math.cos(startAngle) * r;
			const startY = center.y + Math.sin(startAngle) * r;
			const endX = center.x + Math.cos(endAngle) * r;
			const endY = center.y + Math.sin(endAngle) * r;

			let sweep = endAngle - startAngle;
			if (sweep < 0) sweep += Math.PI * 2;
			const largeArc = sweep > Math.PI ? 1 : 0;
			const sweepFlag = 1;

			return `<path d="M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${endX} ${endY}" ${style}/>`;
		}

		case Shape.ELLIPSE: {
			const center = worldToPaper(shape.x, shape.y, paper);
			if (shape.rotation === 0) {
				return `<ellipse cx="${center.x}" cy="${center.y}" rx="${shape.radiusX}" ry="${shape.radiusY}" ${style}/>`;
			} else {
				// Rotated ellipse
				const rotDeg = shape.rotation * 180 / Math.PI;
				return `<ellipse cx="${center.x}" cy="${center.y}" rx="${shape.radiusX}" ry="${shape.radiusY}" transform="rotate(${rotDeg} ${center.x} ${center.y})" ${style}/>`;
			}
		}

		case Shape.SPLINE: {
			// Cubic Bezier spline
			const p0 = worldToPaper(shape.p0.x, shape.p0.y, paper);
			const p1 = worldToPaper(shape.p1.x, shape.p1.y, paper);
			const p2 = worldToPaper(shape.p2.x, shape.p2.y, paper);
			const p3 = worldToPaper(shape.p3.x, shape.p3.y, paper);
			return `<path d="M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}" ${style}/>`;
		}

		case Shape.TEXT: {
			const pos = worldToPaper(shape.x, shape.y, paper);
			const fontSize = shape.fontSize || 12;
			const fontFamily = shape.fontFamily || 'sans-serif';
			const fontWeight = shape.fontWeight || 'normal';
			const fontStyle = shape.fontStyle || 'normal';

			let textAnchor = 'start';
			if (shape.alignment === 'center') textAnchor = 'middle';
			else if (shape.alignment === 'right') textAnchor = 'end';

			// SVG text baseline is different, adjust y position
			const textY = pos.y + fontSize * 0.85;

			let transform = '';
			if (shape.rotation) {
				const rotDeg = shape.rotation * 180 / Math.PI;
				transform = ` transform="rotate(${rotDeg} ${pos.x} ${pos.y})"`;
			}

			return `<text x="${pos.x}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${textAnchor}" fill="#000000"${transform}>${escapeXML(shape.text)}</text>`;
		}

		case Shape.DIMENSION: {
			// Dimension lines are complex - export as group of lines and text
			const startPt = worldToPaper(shape.startPoint.x, shape.startPoint.y, paper);
			const endPt = worldToPaper(shape.endPoint.x, shape.endPoint.y, paper);
			const textPt = worldToPaper(shape.textPoint.x, shape.textPoint.y, paper);

			let svg = '<g>';
			// Main dimension line
			svg += `<line x1="${startPt.x}" y1="${startPt.y}" x2="${endPt.x}" y2="${endPt.y}" ${style}/>`;
			// Text
			svg += `<text x="${textPt.x}" y="${textPt.y}" font-family="sans-serif" font-size="10" text-anchor="middle" fill="#0066CC">${shape.displayValue || ''}</text>`;
			svg += '</g>';
			return svg;
		}

		case Shape.IMAGE:
			// Images not exported to SVG (could embed as base64 but skip for now)
			return '';

		case Shape.PAPER:
			// Paper itself is not exported
			return '';

		default:
			console.warn('SVG export: Unknown geometry type', shape.geometry);
			return '';
	}
}

// Escape XML special characters
function escapeXML(str) {
	if (!str) return '';
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

// Flatten primitives into basic shapes (lines, arcs, etc.)
// Primitives like Slot, Board, Polygon decompose into basic geometry
function flattenShapes(shapes) {
	const result = [];
	for (const shape of shapes) {
		if (shape.createShapes) {
			// Slot returns lines + arcs
			result.push(...shape.createShapes());
		} else if (shape.createLines) {
			// Board, Polygon return lines
			result.push(...shape.createLines());
		} else {
			result.push(shape);
		}
	}
	return result;
}

// Check if shape bounds intersect with paper display bounds
function shapeIntersectsPaper(shape, paper, displayWidth, displayHeight) {
	if (!shape.bounds) return true; // Include if no bounds info

	const paperRight = paper.x + displayWidth;
	const paperBottom = paper.y + displayHeight;
	const shapeRight = shape.bounds.x + shape.bounds.width;
	const shapeBottom = shape.bounds.y + shape.bounds.height;

	// Check for no overlap
	if (shape.bounds.x >= paperRight || shapeRight <= paper.x ||
		shape.bounds.y >= paperBottom || shapeBottom <= paper.y) {
		return false;
	}
	return true;
}

/**
 * Export shapes to SVG string
 * @param {Array} shapes - Array of shape objects to export
 * @param {Paper} paper - Paper object defining the viewport
 * @returns {string} SVG document as string
 */
export function exportToSVG(shapes, paper) {
	// Display dimensions: 50% scale = 2x display size
	const displayScale = 100 / (paper.scale || 100);
	const displayWidth = paper.width * displayScale;
	const displayHeight = paper.height * displayScale;

	// Output dimensions: actual paper size (what gets printed)
	// SVG header with paper dimensions, viewBox covers display area
	let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${paper.width}mm"
     height="${paper.height}mm"
     viewBox="0 0 ${displayWidth} ${displayHeight}">
`;

	// Define clip path for display bounds
	svg += `  <defs>
    <clipPath id="paper-clip">
      <rect x="0" y="0" width="${displayWidth}" height="${displayHeight}"/>
    </clipPath>
  </defs>
`;

	// Content group with clipping
	svg += `  <g clip-path="url(#paper-clip)">
`;

	// Flatten primitives into basic shapes, then filter and convert
	const flatShapes = flattenShapes(shapes);

	for (const shape of flatShapes) {
		if (shape.geometry === Shape.PAPER) continue;
		if (shape.geometry === Shape.IMAGE) continue;
		if (!shapeIntersectsPaper(shape, paper, displayWidth, displayHeight)) continue;

		const shapeSVG = shapeToSVG(shape, paper);
		if (shapeSVG) {
			svg += `    ${shapeSVG}\n`;
		}
	}

	svg += `  </g>
</svg>`;

	return svg;
}

/**
 * Trigger SVG download
 * @param {string} svgContent - SVG document string
 * @param {string} fileName - File name for download
 */
export function downloadSVG(svgContent, fileName = 'drawing.svg') {
	const blob = new Blob([svgContent], { type: 'image/svg+xml' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
