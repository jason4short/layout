import data from '../data/Data.js';
import stage from './Stage.js';
import { Shape, PenStyle } from '../geometry/Geometry.js';
import units from './Units.js';
import { groupSchema } from '../geometry/InspectorSchemas.js';

class Inspector {
	constructor() {
		if (Inspector.instance) {
			return Inspector.instance;
		}

		this.container = null;
		this.currentShape = null;
		this.currentSchema = null;
		this.lastMultiCount = 0;
		this.currentGroupId = null; // Track when showing group inspector

		Inspector.instance = this;
		return this;
	}

	init() {
		this.container = document.getElementById('inspector');
		if (!this.container) return;

		this.container.innerHTML = '<div class="inspector-empty">No selection</div>';
	}

	// Find if the selection represents a complete group at any level
	// Returns the groupId if found, null otherwise
	findSelectedGroup(selected) {
		if (selected.length === 0) return null;

		// Check if ALL selected shapes have a groupId (no ungrouped shapes mixed in)
		const allGrouped = selected.every(s => s.groupId);
		if (!allGrouped) return null;

		// Collect all unique group IDs from selection
		const groupIds = new Set();
		for (const shape of selected) {
			groupIds.add(shape.groupId);
		}

		// Helper to check if a group exactly matches selection
		const groupMatchesSelection = (groupId) => {
			const groupShapes = data.getGroupShapes(groupId);
			if (groupShapes.length !== selected.length) return false;
			// Check both directions to ensure exact match
			return groupShapes.every(s => selected.includes(s)) &&
			       selected.every(s => groupShapes.includes(s));
		};

		// Case 1: All shapes in same direct group - check if that group is complete
		if (groupIds.size === 1) {
			const groupId = [...groupIds][0];
			// First check direct group shapes
			const directShapes = data.getDirectGroupShapes(groupId);
			if (directShapes.length === selected.length &&
				directShapes.every(s => selected.includes(s))) {
				return groupId;
			}
			// If direct doesn't match, maybe this group has child groups
			// and we have a nested structure all under this groupId
			if (groupMatchesSelection(groupId)) {
				return groupId;
			}
		}

		// Case 2: Shapes in different groups - find common ancestor
		// Get root group for each groupId
		const rootIds = new Set();
		for (const gid of groupIds) {
			rootIds.add(data.getRootGroupId(gid));
		}

		// If all shapes share the same root, check if root group is complete
		if (rootIds.size === 1) {
			const rootId = [...rootIds][0];
			if (groupMatchesSelection(rootId)) {
				return rootId;
			}
		}

		// Case 3: Check intermediate parent levels
		// Collect parent IDs for groups that have parents
		const parentIds = new Set();
		for (const gid of groupIds) {
			const group = data.groups.get(gid);
			if (group && group.parentId) {
				parentIds.add(group.parentId);
			}
		}

		// If some groups share a parent, check those parents
		for (const parentId of parentIds) {
			if (groupMatchesSelection(parentId)) {
				return parentId;
			}
		}

		return null;
	}

