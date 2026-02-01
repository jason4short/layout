/**
 * GeometryFactory - Central registry for geometry type deserialization.
 * Maps geometry type strings to their class fromJSON methods.
 */

import {Shape} 				from './Geometry.js';
import {Line} 				from './Line.js';
import {Circle} 			from './Circle.js';
import {Arc} 				from './Arc.js';
import {TangentArc} 		from './TangentArc.js';
import {Ellipse} 			from './Ellipse.js';
import {EllipticalArc} 		from './EllipticalArc.js';
import {Spline} 			from './Spline.js';
import {Image} 				from './Image.js';
import {Dimension} 			from './Dimension.js';
import {RadialDimension} 	from './RadialDimension.js';
import {AngleDimension} 	from './AngleDimension.js';
import {Text} 				from './Text.js';
import {OutlineText} 		from './OutlineText.js';
import {Paper} 				from './Paper.js';
import {Frame} 				from './Frame.js';
import {SymbolInstance} 	from './Symbol.js';
import {Board} 				from './Board.js';
import {Slot} 				from './Slot.js';
import {Polygon} 			from './Polygon.js';
import {AutoLayoutFrame} 	from './AutoLayoutFrame.js';
import {Mirror} 			from './Mirror.js';

class GeometryFactory {
	constructor() {
		// Registry maps geometry type string to class with fromJSON
		this.registry = new Map();

		// Register all geometry types
		this.register(Shape.LINE, 				Line);
		this.register(Shape.CIRCLE, 			Circle);
		this.register(Shape.ARC, 				Arc);
		this.register(Shape.TANGENT_ARC, 		TangentArc);
		this.register(Shape.ELLIPSE, 			Ellipse);
		this.register(Shape.ELLIPTICAL_ARC,		EllipticalArc);
		this.register(Shape.SPLINE, 			Spline);
		this.register(Shape.IMAGE, 				Image);
		this.register(Shape.DIMENSION, 			Dimension);
		this.register(Shape.RADIAL_DIMENSION, 	RadialDimension);
		this.register(Shape.ANGLE_DIMENSION, 	AngleDimension);
		this.register(Shape.TEXT, 				Text);
		this.register(Shape.OUTLINE_TEXT, 		OutlineText);
		this.register(Shape.PAPER, 				Paper);
		this.register(Shape.FRAME, 				Frame);
		this.register(Shape.SYMBOL, 			SymbolInstance);
		this.register(Shape.BOARD, 				Board);
		this.register(Shape.SLOT, 				Slot);
		this.register(Shape.POLYGON, 			Polygon);
		this.register(Shape.AUTO_LAYOUT_FRAME, 	AutoLayoutFrame);
		this.register(Shape.MIRROR, 			Mirror);
	}

	/**
	 * Register a geometry class for a type
	 * @param {string} type - The Shape type constant (e.g., Shape.LINE)
	 * @param {class} GeometryClass - The class with a static fromJSON method
	 */
	register(type, GeometryClass) {
		if (!GeometryClass.fromJSON) {
			console.warn(`GeometryFactory: ${type} class missing fromJSON method`);
			return;
		}
		this.registry.set(type, GeometryClass);
	}

	/**
	 * Get the class registered for a geometry type
	 * @param {string} type - The Shape type constant
	 * @returns {class|null} The geometry class or null if not found
	 */
	get(type) {
		return this.registry.get(type) || null;
	}

	/**
	 * Create a shape instance from JSON data
	 * @param {object} data - The serialized shape data with geometry type
	 * @returns {Geometry|null} The deserialized shape or null if type unknown
	 */
	fromJSON(data) {
		const GeometryClass = this.registry.get(data.geometry);
		if (!GeometryClass) {
			console.warn('GeometryFactory: Unknown geometry type:', data.geometry);
			return null;
		}
		return GeometryClass.fromJSON(data);
	}

	/**
	 * Check if a geometry type is registered
	 * @param {string} type - The Shape type constant
	 * @returns {boolean}
	 */
	has(type) {
		return this.registry.has(type);
	}

	/**
	 * Get all registered geometry types
	 * @returns {string[]}
	 */
	getTypes() {
		return Array.from(this.registry.keys());
	}
}

// Export singleton instance
const geometryFactory = new GeometryFactory();
export default geometryFactory;
