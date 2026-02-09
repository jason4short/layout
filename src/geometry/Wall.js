import { Shape } from './Geometry.js';
import { Board } from './Board.js';
import undoManager from '../core/UndoManager.js';
import { BreakApartCommand } from '../core/Commands.js';

export const WALL_PRESETS = [
	{ name: '2x4 Interior', thickness: 114.3 },   // 4.5"
	{ name: '2x6 Exterior', thickness: 165.1 },   // 6.5"
	{ name: '2x4 Stud Only', thickness: 88.9 },   // 3.5"
	{ name: '2x6 Stud Only', thickness: 139.7 },  // 5.5"
	{ name: '8" Block', thickness: 203.2 },        // 8"
	{ name: 'Custom', thickness: 114.3 }
];

export class Wall extends Board {
	constructor(params) {
		// params: [startX, startY, endX, endY, thickness, presetName, alignment]
		// Default alignment to 'center' for walls (override Board's 'top' default)
		const p = [...(params || [])];
		if (p[6] === undefined) p[6] = 'bottom';
		if (p[4] === undefined) p[4] = 114.3;  // Default 4.5" wall
		if (p[5] === undefined) p[5] = '2x4 Interior';

		super(p);
		this.geometry = Shape.WALL;
	}

	// No-op: Renderer handles wall drawing in batch via renderWallBoolean
	draw(ctx, renderer) {
		// Intentionally empty — walls are rendered as a merged group
	}

	clone() {
		const w = new Wall([
			this.start.x, this.start.y,
			this.end.x, this.end.y,
			this.thickness,
			this.presetName,
			this.alignment
		]);
		w.type = this.type;
		w.groupId = this.groupId;
		w.penStyle = this.penStyle;
		w.colorToken = this.colorToken;
		return w;
	}

	getInspectorSchema() {
		return {
			name: 'Wall',
			sections: [
				{
					title: 'Preset',
					fields: [
						{
							key: 'preset',
							label: 'Type',
							type: 'select',
							options: WALL_PRESETS.map(p => ({ value: p.name, label: p.name })),
							get: () => this.presetName,
							set: (v) => {
								const preset = WALL_PRESETS.find(p => p.name === v);
								if (preset) {
									this.presetName = v;
									this.thickness = preset.thickness;
									this.update();
								}
							}
						}
					]
				},
				{
					title: 'Dimensions',
					fields: [
						{ key: 'thickness', label: 'Thickness', type: 'length', precision: 3, step: 1, min: 0.1 },
						{
							key: 'length',
							label: 'Length',
							type: 'length',
							precision: 2,
							step: 10,
							min: 1,
							get: () => this.length(),
							set: (v) => { this.scaleToDim(v); }
						},
						{
							key: 'alignment',
							label: 'Edge',
							type: 'select',
							options: [
								{ value: 'top', label: 'Left' },
								{ value: 'center', label: 'Center' },
								{ value: 'bottom', label: 'Right' }
							],
							get: () => this.alignment,
							set: (v) => { this.alignment = v; this.update(); }
						}
					]
				},
				{
					title: 'Start Point',
					fields: [
						{
							key: 'startX', label: 'X', type: 'length', precision: 2, step: 1,
							get: () => this.start.x,
							set: (v) => { this.start.x = v; this.update(); }
						},
						{
							key: 'startY', label: 'Y', type: 'length', precision: 2, step: 1,
							get: () => this.start.y,
							set: (v) => { this.start.y = v; this.update(); }
						}
					]
				},
				{
					title: 'End Point',
					fields: [
						{
							key: 'endX', label: 'X', type: 'length', precision: 2, step: 1,
							get: () => this.end.x,
							set: (v) => { this.end.x = v; this.update(); }
						},
						{
							key: 'endY', label: 'Y', type: 'length', precision: 2, step: 1,
							get: () => this.end.y,
							set: (v) => { this.end.y = v; this.update(); }
						}
					]
				},
				{
					title: 'Actions',
					fields: [
						{
							key: 'breakApart',
							label: 'Break Apart',
							type: 'button',
							action: () => {
								undoManager.execute(new BreakApartCommand(this));
							}
						}
					]
				}
			]
		};
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			startX: this.start.x,
			startY: this.start.y,
			endX: this.end.x,
			endY: this.end.y,
			thickness: this.thickness,
			presetName: this.presetName,
			alignment: this.alignment,
			penStyle: this.penStyle,
			colorToken: this.colorToken
		};
	}

	static fromJSON(data) {
		const wall = new Wall([
			data.startX,
			data.startY,
			data.endX,
			data.endY,
			data.thickness,
			data.presetName,
			data.alignment || 'bottom'
		]);
		wall.type = data.type;
		if (data.penStyle) wall.penStyle = data.penStyle;
		if (data.colorToken) wall.colorToken = data.colorToken;
		return wall;
	}
}
