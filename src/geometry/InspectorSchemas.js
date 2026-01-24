/**
 * Inspector schema definitions for all geometry types.
 * Each builder function takes a shape instance and returns the schema.
 * This centralizes UI metadata while keeping geometry classes focused on math.
 */

import { PaperSizes } from './Paper.js';
import data from '../data/Data.js';
import stage from '../core/Stage.js';
import undoManager from '../core/UndoManager.js';
import { DeleteShapesCommand, AddShapesCommand, ApplyLayoutCommand } from '../core/Commands.js';

// Common field templates
const positionFields = (prefix = '') => [
	{ key: `${prefix}x`, label: 'X', type: 'number', precision: 2, step: 1 },
	{ key: `${prefix}y`, label: 'Y', type: 'number', precision: 2, step: 1 }
];

const pointFields = (prefix, label) => ({
	title: label,
	fields: [
		{ key: `${prefix}.x`, label: 'X', type: 'number', precision: 2, step: 1 },
		{ key: `${prefix}.y`, label: 'Y', type: 'number', precision: 2, step: 1 }
	]
});

// Schema builders by geometry type

export function lineSchema(shape) {
	return {
		name: 'Line',
		sections: [
			{
				title: 'Dimensions',
				fields: [
					{
						key: 'length',
						label: 'Length',
						type: 'length',
						get: () => shape.length(),
						set: (v) => shape.scaleToDim(v),
						min: 0.1
					},
					{
						key: 'angle',
						label: 'Angle',
						type: 'readonly',
						get: () => shape.getAngleDeg(),
						precision: 1,
						suffix: '°'
					}
				]
			},
			pointFields('start', 'Start Point'),
			pointFields('end', 'End Point')
		]
	};
}

export function circleSchema(shape) {
	return {
		name: 'Circle',
		sections: [
			{
				title: 'Dimensions',
				fields: [
					{
						key: 'radius',
						label: 'Radius',
						type: 'length',
						get: () => shape.radius,
						set: (v) => { shape.radius = v; },
						min: 0.1
					},
					{
						key: 'diameter',
						label: 'Diameter',
						type: 'length',
						get: () => shape.radius * 2,
						set: (v) => { shape.radius = v / 2; },
						min: 0.1
					},
					{
						key: 'circumference',
						label: 'Circumference',
						type: 'readonly-length',
						get: () => shape.length()
					},
					{
						key: 'area',
						label: 'Area',
						type: 'readonly',
						get: () => Math.PI * shape.radius * shape.radius,
						precision: 2,
						suffix: ' mm²'
					}
				]
			},
			{
				title: 'Center',
				fields: positionFields()
			}
		]
	};
}

export function arcSchema(shape) {
	return {
		name: 'Arc',
		sections: [
			{
				title: 'Dimensions',
				fields: [
					{
						key: 'radius',
						label: 'Radius',
						type: 'length',
						get: () => shape.radius,
						set: (v) => { shape.radius = v; },
						min: 0.1
					},
					{
						key: 'arcLength',
						label: 'Arc Length',
						type: 'readonly-length',
						get: () => shape.length()
					}
				]
			},
			{
				title: 'Angles',
				fields: [
					{
						key: 'startAngleDeg',
						label: 'Start',
						type: 'number',
						get: () => shape.startAngle * 180 / Math.PI,
						set: (v) => { shape.startAngle = v * Math.PI / 180; },
						precision: 1,
						step: 1,
						suffix: '°'
					},
					{
						key: 'endAngleDeg',
						label: 'End',
						type: 'number',
						get: () => shape.endAngle * 180 / Math.PI,
						set: (v) => { shape.endAngle = v * Math.PI / 180; },
						precision: 1,
						step: 1,
						suffix: '°'
					}
				]
			},
			{
				title: 'Center',
				fields: positionFields()
			}
		]
	};
}

export function tangentArcSchema(shape) {
	return {
		name: 'Tangent Arc',
		sections: [
			{
				title: 'Dimensions',
				fields: [
					{
						key: 'radius',
						label: 'Radius',
						type: 'readonly-length',
						get: () => shape.radius
					},
					{
						key: 'arcLength',
						label: 'Arc Length',
						type: 'readonly-length',
						get: () => shape.length()
					}
				]
			},
			pointFields('startPoint', 'Start Point'),
			pointFields('tangentPoint', 'Tangent Handle'),
			pointFields('endPoint', 'End Point')
		]
	};
}

export function ellipseSchema(shape) {
	return {
		name: 'Ellipse',
		sections: [
			{
				title: 'Dimensions',
				fields: [
					{
						key: 'radiusX',
						label: 'Radius X',
						type: 'length',
						get: () => shape.radiusX,
						set: (v) => { shape.radiusX = v; },
						min: 0.1
					},
					{
						key: 'radiusY',
						label: 'Radius Y',
						type: 'length',
						get: () => shape.radiusY,
						set: (v) => { shape.radiusY = v; },
						min: 0.1
					},
					{
						key: 'perimeter',
						label: 'Perimeter',
						type: 'readonly-length',
						get: () => shape.length()
					}
				]
			},
			{
				title: 'Center',
				fields: positionFields()
			},
			{
				title: 'Rotation',
				fields: [
					{
						key: 'rotationDeg',
						label: 'Angle',
						type: 'number',
						get: () => shape.rotation * 180 / Math.PI,
						set: (v) => { shape.rotation = v * Math.PI / 180; },
						precision: 1,
						step: 1,
						suffix: '°'
					}
				]
			}
		]
	};
}

