/**
 * Inspector schema definitions for all geometry types.
 * Each builder function takes a shape instance and returns the schema.
 * This centralizes UI metadata while keeping geometry classes focused on math.
 */

import { PaperSizes } from './Paper.js';
import data from '../data/Data.js';
import stage from '../core/Stage.js';
import undoManager from '../core/UndoManager.js';
import { DeleteShapesCommand, AddShapesCommand, ApplyLayoutCommand, BreakApartCommand, BreakApartInstanceCommand } from '../core/Commands.js';
import { AutoLayoutFrame } from './AutoLayoutFrame.js';
import fontManager from '../core/FontManager.js';
// Note: Cannot import Inspector here due to circular dependency
// Inspector imports groupSchema from this file

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
						key: 'width',
						label: 'Width',
						type: 'length',
						get: () => shape.bounds.width,
						set: (v) => {
							const sign = shape.end.x >= shape.start.x ? 1 : -1;
							shape.end.x = shape.start.x + sign * v;
						},
						min: 0
					},
					{
						key: 'height',
						label: 'Height',
						type: 'length',
						get: () => shape.bounds.height,
						set: (v) => {
							const sign = shape.end.y >= shape.start.y ? 1 : -1;
							shape.end.y = shape.start.y + sign * v;
						},
						min: 0
					}
				]
			},
			pointFields('start', 'Start'),
			pointFields('end', 'End'),
			{
				title: 'Geometry',
				fields: [
					{
						key: 'perimeter',
						label: 'Perimeter',
						type: 'readonly-length',
						get: () => shape.length()
					}
				]
			}
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
					}
				]
			},
			{
				title: 'Center',
				fields: positionFields()
			},
			{
				title: 'Geometry',
				fields: [
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
			},
			{
				title: 'Actions',
				fields: [
					{
						key: 'flipArc',
						label: 'Flip Arc',
						type: 'button',
						action: () => {
							const temp = shape.startAngle;
							shape.startAngle = shape.endAngle;
							shape.endAngle = temp;
							shape.update();
							stage.render();
						}
					}
				]
			},
			{
				title: 'Geometry',
				fields: [
					{
						key: 'arcLength',
						label: 'Arc Length',
						type: 'readonly-length',
						get: () => shape.length()
					}
				]
			},
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
			pointFields('p0', 'Start Point (P0)'),
			pointFields('p1', 'Handle 1 (P1)'),
			pointFields('p2', 'Handle 2 (P2)'),
			pointFields('p3', 'End Point (P3)'),
			{
				title: 'Geometry',
				fields: [
					{
						key: 'arcLength',
						label: 'Length',
						type: 'readonly-length',
						get: () => shape.length()
					}
				]
			},
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

export function textSchema(shape) {
	const fontOptions = [
		{ value: 'Arial', label: 'Arial' },
		{ value: 'Helvetica', label: 'Helvetica' },
		{ value: 'Times New Roman', label: 'Times New Roman' },
		{ value: 'Georgia', label: 'Georgia' },
		{ value: 'Courier New', label: 'Courier New' },
		{ value: 'Verdana', label: 'Verdana' },
		{ value: 'Tahoma', label: 'Tahoma' },
		{ value: 'Trebuchet MS', label: 'Trebuchet MS' },
		{ value: 'Impact', label: 'Impact' },
		{ value: 'Comic Sans MS', label: 'Comic Sans MS' }
	];

	return {
		name: 'Text',
		sections: [
			{
				title: 'Font',
				fields: [
					{
						key: 'fontFamily',
						label: 'Family',
						type: 'select',
						options: fontOptions,
						get: () => shape.fontFamily,
						set: (v) => { shape.fontFamily = v; shape.update(); }
					},
					{
						key: 'fontSize',
						label: 'Size',
						type: 'number',
						get: () => shape.fontSize,
						set: (v) => { shape.fontSize = v; shape.update(); },
						min: 1,
						max: 500,
						step: 1,
						precision: 0
					},
					{
						key: 'fontWeight',
						label: 'Bold',
						type: 'checkbox',
						get: () => shape.fontWeight === 'bold',
						set: (v) => { shape.fontWeight = v ? 'bold' : 'normal'; shape.update(); }
					},
					{
						key: 'fontStyle',
						label: 'Italic',
						type: 'checkbox',
						get: () => shape.fontStyle === 'italic',
						set: (v) => { shape.fontStyle = v ? 'italic' : 'normal'; shape.update(); }
					}
				]
			},
			{
				title: 'Position',
				fields: positionFields()
			}
		]
	};
}

export function outlineTextSchema(shape) {
	const fontOptions = fontManager.getAvailableFonts().map(name => ({
		value: name,
		label: name
	}));

	return {
		name: 'Outline Text',
		sections: [
			{
				title: 'Text',
				fields: [
					{
						key: 'text',
						label: 'Content',
						type: 'string',
						get: () => shape.text,
						set: (v) => {
							shape.text = v;
							shape.invalidateCache();
							shape.update();
						}
					}
				]
			},
			{
				title: 'Font',
				fields: [
					{
						key: 'fontFamily',
						label: 'Family',
						type: 'select',
						options: fontOptions,
						get: () => shape.fontFamily,
						set: (v) => {
							shape.fontFamily = v;
							shape.invalidateCache();
							shape.loadFont();
						}
					},
					{
						key: 'fontSize',
						label: 'Size',
						type: 'number',
						get: () => shape.fontSize,
						set: (v) => {
							shape.fontSize = v;
							shape.invalidateCache();
							shape.update();
						},
						min: 1,
						max: 500,
						step: 1,
						precision: 0
					},
					{
						key: 'fontWeight',
						label: 'Bold',
						type: 'checkbox',
						get: () => shape.fontWeight === 'bold',
						set: (v) => {
							shape.fontWeight = v ? 'bold' : 'normal';
							shape.invalidateCache();
							shape.loadFont();
						}
					},
				]
			},
			{
				title: 'Position',
				fields: positionFields()
			},
			{
				title: 'Actions',
				fields: [
					{
						key: 'breakApart',
						label: 'Break Apart',
						type: 'button',
						action: (outlineText) => {
							undoManager.execute(new BreakApartCommand(outlineText));
							stage.render();
						}
					},
					{
						key: 'uploadFont',
						label: 'Upload Font...',
						type: 'button',
						action: async () => {
							const input = document.createElement('input');
							input.type = 'file';
							input.accept = '.ttf,.otf,.woff';
							input.onchange = async (e) => {
								const file = e.target.files[0];
								if (!file) return;
								try {
									const result = await fontManager.loadFontFromFile(file);
									shape.fontFamily = result.name;
									shape.invalidateCache();
									shape.loadFont();
									// Dynamic import to avoid circular dependency
									const { default: inspector } = await import('../core/Inspector.js');
									inspector.update();
									stage.render();
								} catch (err) {
									console.error('Failed to load font:', err);
									alert('Failed to load font: ' + err.message);
								}
							};
							input.click();
						}
					}
					
				]
			}
		]
	};
}

export function dimensionSchema(shape) {
	const names = { horizontal: 'Horizontal Dimension', vertical: 'Vertical Dimension' };
	return {
		name: names[shape.constraint] || 'Dimension',
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
						label: 'Polygon',
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
// 					{
// 						key: 'diameter',
// 						label: 'Diameter',
// 						type: 'length',
// 						get: () => shape.radius * 2,
// 						set: (v) => { shape.radius = v / 2; },
// 						min: 0.1
// 					},
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
							undoManager.execute(new BreakApartCommand(polygon));
							stage.render();
						}
					}
				]
			},
			{
				title: 'Geometry',
				fields: [
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
		]
	};
}

