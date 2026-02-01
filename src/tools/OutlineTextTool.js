/**
 * OutlineTextTool - Place outline text shapes for laser cutting
 * Click to place, edit text in properties panel
 */

import { Tool } from './Tool.js';
import { OutlineText } from '../geometry/OutlineText.js';

import stage from '../core/Stage.js';
import data from '../data/Data.js';
import undoManager from '../core/UndoManager.js';
import { AddShapeCommand } from '../core/Commands.js';
import inspector from '../core/Inspector.js';
import fontManager from '../core/FontManager.js';

export class OutlineTextTool extends Tool {
	constructor() {
		super();

		this.name = 'Outline Text';
		this.usage = 'Click to place text outlines. Edit text in the properties panel.';

		this.generateGuides = false;

		// Default properties for new text
		this.defaultText = 'Text';
		this.defaultFontSize = 20;
		this.defaultFontFamily = 'Roboto';
		this.defaultFontWeight = 'normal';

		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
	}

	begin() {
		this.updateCursor();
		inspector.showToolPanel(this);
	}

	deactivate() {
		inspector.clearToolPanel();
	}

	/**
	 * Get inspector schema for tool defaults
	 */
	getInspectorSchema() {
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
							key: 'defaultText',
							label: 'Content',
							type: 'string',
							get: () => this.defaultText,
							set: (v) => { this.defaultText = v; }
						},
						{
							key: 'defaultFontFamily',
							label: 'Font',
							type: 'select',
							options: fontOptions,
							get: () => this.defaultFontFamily,
							set: (v) => { this.defaultFontFamily = v; }
						},
						{
							key: 'defaultFontSize',
							label: 'Size',
							type: 'number',
							min: 1,
							get: () => this.defaultFontSize,
							set: (v) => { this.defaultFontSize = v; }
						},
						{
							key: 'defaultFontWeight',
							label: 'Bold',
							type: 'checkbox',
							get: () => this.defaultFontWeight === 'bold',
							set: (v) => { this.defaultFontWeight = v ? 'bold' : 'normal'; }
						},
						{
							key: 'uploadFont',
							label: 'Upload Font...',
							type: 'button',
							action: () => {
								const input = document.createElement('input');
								input.type = 'file';
								input.accept = '.ttf,.otf,.woff';
								input.onchange = async (e) => {
									const file = e.target.files[0];
									if (!file) return;
									try {
										const result = await fontManager.loadFontFromFile(file);
										this.defaultFontFamily = result.name;
										inspector.showToolPanel(this);
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

	updateCursor() {
		stage.setCursor('crosshair');
	}

	reset() {
		// Nothing to reset
	}

	onMouseDown(e) {
		// Get click position
		const worldX = data.snapPoint.x;
		const worldY = data.snapPoint.y;

		// Create outline text at click position using tool defaults
		const outlineText = new OutlineText([
			worldX,
			worldY,
			this.defaultText,
			this.defaultFontSize,
			this.defaultFontFamily
		]);
		outlineText.fontWeight = this.defaultFontWeight;

		// Add to document
		undoManager.execute(new AddShapeCommand(outlineText));

		// Select the new shape so properties panel shows
		data.selectNone();
		outlineText.selected = true;

		stage.render();
	}

	onMouseMove(e) {
		// Nothing to do - no preview needed
	}

	onMouseUp(e) {
		// Nothing to do
	}
}