export function splineSchema(shape) {
	return {
		name: 'Spline',
		sections: [
			{
				title: 'Dimensions',
				fields: [
					{
						key: 'arcLength',
						label: 'Length',
						type: 'readonly-length',
						get: () => shape.length()
					}
				]
			},
			pointFields('p0', 'Start Point (P0)'),
			pointFields('p1', 'Handle 1 (P1)'),
			pointFields('p2', 'Handle 2 (P2)'),
			pointFields('p3', 'End Point (P3)')
		]
	};
}

export function paperSchema(shape) {
	const sizeOptions = Object.entries(PaperSizes).map(([key, size]) => ({
		value: key.toLowerCase(),
		label: `${size.name} (${size.width} × ${size.height} mm)`
	}));
	sizeOptions.push({ value: 'custom', label: 'Custom' });

	return {
		name: 'Paper',
		sections: [
			{
				title: 'Size',
				fields: [
					{
						key: 'paperSize',
						label: 'Preset',
						type: 'select',
						options: sizeOptions,
						set: (v) => {
							shape.paperSize = v;
							const preset = PaperSizes[v.toUpperCase()];
							if (preset) {
								shape.width = preset.width;
								shape.height = preset.height;
							}
						}
					},
					{
						key: 'width',
						label: 'Width',
						type: 'length',
						get: () => shape.width,
						set: (v) => { shape.width = v; shape.paperSize = 'custom'; },
						min: 10
					},
					{
						key: 'height',
						label: 'Height',
						type: 'length',
						get: () => shape.height,
						set: (v) => { shape.height = v; shape.paperSize = 'custom'; },
						min: 10
					}
				]
			},
			{
				title: 'Position',
				fields: positionFields()
			},
			{
				title: 'Export',
				fields: [
					{
						key: 'scale',
						label: 'Scale',
						type: 'number',
						precision: 0,
						step: 10,
						min: 10,
						max: 1000,
						suffix: '%'
					}
				]
			}
		]
	};
}

export function dimensionSchema(shape) {
	return {
		name: 'Dimension',
		sections: [
			{
				title: 'Value',
				fields: [
					{
						key: 'value',
						label: 'Distance',
						type: 'readonly-length',
						get: () => shape.value
					}
				]
			},
			{
				title: 'Position',
				fields: [
					{
						key: 'offset',
						label: 'Offset',
						type: 'number',
						precision: 1,
						step: 5
					}
				]
			}
		]
	};
}

export function radialDimensionSchema(shape) {
	return {
		name: shape.mode === 'diameter' ? 'Diameter Dimension' : 'Radius Dimension',
		sections: [
			{
				title: 'Value',
				fields: [
					{
						key: 'value',
						label: shape.mode === 'diameter' ? 'Diameter' : 'Radius',
						type: 'readonly-length',
						get: () => shape.value
					},
					{
						key: 'mode',
						label: 'Mode',
						type: 'select',
						options: [
							{ value: 'radius', label: 'Radius' },
							{ value: 'diameter', label: 'Diameter' }
						],
						get: () => shape.mode,
						set: (v) => { shape.mode = v; shape.update(); }
					}
				]
			},
			{
				title: 'Position',
				fields: [
					{
						key: 'angleDeg',
						label: 'Angle',
						type: 'number',
						get: () => shape.angle * 180 / Math.PI,
						set: (v) => { shape.angle = v * Math.PI / 180; shape.update(); },
						precision: 1,
						step: 5,
						suffix: '°'
					},
					{
						key: 'textOffset',
						label: 'Text Offset',
						type: 'number',
						precision: 1,
						step: 5,
						min: 0
					}
				]
			}
		]
	};
}

export function angleDimensionSchema(shape) {
	return {
		name: 'Angle Dimension',
		sections: [
			{
				title: 'Value',
				fields: [
					{
						key: 'value',
						label: 'Angle',
						type: 'readonly',
						get: () => shape.value,
						precision: 2,
						suffix: '°'
					}
				]
			},
			{
				title: 'Position',
				fields: [
					{
						key: 'arcRadius',
						label: 'Radius',
						type: 'number',
						precision: 1,
						step: 5,
						min: 10
					},
					{
						key: 'vertexX',
						label: 'Vertex X',
						type: 'number',
						get: () => shape.vertex.x,
						set: (v) => { shape.vertex.x = v; shape.update(); },
						precision: 2
					},
					{
						key: 'vertexY',
						label: 'Vertex Y',
						type: 'number',
						get: () => shape.vertex.y,
						set: (v) => { shape.vertex.y = v; shape.update(); },
						precision: 2
					}
				]
			}
		]
	};
}