export function groupSchema(groupId) {
	const group = data.groups.get(groupId);
	if (!group) return null;

	// Ensure defaults exist
	if (!group.sizing) group.sizing = { widthMode: 'hug', heightMode: 'hug', fixedWidth: null, fixedHeight: null };
	if (!group.padding) group.padding = { top: 0, right: 0, bottom: 0, left: 0 };

	// Count items in group
	const directShapes = data.getDirectGroupShapes(groupId);
	const childGroups = data.getChildGroupIds(groupId);
	const itemCount = directShapes.length + childGroups.length;

	// Helper to apply layout automatically when properties change
	const applyLayoutIfActive = () => {
		if (group.autoLayout) {
			undoManager.execute(new ApplyLayoutCommand(groupId));
		}
		// Update the AutoLayoutFrame bounds
		if (group.frameShapeId) {
			const frame = data.shapes.find(s => s.id === group.frameShapeId);
			if (frame) {
				frame.update();
				data.rebuildPOIs(); // Refresh snap points for the frame
			}
		}
		stage.render();
	};

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
						key: 'autoLayout',
						label: 'Auto-Layout',
						type: 'checkbox',
						get: () => group.autoLayout || false,
						set: (v) => {
							group.autoLayout = v;
							if (v) {
								// Ensure mode is set (old groups may have 'none')
								if (group.layout.mode === 'none') {
									group.layout.mode = 'column';
								}
								// Create AutoLayoutFrame geometry for this group
								if (!group.frameShapeId) {
									const frame = new AutoLayoutFrame([groupId]);
									data.addShape(frame);
									group.frameShapeId = frame.id;
								}
								// Apply layout immediately when enabling
								undoManager.execute(new ApplyLayoutCommand(groupId));
							} else {
								// Remove AutoLayoutFrame geometry
								if (group.frameShapeId) {
									const frame = data.shapes.find(s => s.id === group.frameShapeId);
									if (frame) {
										data.deleteShape(frame);
									}
									group.frameShapeId = null;
								}
							}
							stage.render();
						}
					},
					{
						key: 'layout.mode',
						label: 'Direction',
						type: 'select',
						options: [
							{ value: 'column', label: 'Vertical' },
							{ value: 'row', label: 'Horizontal' }
						],
						get: () => group.layout.mode,
						set: (v) => {
							group.layout.mode = v;
							applyLayoutIfActive();
						},
						visible: () => group.autoLayout
					},
					{
						key: 'sizing.widthMode',
						label: 'Width',
						type: 'select',
						options: [
							{ value: 'hug', label: 'Hug' },
							{ value: 'fixed', label: 'Fixed' }
						],
						get: () => group.sizing.widthMode,
						set: (v) => {
							group.sizing.widthMode = v;
							if (v === 'fixed' && !group.sizing.fixedWidth) {
								const bounds = data.getAutoLayoutBounds(groupId);
								group.sizing.fixedWidth = bounds?.width || 100;
							}
							applyLayoutIfActive();
						},
						visible: () => group.autoLayout
					},
					{
						key: 'sizing.heightMode',
						label: 'Height',
						type: 'select',
						options: [
							{ value: 'hug', label: 'Hug' },
							{ value: 'fixed', label: 'Fixed' }
						],
						get: () => group.sizing.heightMode,
						set: (v) => {
							group.sizing.heightMode = v;
							if (v === 'fixed' && !group.sizing.fixedHeight) {
								const bounds = data.getAutoLayoutBounds(groupId);
								group.sizing.fixedHeight = bounds?.height || 100;
							}
							applyLayoutIfActive();
						},
						visible: () => group.autoLayout
					},
					{
						key: 'sizing.fixedWidth',
						label: 'Width',
						type: 'length',
						get: () => group.sizing.fixedWidth || 0,
						set: (v) => { group.sizing.fixedWidth = v; applyLayoutIfActive(); },
						min: 1,
						visible: () => group.autoLayout && group.sizing.widthMode === 'fixed'
					},
					{
						key: 'sizing.fixedHeight',
						label: 'Height',
						type: 'length',
						get: () => group.sizing.fixedHeight || 0,
						set: (v) => { group.sizing.fixedHeight = v; applyLayoutIfActive(); },
						min: 1,
						visible: () => group.autoLayout && group.sizing.heightMode === 'fixed'
					},
					{
						key: 'layout.gap',
						label: 'Gap',
						type: 'length',
						get: () => group.layout.gap,
						set: (v) => { group.layout.gap = v; applyLayoutIfActive(); },
						min: 0,
						visible: () => {
							if (!group.autoLayout) return false;
							// Hide gap when primary axis has fixed sizing (gap is auto-calculated)
							const isRow = group.layout.mode === 'row';
							return isRow ? group.sizing.widthMode === 'hug' : group.sizing.heightMode === 'hug';
						}
					},
					{
						key: 'layout.alignment',
						label: 'Align',
						type: 'button-group',
						options: [
							{ value: 'start', label: 'Start', icon: 'align-left' },
							{ value: 'center', label: 'Center', icon: 'align-center' },
							{ value: 'end', label: 'End', icon: 'align-right' }
						],
						get: () => group.layout.alignment,
						set: (v) => { group.layout.alignment = v; applyLayoutIfActive(); },
						visible: () => group.autoLayout
					}
				]
			},
			{
				title: 'Padding',
				visible: () => group.autoLayout,
				fields: [
					{
						key: 'padding.top',
						label: 'Top',
						type: 'length',
						get: () => group.padding.top,
						set: (v) => { group.padding.top = v; applyLayoutIfActive(); },
						min: 0
					},
					{
						key: 'padding.right',
						label: 'Right',
						type: 'length',
						get: () => group.padding.right,
						set: (v) => { group.padding.right = v; applyLayoutIfActive(); },
						min: 0
					},
					{
						key: 'padding.bottom',
						label: 'Bottom',
						type: 'length',
						get: () => group.padding.bottom,
						set: (v) => { group.padding.bottom = v; applyLayoutIfActive(); },
						min: 0
					},
					{
						key: 'padding.left',
						label: 'Left',
						type: 'length',
						get: () => group.padding.left,
						set: (v) => { group.padding.left = v; applyLayoutIfActive(); },
						min: 0
					}
				]
			}
		]
	};
}
