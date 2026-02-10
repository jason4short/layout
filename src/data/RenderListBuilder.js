import { Shape } from '../geometry/Geometry.js';

function pushPartitioned(shape, unselected, selected) {
	if (!shape) return;
	if (shape.selected) selected.push(shape);
	else unselected.push(shape);
}

function pushPartitionedList(list, unselected, selected) {
	for (const item of list) {
		pushPartitioned(item, unselected, selected);
	}
}

/**
 * Build the ordered render list and symbol-instance list.
 * Preserves category ordering while ensuring selected shapes render last.
 */
export function buildRenderList(shapes, constructions, guides, shapePreviews) {
	const papers = [];
	const frames = [];
	const images = [];
	const symbols = []; // Keep track of symbol instances for selection boxes
	const other = [];
	const unselected = [];
	const selected = [];

	for (const s of shapes) {
		if (s.geometry === Shape.PAPER) {
			papers.push(s);
		} else if (s.geometry === Shape.FRAME) {
			frames.push(s);
		} else if (s.geometry === Shape.IMAGE) {
			images.push(s);
		} else if (s.geometry === Shape.SYMBOL) {
			// Expand symbol into its transformed shapes
			symbols.push(s);
			const symbolShapes = s.getShapesForRender();
			other.push(...symbolShapes);
		} else {
			// All shapes (including frame shapes) store world coords
			// No translation needed
			other.push(s);
		}
	}

	pushPartitionedList(papers, unselected, selected);
	pushPartitionedList(frames, unselected, selected);
	pushPartitionedList(images, unselected, selected);
	pushPartitionedList(other, unselected, selected);
	pushPartitionedList(constructions, unselected, selected);
	pushPartitionedList(guides, unselected, selected);
	pushPartitionedList(shapePreviews, unselected, selected);

	return {
		renderList: [...unselected, ...selected],
		symbolInstances: symbols
	};
}