export function symbolSchema(shape) {
	const sourceGroup = shape.getSourceGroup();
	const symbolName = sourceGroup ? sourceGroup.symbolName : 'Instance';

	return {
		name: symbolName,
		sections: [
			{
				title: 'Offset',
				fields: [
					{ key: 'offsetX', label: 'Offset X', type: 'number', precision: 2, step: 1 },
					{ key: 'offsetY', label: 'Offset Y', type: 'number', precision: 2, step: 1 }
				]
			},
			{
				title: 'Instance',
				fields: [
					{
						key: 'sourceName',
						label: 'Source',
						type: 'readonly',
						get: () => symbolName
					},
					{
						key: 'sourceGroupId',
						label: 'Source ID',
						type: 'readonly',
						get: () => shape.sourceGroupId || '(none)'
					},
					{
						key: 'explode',
						label: 'Break Apart',
						type: 'button',
						action: (instance) => {
							// Import here to avoid circular dependency
							const { BreakApartInstanceCommand } = require('../core/Commands.js');
							undoManager.execute(new BreakApartInstanceCommand(instance));
							stage.render();
						}
					}
				]
			}
		]
	};
}

export function polygonSchema(shape) {
	return {
		name: 'Polygon',
		sections: [
			{
				title: 'Dimensions',
				fields: [
					{
						key: 'sides',
						label: 'Sides',
						type: 'number',
						get: () => shape.sides,
						set: (v) => { shape.sides = Math.max(3, Math.round(v)); },
						min: 3,
						max: 100,
						step: 1,
						precision: 0
					},
					{
						key: 'radius',
						label: 'Radius',
						type: 'length',
						get: () => shape.radius,
						set: (v) => { shape.radius = v; },
						min: 0.1
					},
					{
						key: 'diameter',
						label: 'Diameter',
						type: 'length',
						get: () => shape.radius * 2,
						set: (v) => { shape.radius = v / 2; },
						min: 0.1
					},
					{
						key: 'perimeter',
						label: 'Perimeter',
						type: 'readonly-length',
						get: () => shape.length()
					},
					{
						key: 'area',
						label: 'Area',
						type: 'readonly',
						get: () => shape.getArea(),
						precision: 2,
						suffix: ' mm²'
					},
					{
						key: 'interiorAngle',
						label: 'Interior Angle',
						type: 'readonly',
						get: () => shape.getInteriorAngle(),
						precision: 1,
						suffix: '°'
					}
				]
			},
			{
				title: 'Center',
				fields: positionFields()
			},
			{
				title: 'Actions',
				fields: [
					{
						key: 'breakApart',
						label: 'Break Apart',
						type: 'button',
						action: (polygon) => {
							const { BreakApartPolygonCommand } = require('../core/Commands.js');
							undoManager.execute(new BreakApartPolygonCommand(polygon));
							stage.render();
						}
					}
				]
			}
		]
	};
}

export function groupSchema(groupId) {
	const group = data.groups.get(groupId);
	if (!group) return null;

	// Count items in group
	const directShapes = data.getDirectGroupShapes(groupId);
	const childGroups = data.getChildGroupIds(groupId);
	const itemCount = directShapes.length + childGroups.length;

	return {
		name: 'Group',
		sections: [
			{
				title: 'Info',
				fields: [
					{
						key: 'itemCount',
						label: 'Items',
						type: 'readonly',
						get: () => itemCount
					}
				]
			},
			{
				title: 'Auto-Layout',
				fields: [
					{
						key: 'layout.mode',
						label: 'Direction',
						type: 'select',
						options: [
							{ value: 'none', label: 'None' },
							{ value: 'row', label: 'Horizontal' },
							{ value: 'column', label: 'Vertical' }
						],
						get: () => group.layout.mode,
						set: (v) => { group.layout.mode = v; }
					},
					{
						key: 'layout.gap',
						label: 'Gap',
						type: 'length',
						get: () => group.layout.gap,
						set: (v) => { group.layout.gap = v; },
						min: 0
					},
					{
						key: 'layout.alignment',
						label: 'Align',
						type: 'select',
						options: [
							{ value: 'start', label: 'Start' },
							{ value: 'center', label: 'Center' },
							{ value: 'end', label: 'End' }
						],
						get: () => group.layout.alignment,
						set: (v) => { group.layout.alignment = v; }
					},
					{
						key: 'layout.distribution',
						label: 'Distribute',
						type: 'select',
						options: [
							{ value: 'none', label: 'Fixed Gap' },
							{ value: 'space-between', label: 'Space Between' },
							{ value: 'space-around', label: 'Space Around' }
						],
						get: () => group.layout.distribution,
						set: (v) => { group.layout.distribution = v; }
					},
					{
						key: 'applyLayout',
						label: 'Apply Layout',
						type: 'button',
						action: () => {
							if (group.layout.mode !== 'none') {
								undoManager.execute(new ApplyLayoutCommand(groupId));
								stage.render();
							}
						}
					}
				]
			}
		]
	};
}
