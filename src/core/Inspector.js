import data from '../data/Data.js';
import stage from './Stage.js';
import { Shape, PenStyle } from '../geometry/Geometry.js';

class Inspector {
	constructor() {
		if (Inspector.instance) {
			return Inspector.instance;
		}

		this.container = null;
		this.currentShape = null;
		this.lastMultiCount = 0;

		Inspector.instance = this;
		return this;
	}

	init() {
		this.container = document.getElementById('inspector');
		if (!this.container) return;

		this.container.innerHTML = '<div class="inspector-empty">No selection</div>';
	}

	// Called when selection changes
	update() {
		if (!this.container) return;

		const selected = data.getSelected();

		if (selected.length === 0) {
			if (this.currentShape !== null) {
				this.currentShape = null;
				this.container.innerHTML = '<div class="inspector-empty">No selection</div>';
			}
			return;
		}

		if (selected.length > 1) {
			if (this.currentShape !== null || this.lastMultiCount !== selected.length) {
				this.currentShape = null;
				this.lastMultiCount = selected.length;
				this.buildMultiPanel(selected);
			}
			return;
		}

		// Single selection - only rebuild if different shape
		const shape = selected[0];
		if (this.currentShape === shape) {
			// Same shape, just refresh values
			this.updateFieldValues(shape);
			return;
		}

		this.currentShape = shape;
		this.lastMultiCount = 0;
		this.buildPanel(shape);
	}

	// Refresh values without rebuilding (for live geometry updates)
	refresh() {
		if (!this.currentShape) return;

		const selected = data.getSelected();
		if (selected.length !== 1 || selected[0] !== this.currentShape) {
			this.update();
			return;
		}

		// Update field values from current shape
		this.updateFieldValues(this.currentShape);
	}

	buildPanel(shape) {
		let html = '<div class="inspector-panel">';

		// Header with geometry type
		const typeName = this.getTypeName(shape);
		html += `<div class="inspector-header">${typeName}</div>`;

		// Pen Style (common to all)
		html += this.buildPenStyleField(shape);

		// Geometry-specific fields
		html += this.buildGeometryFields(shape);

		html += '</div>';
		this.container.innerHTML = html;

		// Attach event listeners
		this.attachListeners(shape);
	}

	buildMultiPanel(selected) {
		let html = '<div class="inspector-panel">';

		// Header with count
		html += `<div class="inspector-header">${selected.length} Objects</div>`;

		// Check if all shapes have the same pen style
		const firstStyle = selected[0].penStyle;
		const allSame = selected.every(s => s.penStyle === firstStyle);

		// Build pen style dropdown
		const options = Object.entries(PenStyle).map(([key, value]) => {
			const isSelected = allSame && firstStyle === value ? 'selected' : '';
			const label = key.charAt(0) + key.slice(1).toLowerCase();
			return `<option value="${value}" ${isSelected}>${label}</option>`;
		}).join('');

		// Add "Mixed" option if styles differ
		const mixedOption = allSame ? '' : '<option value="" selected disabled>Mixed</option>';

		html += `
			<div class="inspector-section">
				<div class="inspector-section-title">Appearance</div>
				<div class="inspector-row">
					<label>Pen Style</label>
					<select id="prop-penStyle-multi">${mixedOption}${options}</select>
				</div>
			</div>
		`;

		html += '</div>';
		this.container.innerHTML = html;

		// Attach listener for multi-selection pen style change
		const el = document.getElementById('prop-penStyle-multi');
		if (el) {
			el.addEventListener('change', (e) => {
				const newStyle = e.target.value;
				for (const shape of selected) {
					shape.penStyle = newStyle;
				}
				stage.render();
			});
		}
	}

	getTypeName(shape) {
		switch (shape.geometry) {
			case Shape.LINE: return 'Line';
			case Shape.CIRCLE: return 'Circle';
			case Shape.ARC: return 'Arc';
			case Shape.TANGENT_ARC: return 'Tangent Arc';
			case Shape.ELLIPSE: return 'Ellipse';
			case Shape.SPLINE: return 'Spline';
			default: return 'Shape';
		}
	}