	// Called when selection changes
	update() {
		if (!this.container) return;

		const selected = data.getSelected();

		if (selected.length === 0) {
			if (this.currentShape !== null || this.currentGroupId !== null || this.lastMultiCount !== 0) {
				this.currentShape = null;
				this.currentSchema = null;
				this.currentGroupId = null;
				this.lastMultiCount = 0;
				this.container.innerHTML = '<div class="inspector-empty">No selection</div>';
			}
			return;
		}

		// Check if selection represents a complete group (at any level)
		const groupId = this.findSelectedGroup(selected);
		if (groupId) {
			if (this.currentGroupId !== groupId) {
				this.currentShape = null;
				this.currentGroupId = groupId;
				this.buildGroupPanel(groupId);
			}
			return;
		}

		// Track if we were showing a group panel (need to rebuild if so)
		const wasShowingGroup = this.currentGroupId !== null;
		this.currentGroupId = null;

		if (selected.length > 1) {
			if (this.currentShape !== null || wasShowingGroup || this.lastMultiCount !== selected.length) {
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
		const allSamePen = selected.every(s => s.penStyle === firstStyle);

		// Build pen style dropdown
		const penOptions = Object.entries(PenStyle).map(([key, value]) => {
			const isSelected = allSamePen && firstStyle === value ? 'selected' : '';
			const label = key.charAt(0) + key.slice(1).toLowerCase();
			return `<option value="${value}" ${isSelected}>${label}</option>`;
		}).join('');

		// Add "Mixed" option if styles differ
		const mixedPenOption = allSamePen ? '' : '<option value="" selected disabled>Mixed</option>';

		// Check if all shapes have the same color token
		const firstToken = selected[0].colorToken;
		const allSameColor = selected.every(s => s.colorToken === firstToken);

		// Build color token dropdown
		const colorOptions = data.colorPalette.tokens.map(t => {
			const isSelected = allSameColor && firstToken === t.id ? 'selected' : '';
			return `<option value="${t.id}" ${isSelected}>${t.name}</option>`;
		}).join('');

		const mixedColorOption = allSameColor ? '' : '<option value="" selected disabled>Mixed</option>';
		const defaultColorOption = allSameColor && !firstToken ? 'selected' : '';

		html += `
			<div class="inspector-section">
				<div class="inspector-section-title">Appearance</div>
				<div class="inspector-row">
					<label>Pen Style</label>
					<select id="prop-penStyle-multi">${mixedPenOption}${penOptions}</select>
				</div>
				<div class="inspector-row">
					<label>Color</label>
					<select id="prop-colorToken-multi">
						${mixedColorOption}
						<option value="" ${defaultColorOption}>Default</option>
						${colorOptions}
					</select>
				</div>
			</div>
		`;

		html += '</div>';
		this.container.innerHTML = html;

		// Attach listener for multi-selection pen style change
		const penEl = document.getElementById('prop-penStyle-multi');
		if (penEl) {
			penEl.addEventListener('change', (e) => {
				const newStyle = e.target.value;
				for (const shape of selected) {
					shape.penStyle = newStyle;
				}
				stage.render();
			});
		}

		// Attach listener for multi-selection color token change
		const colorEl = document.getElementById('prop-colorToken-multi');
		if (colorEl) {
			colorEl.addEventListener('change', (e) => {
				const newToken = e.target.value || null;
				for (const shape of selected) {
					shape.colorToken = newToken;
				}
				stage.render();
			});
		}
	}

	buildGroupPanel(groupId) {
		const schema = groupSchema(groupId);
		if (!schema) return;

		this.currentSchema = schema;

		let html = '<div class="inspector-panel">';

		// Header
		html += `<div class="inspector-header">${schema.name}</div>`;

		// Schema-driven fields (no pen style for groups)
		if (schema.sections) {
			for (const section of schema.sections) {
				html += this.buildGroupSection(section, groupId);
			}
		}

		html += '</div>';
		this.container.innerHTML = html;

		// Attach event listeners
		this.attachGroupListeners(groupId, schema);
	}

	buildGroupSection(section, groupId) {
		// Check section visibility
		if (section.visible && !section.visible()) {
			return '';
		}

		let html = `<div class="inspector-section">`;
		html += `<div class="inspector-section-title">${section.title}</div>`;

		for (const field of section.fields) {
			// Check field visibility
			if (field.visible && !field.visible()) {
				continue;
			}
			html += this.buildGroupField(field, groupId);
		}

		html += `</div>`;
		return html;
	}

	buildGroupField(field, groupId) {
		const value = field.get ? field.get() : null;

		if (field.type === 'readonly') {
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<span class="inspector-value">${value}</span>
			</div>`;
		}

		if (field.type === 'select' && field.options) {
			const optionsHtml = field.options.map(opt => {
				const selected = opt.value === value ? 'selected' : '';
				return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
			}).join('');

			return `<div class="inspector-row">
				<label>${field.label}</label>
				<select id="prop-${field.key}">${optionsHtml}</select>
			</div>`;
		}

		if (field.type === 'length') {
			const displayValue = value !== null && value !== undefined
				? units.format(value, undefined, false)
				: '';
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<input type="text" id="prop-${field.key}" value="${displayValue}">
			</div>`;
		}

		if (field.type === 'button') {
			return `<div class="inspector-row inspector-button-row">
				<button id="prop-${field.key}" class="inspector-button">${field.label}</button>
			</div>`;
		}

		if (field.type === 'checkbox') {
			const checked = value ? 'checked' : '';
			return `<div class="inspector-row inspector-checkbox-row">
				<label>
					<input type="checkbox" id="prop-${field.key}" ${checked}>
					${field.label}
				</label>
			</div>`;
		}

		if (field.type === 'button-group' && field.options) {
			const buttons = field.options.map(opt => {
				const selected = value === opt.value ? 'selected' : '';
				return `<button class="inspector-btn-group-btn ${selected}" data-value="${opt.value}">${opt.label}</button>`;
			}).join('');
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<div class="inspector-btn-group" id="prop-${field.key}">${buttons}</div>
			</div>`;
		}

		return '';
	}

	attachGroupListeners(groupId, schema) {
		if (!schema || !schema.sections) return;

		for (const section of schema.sections) {
			for (const field of section.fields) {
				if (field.type === 'readonly') continue;

				const el = document.getElementById(`prop-${field.key}`);
				if (!el) continue;

				if (field.type === 'button' && field.action) {
					el.addEventListener('click', () => {
						field.action();
						// Refresh group panel after action
						this.buildGroupPanel(groupId);
					});
					continue;
				}

				if (field.type === 'select') {
					el.addEventListener('change', (e) => {
						if (field.set) field.set(e.target.value);
						// Refresh panel to show/hide conditional fields
						this.buildGroupPanel(groupId);
					});
				} else if (field.type === 'length') {
					el.addEventListener('change', (e) => {
						const numValue = units.parse(e.target.value);
						if (numValue !== null && field.set) {
							field.set(numValue);
						}
					});
				} else if (field.type === 'checkbox') {
					el.addEventListener('change', (e) => {
						if (field.set) field.set(e.target.checked);
						// Refresh panel to show/hide conditional fields
						this.buildGroupPanel(groupId);
					});
				} else if (field.type === 'button-group') {
					const buttons = el.querySelectorAll('.inspector-btn-group-btn');
					buttons.forEach(btn => {
						btn.addEventListener('click', () => {
							// Update selection state
							buttons.forEach(b => b.classList.remove('selected'));
							btn.classList.add('selected');
							// Set value
							if (field.set) field.set(btn.dataset.value);
						});
					});
				}
			}
		}
	}

	buildPenStyleField(shape) {
		const penOptions = Object.entries(PenStyle).map(([key, value]) => {
			const selected = shape.penStyle === value ? 'selected' : '';
			const label = key.charAt(0) + key.slice(1).toLowerCase();
			return `<option value="${value}" ${selected}>${label}</option>`;
		}).join('');

		// Build color token dropdown
		const colorOptions = data.colorPalette.tokens.map(t => {
			const selected = shape.colorToken === t.id ? 'selected' : '';
			return `<option value="${t.id}" ${selected}>${t.name}</option>`;
		}).join('');

		return `
			<div class="inspector-section">
				<div class="inspector-section-title">Appearance</div>
				<div class="inspector-row">
					<label>Pen Style</label>
					<select id="prop-penStyle">${penOptions}</select>
				</div>
				<div class="inspector-row">
					<label>Color</label>
					<select id="prop-colorToken">
						<option value="" ${!shape.colorToken ? 'selected' : ''}>Default</option>
						${colorOptions}
					</select>
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
		let displayValue;

		if (field.type === 'length' || field.type === 'readonly-length') {
			// Use units.format() for length values (stored in mm)
			displayValue = value !== null && value !== undefined
				? units.format(value, undefined, false)
				: '';
		} else {
			displayValue = field.precision !== undefined && value !== null && value !== undefined
				? Number(value).toFixed(field.precision)
				: value;
		}

		if (field.type === 'readonly') {
			const suffix = field.suffix || '';
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<span class="inspector-value" data-field="${field.key}">${displayValue}${suffix}</span>
			</div>`;
		}

		if (field.type === 'readonly-length') {
			const unitLabel = units.getUnitLabel();
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<span class="inspector-value" data-field="${field.key}">${displayValue} ${unitLabel}</span>
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

		if (field.type === 'length') {
			// Text input for length - accepts unit strings like "1in", "25mm"
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<input type="text" id="prop-${field.key}" value="${displayValue}">
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

		if (field.type === 'button') {
			return `<div class="inspector-row inspector-button-row">
				<button id="prop-${field.key}" class="inspector-button">${field.label}</button>
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
		let finalValue;

		// Parse value based on field type
		if (field.type === 'select') {
			// Select fields pass string value directly
			finalValue = value;
		} else if (field.type === 'length') {
			// Use units parser for length fields (handles "1in", "25mm", "1 1/2"", etc.)
			finalValue = units.parse(value);
			if (finalValue === null) {
				finalValue = parseFloat(value);
			}
			if (isNaN(finalValue)) return;
		} else {
			finalValue = parseFloat(value);
			if (isNaN(finalValue)) return;
		}

		if (field.set) {
			field.set.call(shape, finalValue);
		} else {
			this.setNestedValue(shape, field.key, finalValue);
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

		// Color Token (common to all)
		const colorTokenEl = document.getElementById('prop-colorToken');
		if (colorTokenEl) {
			colorTokenEl.addEventListener('change', (e) => {
				shape.colorToken = e.target.value || null;
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

				// Handle button clicks
				if (field.type === 'button' && field.action) {
					el.addEventListener('click', () => {
						field.action.call(shape, shape);
						this.update(); // Refresh inspector after action
					});
					continue;
				}

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
				let displayValue;

				if (field.type === 'length' || field.type === 'readonly-length') {
					displayValue = value !== null && value !== undefined
						? units.format(value, undefined, false)
						: '';
				} else {
					displayValue = field.precision !== undefined && value !== null && value !== undefined
						? Number(value).toFixed(field.precision)
						: value;
				}

				if (field.type === 'readonly') {
					const el = this.container.querySelector(`[data-field="${field.key}"]`);
					if (el) {
						const suffix = field.suffix || '';
						el.textContent = `${displayValue}${suffix}`;
					}
				} else if (field.type === 'readonly-length') {
					const el = this.container.querySelector(`[data-field="${field.key}"]`);
					if (el) {
						const unitLabel = units.getUnitLabel();
						el.textContent = `${displayValue} ${unitLabel}`;
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
