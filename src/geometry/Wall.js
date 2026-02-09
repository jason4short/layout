import { Shape } from './Geometry.js';
import { Board } from './Board.js';
import { wallSchema } from './InspectorSchemas.js';
import { serializeBoard, deserializeBoard } from './GeometrySerializers.js';

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
		// Default alignment to 'bottom' (Right) for walls (override Board's 'top' default)
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
		return wallSchema(this, WALL_PRESETS);
	}

	toJSON() {
		return serializeBoard(this);
	}

	static fromJSON(data) {
		return deserializeBoard(data, Wall, 'bottom');
	}
}