	buildPenStyleField(shape) {
		const options = Object.entries(PenStyle).map(([key, value]) => {
			const selected = shape.penStyle === value ? 'selected' : '';
			const label = key.charAt(0) + key.slice(1).toLowerCase();
			return `<option value="${value}" ${selected}>${label}</option>`;
		}).join('');

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Appearance</div>
				<div class="inspector-row">
					<label>Pen Style</label>
					<select id="prop-penStyle">${options}</select>
				</div>
			</div>
		`;
	}

	buildGeometryFields(shape) {
		switch (shape.geometry) {
			case Shape.LINE:
				return this.buildLineFields(shape);
			case Shape.CIRCLE:
				return this.buildCircleFields(shape);
			case Shape.ARC:
				return this.buildArcFields(shape);
			case Shape.TANGENT_ARC:
				return this.buildTangentArcFields(shape);
			case Shape.ELLIPSE:
				return this.buildEllipseFields(shape);
			case Shape.SPLINE:
				return this.buildSplineFields(shape);
			default:
				return '';
		}
	}

	buildLineFields(shape) {
		const length = shape.length().toFixed(2);
		const angle = shape.getAngleDeg().toFixed(1);

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Dimensions</div>
				<div class="inspector-row">
					<label>Length</label>
					<input type="number" id="prop-length" value="${length}" step="0.1">
				</div>
				<div class="inspector-row">
					<label>Angle</label>
					<span class="inspector-value">${angle}°</span>
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">Start Point</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-startX" value="${shape.start.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-startY" value="${shape.start.y.toFixed(2)}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">End Point</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-endX" value="${shape.end.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-endY" value="${shape.end.y.toFixed(2)}" step="1">
				</div>
			</div>
		`;
	}

	buildCircleFields(shape) {
		const circumference = (2 * Math.PI * shape.radius).toFixed(2);

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Dimensions</div>
				<div class="inspector-row">
					<label>Radius</label>
					<input type="number" id="prop-radius" value="${shape.radius.toFixed(2)}" step="1" min="0.1">
				</div>
				<div class="inspector-row">
					<label>Diameter</label>
					<input type="number" id="prop-diameter" value="${(shape.radius * 2).toFixed(2)}" step="1" min="0.1">
				</div>
				<div class="inspector-row">
					<label>Circumference</label>
					<span class="inspector-value">${circumference}</span>
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">Center</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-centerX" value="${shape.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-centerY" value="${shape.y.toFixed(2)}" step="1">
				</div>
			</div>
		`;
	}

	buildArcFields(shape) {
		const arcLength = shape.length().toFixed(2);
		const startDeg = (shape.startAngle * 180 / Math.PI).toFixed(1);
		const endDeg = (shape.endAngle * 180 / Math.PI).toFixed(1);

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Dimensions</div>
				<div class="inspector-row">
					<label>Radius</label>
					<input type="number" id="prop-radius" value="${shape.radius.toFixed(2)}" step="1" min="0.1">
				</div>
				<div class="inspector-row">
					<label>Arc Length</label>
					<span class="inspector-value">${arcLength}</span>
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">Angles</div>
				<div class="inspector-row">
					<label>Start</label>
					<input type="number" id="prop-startAngle" value="${startDeg}" step="1">
				</div>
				<div class="inspector-row">
					<label>End</label>
					<input type="number" id="prop-endAngle" value="${endDeg}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">Center</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-centerX" value="${shape.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-centerY" value="${shape.y.toFixed(2)}" step="1">
				</div>
			</div>
		`;
	}

