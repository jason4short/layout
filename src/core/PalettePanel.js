import data from '../data/Data.js';
import stage from './Stage.js';
import inspector from './Inspector.js';

class PalettePanel {
	constructor() {
		if (PalettePanel.instance) {
			return PalettePanel.instance;
		}
		this.container = null;
		PalettePanel.instance = this;
	}

	init() {
		this.container = document.getElementById('palette-panel');
		if (!this.container) return;
		this.render();
	}

	render() {
		if (!this.container) return;
 		let html = '';

// 		let html = `
// 			<div class="panel-header">
// 				<span>Colors</span>
// 				<button id="btnAddColor" class="btn-small" title="Add Color">+</button>
// 			</div>
// 		`;
// 			<div class="palette-swatches">
// 
// 		for (const token of data.colorPalette.tokens) {
// 			html += `
// 				<div class="palette-swatch" data-id="${token.id}">
// 					<input type="color" value="${token.color}"
// 					       class="swatch-color" data-id="${token.id}" title="Click to change color">
// 					<input type="text" value="${token.name}"
// 					       class="swatch-name" data-id="${token.id}" title="Color name">
// 					<button class="swatch-delete" data-id="${token.id}" title="Delete color">&times;</button>
// 				</div>
// 			`;
// 		}
// 
// 		html += '</div>';
		this.container.innerHTML = html;
		this.attachListeners();
	}

	attachListeners() {
		// Add button
		const addBtn = document.getElementById('btnAddColor');
		if (addBtn) {
			addBtn.addEventListener('click', () => this.addToken());
		}

		// Color inputs - live update on change
		this.container.querySelectorAll('.swatch-color').forEach(input => {
			input.addEventListener('input', (e) => {
				const id = e.target.dataset.id;
				data.updateColorToken(id, null, e.target.value);
				stage.render();
			});
		});

		// Name inputs
		this.container.querySelectorAll('.swatch-name').forEach(input => {
			input.addEventListener('change', (e) => {
				const id = e.target.dataset.id;
				data.updateColorToken(id, e.target.value, null);
				inspector.update(); // Refresh inspector dropdowns
			});
		});

		// Delete buttons
		this.container.querySelectorAll('.swatch-delete').forEach(btn => {
			btn.addEventListener('click', (e) => {
				const id = e.target.dataset.id;
				this.deleteToken(id);
			});
		});
	}

	addToken() {
		data.addColorToken('New Color', '#888888');
		this.render();
		inspector.update(); // Refresh inspector dropdowns
	}

	deleteToken(id) {
		data.deleteColorToken(id);
		this.render();
		inspector.update(); // Refresh inspector dropdowns
		stage.render();
	}
}

const palettePanel = new PalettePanel();
export default palettePanel;
