/**
 * Inspector schema definitions for all geometry types.
 * Each builder function takes a shape instance and returns the schema.
 * This centralizes UI metadata while keeping geometry classes focused on math.
 */

import { PaperSizes } from './Paper.js';
import data from '../data/Data.js';
import stage from '../core/Stage.js';
import undoManager from '../core/UndoManager.js';
import { DeleteShapesCommand, AddShapesCommand } from '../core/Commands.js';

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
						type: 'number',
						get: () => shape.length(),
						set: (v) => shape.scaleToDim(v),
						precision: 2,
						step: 1,
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
						type: 'number',
						precision: 2,
						step: 1,
						min: 0.1
					},
					{
						key: 'diameter',
						label: 'Diameter',
						type: 'number',
						get: () => shape.radius * 2,
						set: (v) => { shape.radius = v / 2; },
						precision: 2,
						step: 1,
						min: 0.1
					},
					{
						key: 'circumference',
						label: 'Circumference',
						type: 'readonly',
						get: () => shape.length(),
						precision: 2
					},
					{
						key: 'area',
						label: 'Area',
						type: 'readonly',
						get: () => Math.PI * shape.radius * shape.radius,
						precision: 2
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
						type: 'number',
						precision: 2,
						step: 1,
						min: 0.1
					},
					{
						key: 'arcLength',
						label: 'Arc Length',
						type: 'readonly',
						get: () => shape.length(),
						precision: 2
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
						type: 'readonly',
						get: () => shape.radius,
						precision: 2
					},
					{
						key: 'arcLength',
						label: 'Arc Length',
						type: 'readonly',
						get: () => shape.length(),
						precision: 2
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
						type: 'number',
						precision: 2,
						step: 1,
						min: 0.1
					},
					{
						key: 'radiusY',
						label: 'Radius Y',
						type: 'number',
						precision: 2,
						step: 1,
						min: 0.1
					},
					{
						key: 'perimeter',
						label: 'Perimeter',
						type: 'readonly',
						get: () => shape.length(),
						precision: 2
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
						type: 'readonly',
						get: () => shape.length(),
						precision: 2
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
						type: 'number',
						precision: 1,
						step: 1,
						min: 10,
						suffix: ' mm'
					},
					{
						key: 'height',
						label: 'Height',
						type: 'number',
						precision: 1,
						step: 1,
						min: 10,
						suffix: ' mm'
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
						type: 'readonly',
						get: () => shape.value,
						precision: 2
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
						type: 'readonly',
						get: () => shape.value,
						precision: 2
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
	return {
		name: shape._definition ? shape._definition.name : 'Symbol',
		sections: [
			{
				title: 'Position',
				fields: [
					{ key: 'x', label: 'X', type: 'number', precision: 2, step: 1 },
					{ key: 'y', label: 'Y', type: 'number', precision: 2, step: 1 }
				]
			},
			{
				title: 'Transform',
				fields: [
					{
						key: 'rotation',
						label: 'Rotation',
						type: 'number',
						precision: 1,
						step: 15,
						suffix: '°',
						get: () => shape.rotation * 180 / Math.PI,
						set: (v) => { shape.rotation = v * Math.PI / 180; }
					},
					{ key: 'scaleX', label: 'Scale X', type: 'number', precision: 2, step: 0.1, min: 0.1 },
					{ key: 'scaleY', label: 'Scale Y', type: 'number', precision: 2, step: 0.1, min: 0.1 }
				]
			},
			{
				title: 'Symbol',
				fields: [
					{
						key: 'definitionName',
						label: 'Name',
						type: 'readonly',
						get: () => shape._definition ? shape._definition.name : '(unlinked)'
					},
					{
						key: 'explode',
						label: 'Break Apart',
						type: 'button',
						action: (symbol) => {
							const shapes = symbol.explode();
							if (shapes.length > 0) {
								undoManager.execute(new DeleteShapesCommand([symbol]));
								undoManager.execute(new AddShapesCommand(shapes));
								data.selectNone();
								for (const s of shapes) {
									s.selected = true;
								}
								stage.render();
							}
						}
					}
				]
			}
		]
	};
}