	buildTangentArcFields(shape) {
		const arcLength = shape.length().toFixed(2);

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Dimensions</div>
				<div class="inspector-row">
					<label>Radius</label>
					<span class="inspector-value">${shape.radius.toFixed(2)}</span>
				</div>
				<div class="inspector-row">
					<label>Arc Length</label>
					<span class="inspector-value">${arcLength}</span>
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">Start Point</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-startX" value="${shape.startPoint.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-startY" value="${shape.startPoint.y.toFixed(2)}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">Tangent Point</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-tangentX" value="${shape.tangentPoint.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-tangentY" value="${shape.tangentPoint.y.toFixed(2)}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">End Point</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-endX" value="${shape.endPoint.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-endY" value="${shape.endPoint.y.toFixed(2)}" step="1">
				</div>
			</div>
		`;
	}

	buildEllipseFields(shape) {
		const rotationDeg = (shape.rotation * 180 / Math.PI).toFixed(1);

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Dimensions</div>
				<div class="inspector-row">
					<label>Radius X</label>
					<input type="number" id="prop-radiusX" value="${shape.radiusX.toFixed(2)}" step="1" min="0.1">
				</div>
				<div class="inspector-row">
					<label>Radius Y</label>
					<input type="number" id="prop-radiusY" value="${shape.radiusY.toFixed(2)}" step="1" min="0.1">
				</div>
				<div class="inspector-row">
					<label>Rotation</label>
					<input type="number" id="prop-rotation" value="${rotationDeg}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">Center</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-centerX" value="${shape.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-centerY" value="${shape.y.toFixed(2)}" step="1">
				</div>
			</div>
		`;
	}

	buildSplineFields(shape) {
		const length = shape.length().toFixed(2);

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Dimensions</div>
				<div class="inspector-row">
					<label>Length</label>
					<span class="inspector-value">${length}</span>
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">P0 (Start)</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-p0x" value="${shape.p0.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-p0y" value="${shape.p0.y.toFixed(2)}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">P1 (Handle)</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-p1x" value="${shape.p1.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-p1y" value="${shape.p1.y.toFixed(2)}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">P2 (Handle)</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-p2x" value="${shape.p2.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-p2y" value="${shape.p2.y.toFixed(2)}" step="1">
				</div>
			</div>
			<div class="inspector-section">
				<div class="inspector-section-title">P3 (End)</div>
				<div class="inspector-row">
					<label>X</label>
					<input type="number" id="prop-p3x" value="${shape.p3.x.toFixed(2)}" step="1">
				</div>
				<div class="inspector-row">
					<label>Y</label>
					<input type="number" id="prop-p3y" value="${shape.p3.y.toFixed(2)}" step="1">
				</div>
			</div>
		`;
	}

	attachListeners(shape) {
		// Pen Style
		this.attachListener('prop-penStyle', 'change', (value) => {
			shape.penStyle = value;
			stage.render();
		});

		switch (shape.geometry) {
			case Shape.LINE:
				this.attachLineListeners(shape);
				break;
			case Shape.CIRCLE:
				this.attachCircleListeners(shape);
				break;
			case Shape.ARC:
				this.attachArcListeners(shape);
				break;
			case Shape.TANGENT_ARC:
				this.attachTangentArcListeners(shape);
				break;
			case Shape.ELLIPSE:
				this.attachEllipseListeners(shape);
				break;
			case Shape.SPLINE:
				this.attachSplineListeners(shape);
				break;
		}
	}

	attachListener(id, event, callback) {
		const el = document.getElementById(id);
		if (el) {
			el.addEventListener(event, (e) => {
				callback(e.target.value);
				this.updateFieldValues(this.currentShape);
			});
		}
	}

	attachLineListeners(shape) {
		this.attachListener('prop-length', 'input', (value) => {
			shape.scaleToDim(parseFloat(value));
			shape.update();
			stage.render();
		});

		this.attachListener('prop-startX', 'input', (value) => {
			shape.start.x = parseFloat(value);
			shape.update();
			stage.render();
		});

		this.attachListener('prop-startY', 'input', (value) => {
			shape.start.y = parseFloat(value);
			shape.update();
			stage.render();
		});

		this.attachListener('prop-endX', 'input', (value) => {
			shape.end.x = parseFloat(value);
			shape.update();
			stage.render();
		});

		this.attachListener('prop-endY', 'input', (value) => {
			shape.end.y = parseFloat(value);
			shape.update();
			stage.render();
		});
	}

	attachCircleListeners(shape) {
		this.attachListener('prop-radius', 'input', (value) => {
			shape.radius = Math.max(0.1, parseFloat(value));
			shape.update();
			stage.render();
		});

		this.attachListener('prop-diameter', 'input', (value) => {
			shape.radius = Math.max(0.1, parseFloat(value) / 2);
			shape.update();
			stage.render();
		});

		this.attachListener('prop-centerX', 'input', (value) => {
			shape.x = parseFloat(value);
			shape.update();
			stage.render();
		});

		this.attachListener('prop-centerY', 'input', (value) => {
			shape.y = parseFloat(value);
			shape.update();
			stage.render();
		});
	}

	attachArcListeners(shape) {
		this.attachListener('prop-radius', 'input', (value) => {
			shape.radius = Math.max(0.1, parseFloat(value));
			shape.update();
			stage.render();
		});

		this.attachListener('prop-startAngle', 'input', (value) => {
			shape.startAngle = parseFloat(value) * Math.PI / 180;
			shape.update();
			stage.render();
		});

		this.attachListener('prop-endAngle', 'input', (value) => {
			shape.endAngle = parseFloat(value) * Math.PI / 180;
			shape.update();
			stage.render();
		});

		this.attachListener('prop-centerX', 'input', (value) => {
			shape.x = parseFloat(value);
			shape.update();
			stage.render();
		});

		this.attachListener('prop-centerY', 'input', (value) => {
			shape.y = parseFloat(value);
			shape.update();
			stage.render();
		});
	}

	attachTangentArcListeners(shape) {
		this.attachListener('prop-startX', 'input', (value) => {
			shape.startPoint.x = parseFloat(value);
			shape.recalculate();
			stage.render();
		});

		this.attachListener('prop-startY', 'input', (value) => {
			shape.startPoint.y = parseFloat(value);
			shape.recalculate();
			stage.render();
		});

		this.attachListener('prop-tangentX', 'input', (value) => {
			shape.tangentPoint.x = parseFloat(value);
			shape.recalculate();
			stage.render();
		});

		this.attachListener('prop-tangentY', 'input', (value) => {
			shape.tangentPoint.y = parseFloat(value);
			shape.recalculate();
			stage.render();
		});

		this.attachListener('prop-endX', 'input', (value) => {
			shape.endPoint.x = parseFloat(value);
			shape.recalculate();
			stage.render();
		});

		this.attachListener('prop-endY', 'input', (value) => {
			shape.endPoint.y = parseFloat(value);
			shape.recalculate();
			stage.render();
		});
	}

	attachEllipseListeners(shape) {
		this.attachListener('prop-radiusX', 'input', (value) => {
			shape.radiusX = Math.max(0.1, parseFloat(value));
			shape.update();
			stage.render();
		});

		this.attachListener('prop-radiusY', 'input', (value) => {
			shape.radiusY = Math.max(0.1, parseFloat(value));
			shape.update();
			stage.render();
		});

		this.attachListener('prop-rotation', 'input', (value) => {
			shape.rotation = parseFloat(value) * Math.PI / 180;
			shape.update();
			stage.render();
		});

		this.attachListener('prop-centerX', 'input', (value) => {
			shape.x = parseFloat(value);
			shape.update();
			stage.render();
		});

		this.attachListener('prop-centerY', 'input', (value) => {
			shape.y = parseFloat(value);
			shape.update();
			stage.render();
		});
	}

	attachSplineListeners(shape) {
		['p0', 'p1', 'p2', 'p3'].forEach(pt => {
			this.attachListener(`prop-${pt}x`, 'input', (value) => {
				shape[pt].x = parseFloat(value);
				shape.update();
				stage.render();
			});

			this.attachListener(`prop-${pt}y`, 'input', (value) => {
				shape[pt].y = parseFloat(value);
				shape.update();
				stage.render();
			});
		});
	}

	// Update displayed values (when shape changes externally)
	updateFieldValues(shape) {
		if (!shape) return;

		// Only update computed/derived values to avoid cursor jumping in active input
		const activeId = document.activeElement?.id;

		switch (shape.geometry) {
			case Shape.LINE:
				if (activeId !== 'prop-length') {
					this.setFieldValue('prop-length', shape.length().toFixed(2));
				}
				this.setTextValue('.inspector-value', `${shape.getAngleDeg().toFixed(1)}°`);
				break;

			case Shape.CIRCLE:
				if (activeId !== 'prop-diameter') {
					this.setFieldValue('prop-diameter', (shape.radius * 2).toFixed(2));
				}
				if (activeId !== 'prop-radius') {
					this.setFieldValue('prop-radius', shape.radius.toFixed(2));
				}
				break;

			case Shape.TANGENT_ARC:
				// Update computed radius display
				const radiusEl = this.container.querySelector('.inspector-value');
				if (radiusEl) radiusEl.textContent = shape.radius.toFixed(2);
				break;
		}
	}

	setFieldValue(id, value) {
		const el = document.getElementById(id);
		if (el && document.activeElement !== el) {
			el.value = value;
		}
	}

	setTextValue(selector, value) {
		const el = this.container.querySelector(selector);
		if (el) el.textContent = value;
	}
}

const inspector = new Inspector();
export default inspector;
