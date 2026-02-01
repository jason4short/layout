import data from '../data/Data.js';
import stage from './Stage.js';
import { Shape, PenStyle } from '../geometry/Geometry.js';
import units from './Units.js';
import { groupSchema } from '../geometry/InspectorSchemas.js';
import { ThemePresets } from './Renderer.js';

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
		this.showingDocumentPanel = false;
		this.currentTool = null; // Track when showing tool inspector

		Inspector.instance = this;
		return this;
	}

	init() {
		this.container = document.getElementById('inspector');
		if (!this.container) return;

		this.buildDocumentPanel();
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

	/**
	 * Show tool properties panel (called when a tool with properties is activated)
	 */
	showToolPanel(tool) {
		if (!this.container) return;
		if (!tool || !tool.getInspectorSchema) return;

		this.currentTool = tool;
		this.currentShape = null;
		this.currentSchema = tool.getInspectorSchema();
		this.currentGroupId = null;
		this.showingDocumentPanel = false;

		this.buildToolPanel(tool);
	}

	/**
	 * Clear tool panel (called when tool is deactivated)
	 */
	clearToolPanel() {
		this.currentTool = null;
	}

	// Called when selection changes
	update() {
		if (!this.container) return;

		const selected = data.getSelected();

		if (selected.length === 0) {
			// If a tool with properties is active, show its panel
			if (this.currentTool && this.currentTool.getInspectorSchema) {
				this.showToolPanel(this.currentTool);
				return;
			}
			if (!this.showingDocumentPanel) {
				this.currentShape = null;
				this.currentSchema = null;
				this.currentGroupId = null;
				this.lastMultiCount = 0;
				this.buildDocumentPanel();
			}
			return;
		}

		// Selection exists, clear tool panel tracking
		this.currentTool = null;

		this.showingDocumentPanel = false;

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

	buildDocumentPanel() {
		this.showingDocumentPanel = true;

		let html = '<div class="inspector-panel">';
		html += '<div class="inspector-header">Document</div>';

		// Theme selector
		html += `
			<div class="inspector-section">
				<div class="inspector-section-title">Theme</div>
				<div class="inspector-row">
					<label>Preset</label>
					<select id="prop-theme">`;
		for (const [id, theme] of Object.entries(ThemePresets)) {
			const selected = data.theme === id ? 'selected' : '';
			html += `<option value="${id}" ${selected}>${theme.name}</option>`;
		}
		html += `</select>
				</div>
				<div class="inspector-row">
					<label>Background</label>
					<input type="color" id="prop-backgroundColor" value="${data.backgroundColor}">
				</div>
			</div>
		`;

		// Pen style colors
		html += `
			<div class="inspector-section">
				<div class="inspector-section-title">Pen Style Colors</div>`;

		const penStyleLabels = {
			[PenStyle.VISIBLE]: 'Visible',
			[PenStyle.CONSTRUCTION]: 'Construction',
			[PenStyle.CENTERLINE]: 'Centerline',
			[PenStyle.HIDDEN]: 'Hidden',
			[PenStyle.PHANTOM]: 'Phantom',
			[PenStyle.OUTLINE]: 'Outline',
			[PenStyle.DIMENSION]: 'Dimension'
		};

		for (const [style, label] of Object.entries(penStyleLabels)) {
			const theme = ThemePresets[data.theme] || ThemePresets.light;
			const themeColor = theme.colors[style];
			const currentColor = data.penStyleOverrides[style] || themeColor;
			const isOverridden = data.penStyleOverrides[style] ? true : false;

			html += `
				<div class="inspector-row">
					<label>${label}</label>
					<input type="color" id="prop-penStyle-${style}" value="${currentColor}"
						data-style="${style}" data-theme-color="${themeColor}">
					${isOverridden ? `<button class="reset-btn" data-style="${style}" title="Reset to theme">↺</button>` : ''}
				</div>`;
		}
		html += '</div>';

		html += '</div>';
		this.container.innerHTML = html;

		// Attach listeners
		const themeEl = document.getElementById('prop-theme');
		if (themeEl) {
			themeEl.addEventListener('change', (e) => {
				data.applyTheme(e.target.value, ThemePresets);
				this.buildDocumentPanel();  // Rebuild to update colors
				stage.render();
			});
		}

		const bgColorEl = document.getElementById('prop-backgroundColor');
		if (bgColorEl) {
			bgColorEl.addEventListener('input', (e) => {
				data.backgroundColor = e.target.value;
				stage.render();
			});
		}

		// Pen style color pickers
		for (const style of Object.keys(penStyleLabels)) {
			const colorEl = document.getElementById(`prop-penStyle-${style}`);
			if (colorEl) {
				colorEl.addEventListener('input', (e) => {
					data.setPenStyleOverride(style, e.target.value);
					stage.render();
				});
			}
		}

		// Reset buttons
		this.container.querySelectorAll('.reset-btn').forEach(btn => {
			btn.addEventListener('click', (e) => {
				const style = e.target.dataset.style;
				data.clearPenStyleOverride(style);
				this.buildDocumentPanel();  // Rebuild to update UI
				stage.render();
			});
		});
	}

	buildToolPanel(tool) {
		const schema = this.currentSchema;
		if (!schema) return;

		let html = '<div class="inspector-panel">';

		// Header with tool name
		html += `<div class="inspector-header">${schema.name}</div>`;

		// Schema-driven fields
		if (schema.sections) {
			for (const section of schema.sections) {
				html += this.buildToolSection(section, tool);
			}
		}

		html += '</div>';
		this.container.innerHTML = html;

		// Attach event listeners
		this.attachToolListeners(tool, schema);
	}

	buildToolSection(section, tool) {
		return this.buildSectionHtml(section, field => this.buildToolField(field, tool));
	}

	buildToolField(field, tool) {
		const value = field.get ? field.get() : tool[field.key];
		const displayValue = this.formatDisplayValue(value, field);

		if (field.type === 'string') {
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<input type="text" id="prop-${field.key}" value="${displayValue}">
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
			const optionsHtml = this.buildSelectOptions(field.options, value);
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<select id="prop-${field.key}">${optionsHtml}</select>
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

		if (field.type === 'button') {
			return `<div class="inspector-row inspector-button-row">
				<button id="prop-${field.key}" class="inspector-button">${field.label}</button>
			</div>`;
		}

		return '';
	}

	attachToolListeners(tool, schema) {
		if (!schema || !schema.sections) return;

		for (const section of schema.sections) {
			for (const field of section.fields) {
				const el = document.getElementById(`prop-${field.key}`);
				if (!el) continue;

				if (field.type === 'button' && field.action) {
					el.addEventListener('click', () => {
						field.action();
					});
				} else if (field.type === 'select' || field.type === 'string') {
					el.addEventListener('change', (e) => {
						if (field.set) {
							field.set(e.target.value);
						} else {
							tool[field.key] = e.target.value;
						}
					});
					// Also listen for input on string fields for live updates
					if (field.type === 'string') {
						el.addEventListener('input', (e) => {
							if (field.set) {
								field.set(e.target.value);
							} else {
								tool[field.key] = e.target.value;
							}
						});
					}
				} else if (field.type === 'number') {
					el.addEventListener('input', (e) => {
						const numValue = parseFloat(e.target.value);
						if (!isNaN(numValue)) {
							if (field.set) {
								field.set(numValue);
							} else {
								tool[field.key] = numValue;
							}
						}
					});
				} else if (field.type === 'checkbox') {
					el.addEventListener('change', (e) => {
						if (field.set) {
							field.set(e.target.checked);
						} else {
							tool[field.key] = e.target.checked;
						}
					});
				}
			}
		}
	}

	buildPanel(shape) {
		const schema = this.currentSchema;

		let html = '<div class="inspector-panel">';

		// Header with geometry type
		const typeName = schema ? schema.name : 'Shape';
		html += `<div class="inspector-header">${typeName}</div>`;

		// Pen Style (skip for shapes that don't use it, e.g. Paper)
		if (shape.penStyle !== null) {
			html += this.buildPenStyleField(shape);
		}

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

	// Shared section builder with visibility support
	buildSectionHtml(section, buildFieldFn) {
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
			html += buildFieldFn(field);
		}

		html += `</div>`;
		return html;
	}

	buildGroupSection(section, groupId) {
		return this.buildSectionHtml(section, field => this.buildGroupField(field, groupId));
	}

	buildGroupField(field, groupId) {
		const value = field.get ? field.get() : null;
		const displayValue = this.formatDisplayValue(value, field);

		if (field.type === 'readonly') {
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<span class="inspector-value">${displayValue}</span>
			</div>`;
		}

		if (field.type === 'select' && field.options) {
			const optionsHtml = this.buildSelectOptions(field.options, value);
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<select id="prop-${field.key}">${optionsHtml}</select>
			</div>`;
		}

		if (field.type === 'length') {
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
			const buttons = this.buildButtonGroupOptions(field.options, value);
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<div class="inspector-btn-group" id="prop-${field.key}">${buttons}</div>
			</div>`;
		}

		return '';
	}

	attachGroupListeners(groupId, schema) {
		this.forEachSchemaField(schema, (field, el) => {
			if (field.type === 'button' && field.action) {
				el.addEventListener('click', () => {
					field.action();
					this.buildGroupPanel(groupId);
				});
				return;
			}

			if (field.type === 'select') {
				el.addEventListener('change', (e) => {
					if (field.set) field.set(e.target.value);
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
					this.buildGroupPanel(groupId);
				});
			} else if (field.type === 'button-group') {
				const buttons = el.querySelectorAll('.inspector-btn-group-btn');
				buttons.forEach(btn => {
					btn.addEventListener('click', () => {
						buttons.forEach(b => b.classList.remove('selected'));
						btn.classList.add('selected');
						if (field.set) field.set(btn.dataset.value);
					});
				});
			}
		});
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
		return this.buildSectionHtml(section, field => this.buildField(field, shape));
	}

	buildField(field, shape) {
		const value = this.getFieldValue(field, shape);
		const displayValue = this.formatDisplayValue(value, field);

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
			const optionsHtml = this.buildSelectOptions(field.options, value);
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

		if (field.type === 'string') {
			return `<div class="inspector-row">
				<label>${field.label}</label>
				<input type="text" id="prop-${field.key}" value="${displayValue}">
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
		if (field.type === 'select' || field.type === 'string') {
			// Select and string fields pass value directly
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

	// Build options HTML for select fields
	buildSelectOptions(options, currentValue) {
		return options.map(opt => {
			const selected = opt.value === currentValue ? 'selected' : '';
			return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
		}).join('');
	}

	// Build buttons HTML for button-group fields
	buildButtonGroupOptions(options, currentValue) {
		return options.map(opt => {
			const selected = currentValue === opt.value ? 'selected' : '';
			return `<button class="inspector-btn-group-btn ${selected}" data-value="${opt.value}">${opt.label}</button>`;
		}).join('');
	}

	// Format a value for display based on field type
	formatDisplayValue(value, field) {
		if (value === null || value === undefined) {
			return '';
		}
		if (field.type === 'length' || field.type === 'readonly-length') {
			return units.format(value, undefined, false);
		}
		if (field.precision !== undefined) {
			return Number(value).toFixed(field.precision);
		}
		return value;
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

	// Iterate schema fields and call handler for each interactive field element
	forEachSchemaField(schema, handler) {
		if (!schema || !schema.sections) return;

		for (const section of schema.sections) {
			for (const field of section.fields) {
				// Skip readonly field types
				if (field.type === 'readonly' || field.type === 'readonly-length') continue;

				const el = document.getElementById(`prop-${field.key}`);
				if (!el) continue;

				handler(field, el);
			}
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
		this.forEachSchemaField(this.currentSchema, (field, el) => {
			// Handle button clicks
			if (field.type === 'button' && field.action) {
				el.addEventListener('click', () => {
					field.action.call(shape, shape);
					this.update();
				});
				return;
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

						if (field.min !== undefined && newValue < field.min) newValue = field.min;
						if (field.max !== undefined && newValue > field.max) newValue = field.max;

						const displayValue = field.precision !== undefined
							? newValue.toFixed(field.precision)
							: newValue;
						el.value = displayValue;

						this.setFieldValue(field, shape, newValue);
						this.updateFieldValues(shape);
					}
				});
			}
		});
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
				const displayValue = this.formatDisplayValue(value, field);

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
