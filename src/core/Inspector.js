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
		this.currentSchema = null;
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
				this.currentSchema = null;
				this.container.innerHTML = '<div class="inspector-empty">No selection</div>';
			}
			return;
		}

		if (selected.length > 1) {
			if (this.currentShape !== null || this.lastMultiCount !== selected.length) {
				this.currentShape = null;
				this.currentSchema = null;
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
		this.currentSchema = shape.getInspectorSchema ? shape.getInspectorSchema() : null;
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
		const schema = this.currentSchema;

		let html = '<div class="inspector-panel">';

		// Header with geometry type
		const typeName = schema ? schema.name : 'Shape';
		html += `<div class="inspector-header">${typeName}</div>`;

		// Pen Style (common to all)
		html += this.buildPenStyleField(shape);

		// Schema-driven fields
		if (schema && schema.sections) {
			for (const section of schema.sections) {
				html += this.buildSection(section, shape);
			}
		}

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

	buildSection(section, shape) {
		let html = `<div class="inspector-section">`;
		html += `<div class="inspector-section-title">${section.title}</div>`;

		for (const field of section.fields) {
			html += this.buildField(field, shape);
		}

		html += `</div>`;
		return html;
	}

	buildField(field, shape) {
		const value = this.getFieldValue(field, shape);
		const displayValue = field.precision !== undefined && value !== null && value !== undefined
			? Number(value).toFixed(field.precision)
			: value;

		if (field.type === 'readonly') {
			const suffix = field.suffix || '';
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<span class="inspector-value" data-field="${field.key}">${displayValue}${suffix}</span>
			</div>`;
		}

		if (field.type === 'number') {
			const attrs = [
				`type="number"`,
				`id="prop-${field.key}"`,
				`value="${displayValue}"`,
				field.min !== undefined ? `min="${field.min}"` : '',
				field.max !== undefined ? `max="${field.max}"` : ''
			].filter(Boolean).join(' ');

			return `<div class="inspector-row">
				<label>${field.label}</label>
				<input ${attrs}>
			</div>`;
		}

		if (field.type === 'select' && field.options) {
			const currentValue = this.getFieldValue(field, shape);
			const optionsHtml = field.options.map(opt => {
				const selected = opt.value === currentValue ? 'selected' : '';
				return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
			}).join('');

			return `<div class="inspector-row">
				<label>${field.label}</label>
				<select id="prop-${field.key}">${optionsHtml}</select>
			</div>`;
		}

		return '';
	}

	getFieldValue(field, shape) {
		if (field.get) {
			return field.get.call(shape);
		}
		return this.getNestedValue(shape, field.key);
	}

	setFieldValue(field, shape, value) {
		const numValue = parseFloat(value);

		if (field.set) {
			field.set.call(shape, numValue);
		} else {
			this.setNestedValue(shape, field.key, numValue);
		}
		shape.update();
		data.rebuildPOIs();
		data.recalculateIntersectionsForShape(shape);
		stage.render();
	}

	getNestedValue(obj, path) {
		return path.split('.').reduce((o, k) => o?.[k], obj);
	}

	setNestedValue(obj, path, value) {
		const parts = path.split('.');
		const last = parts.pop();
		const target = parts.reduce((o, k) => o[k], obj);
		if (target && last) {
			target[last] = value;
		}
	}

	attachListeners(shape) {
		// Pen Style (common to all)
		const penStyleEl = document.getElementById('prop-penStyle');
		if (penStyleEl) {
			penStyleEl.addEventListener('change', (e) => {
				shape.penStyle = e.target.value;
				stage.render();
			});
		}

		// Schema-driven listeners
		const schema = this.currentSchema;
		if (!schema || !schema.sections) return;

		for (const section of schema.sections) {
			for (const field of section.fields) {
				if (field.type === 'readonly') continue;

				const el = document.getElementById(`prop-${field.key}`);
				if (!el) continue;

				const eventType = field.type === 'select' ? 'change' : 'input';
				el.addEventListener(eventType, (e) => {
					this.setFieldValue(field, shape, e.target.value);
					this.updateFieldValues(shape);
				});

				// Handle arrow keys manually for number fields
				if (field.type === 'number' && field.step !== undefined) {
					el.addEventListener('keydown', (e) => {
						if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
							e.preventDefault();
							e.stopPropagation();

							const currentValue = parseFloat(el.value) || 0;
							const delta = e.key === 'ArrowUp' ? field.step : -field.step;
							let newValue = currentValue + delta;

							// Apply min/max constraints
							if (field.min !== undefined && newValue < field.min) newValue = field.min;
							if (field.max !== undefined && newValue > field.max) newValue = field.max;

							// Update input directly to prevent input event from overwriting
							const displayValue = field.precision !== undefined
								? newValue.toFixed(field.precision)
								: newValue;
							el.value = displayValue;

							this.setFieldValue(field, shape, newValue);
							this.updateFieldValues(shape);
						}
					});
				}
			}
		}
	}

	// Update displayed values (when shape changes externally)
	updateFieldValues(shape) {
		if (!shape) return;

		const schema = this.currentSchema;
		if (!schema || !schema.sections) return;

		const activeId = document.activeElement?.id;

		for (const section of schema.sections) {
			for (const field of section.fields) {
				const elementId = `prop-${field.key}`;

				// Skip if this field is currently being edited
				if (activeId === elementId) continue;

				const value = this.getFieldValue(field, shape);
				const displayValue = field.precision !== undefined && value !== null && value !== undefined
					? Number(value).toFixed(field.precision)
					: value;

				if (field.type === 'readonly') {
					const el = this.container.querySelector(`[data-field="${field.key}"]`);
					if (el) {
						const suffix = field.suffix || '';
						el.textContent = `${displayValue}${suffix}`;
					}
				} else {
					const el = document.getElementById(elementId);
					if (el) {
						el.value = displayValue;
					}
				}
			}
		}
	}
}

const inspector = new Inspector();
export default inspector;
