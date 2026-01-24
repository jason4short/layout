/**
 * GeometrySerializers - Centralized serialization/deserialization for all geometry types.
 * Keeps geometry classes focused on geometry while centralizing data format handling.
 */

// ============ Common Helpers ============

function serializePoint(point) {
	return { x: point.x, y: point.y };
}

function serializeBase(shape) {
	return {
		geometry: shape.geometry,
		type: shape.type,
		penStyle: shape.penStyle,
		colorToken: shape.colorToken
	};
}

// ============ Line ============

export function serializeLine(shape) {
	return {
		...serializeBase(shape),
		start: serializePoint(shape.start),
		end: serializePoint(shape.end)
	};
}

export function deserializeLine(data, LineClass) {
	const line = new LineClass([data.start.x, data.start.y, data.end.x, data.end.y]);
	line.type = data.type;
	if (data.penStyle) line.penStyle = data.penStyle;
	if (data.colorToken) line.colorToken = data.colorToken;
	return line;
}

// ============ Circle ============

export function serializeCircle(shape) {
	return {
		...serializeBase(shape),
		x: shape.x,
		y: shape.y,
		radius: shape.radius,
		radiusAngle: shape.radiusAngle
	};
}

export function deserializeCircle(data, CircleClass) {
	const circle = new CircleClass([data.x, data.y, data.radius, data.radiusAngle || 0]);
	circle.type = data.type;
	if (data.penStyle) circle.penStyle = data.penStyle;
	if (data.colorToken) circle.colorToken = data.colorToken;
	return circle;
}

// ============ Arc ============

export function serializeArc(shape) {
	return {
		...serializeBase(shape),
		x: shape.x,
		y: shape.y,
		radius: shape.radius,
		startAngle: shape.startAngle,
		endAngle: shape.endAngle
	};
}

export function deserializeArc(data, ArcClass) {
	const arc = new ArcClass([data.x, data.y, data.radius, data.startAngle, data.endAngle]);
	arc.type = data.type;
	if (data.penStyle) arc.penStyle = data.penStyle;
	if (data.colorToken) arc.colorToken = data.colorToken;
	return arc;
}

// ============ TangentArc ============

export function serializeTangentArc(shape) {
	return {
		...serializeBase(shape),
		startPoint: serializePoint(shape.startPoint),
		tangentPoint: serializePoint(shape.tangentPoint),
		endPoint: serializePoint(shape.endPoint)
	};
}

export function deserializeTangentArc(data, TangentArcClass) {
	const arc = new TangentArcClass([
		data.startPoint.x, data.startPoint.y,
		data.tangentPoint.x, data.tangentPoint.y,
		data.endPoint.x, data.endPoint.y
	]);
	arc.type = data.type;
	if (data.penStyle) arc.penStyle = data.penStyle;
	if (data.colorToken) arc.colorToken = data.colorToken;
	return arc;
}

// ============ Ellipse ============

export function serializeEllipse(shape) {
	return {
		...serializeBase(shape),
		x: shape.x,
		y: shape.y,
		radiusX: shape.radiusX,
		radiusY: shape.radiusY,
		rotation: shape.rotation,
		cornerAngle: shape.cornerAngle,
		controlMode: shape.controlMode
	};
}

export function deserializeEllipse(data, EllipseClass) {
	const ellipse = new EllipseClass([data.x, data.y, data.radiusX, data.radiusY, data.rotation, data.cornerAngle, data.controlMode || 'center']);
	ellipse.type = data.type;
	if (data.penStyle) ellipse.penStyle = data.penStyle;
	if (data.colorToken) ellipse.colorToken = data.colorToken;
	return ellipse;
}

// ============ EllipticalArc ============

export function serializeEllipticalArc(shape) {
	return {
		...serializeBase(shape),
		x: shape.x,
		y: shape.y,
		radiusX: shape.radiusX,
		radiusY: shape.radiusY,
		rotation: shape.rotation,
		startAngle: shape.startAngle,
		endAngle: shape.endAngle
	};
}

export function deserializeEllipticalArc(data, EllipticalArcClass) {
	const arc = new EllipticalArcClass([
		data.x, data.y,
		data.radiusX, data.radiusY,
		data.rotation,
		data.startAngle, data.endAngle
	]);
	arc.type = data.type;
	if (data.penStyle) arc.penStyle = data.penStyle;
	if (data.colorToken) arc.colorToken = data.colorToken;
	return arc;
}

// ============ Spline ============

export function serializeSpline(shape) {
	return {
		...serializeBase(shape),
		p0: serializePoint(shape.p0),
		p1: serializePoint(shape.p1),
		p2: serializePoint(shape.p2),
		p3: serializePoint(shape.p3)
	};
}

export function deserializeSpline(data, SplineClass) {
	const spline = new SplineClass([
		data.p0.x, data.p0.y,
		data.p1.x, data.p1.y,
		data.p2.x, data.p2.y,
		data.p3.x, data.p3.y
	]);
	spline.type = data.type;
	if (data.penStyle) spline.penStyle = data.penStyle;
	if (data.colorToken) spline.colorToken = data.colorToken;
	return spline;
}

// ============ Dimension ============

export function serializeDimension(shape) {
	return {
		...serializeBase(shape),
		start: serializePoint(shape.start),
		end: serializePoint(shape.end),
		offset: shape.offset
	};
}

export function deserializeDimension(data, DimensionClass) {
	const dim = new DimensionClass([
		data.start.x, data.start.y,
		data.end.x, data.end.y,
		data.offset
	]);
	dim.type = data.type;
	if (data.penStyle) dim.penStyle = data.penStyle;
	if (data.colorToken) dim.colorToken = data.colorToken;
	return dim;
}

// ============ RadialDimension ============

export function serializeRadialDimension(shape) {
	return {
		...serializeBase(shape),
		center: serializePoint(shape.center),
		radius: shape.radius,
		angle: shape.angle,
		mode: shape.mode,
		textX: shape.textX,
		textY: shape.textY
	};
}

export function deserializeRadialDimension(data, RadialDimensionClass) {
	const dim = new RadialDimensionClass([
		data.center.x, data.center.y,
		data.radius,
		data.angle || 0,
		data.mode || 'radius',
		data.textX !== undefined ? data.textX : null,
		data.textY !== undefined ? data.textY : null
	]);
	dim.type = data.type;
	if (data.penStyle) dim.penStyle = data.penStyle;
	if (data.colorToken) dim.colorToken = data.colorToken;
	return dim;
}

// ============ AngleDimension ============

export function serializeAngleDimension(shape) {
	const json = {
		...serializeBase(shape),
		vertex: serializePoint(shape.vertex),
		startAngle: shape.startAngle,
		endAngle: shape.endAngle,
		arcRadius: shape.arcRadius
	};
	if (shape.click1) json.click1 = serializePoint(shape.click1);
	if (shape.click2) json.click2 = serializePoint(shape.click2);
	if (shape.line1 && shape.line1.id) json.line1Id = shape.line1.id;
	if (shape.line2 && shape.line2.id) json.line2Id = shape.line2.id;
	return json;
}

export function deserializeAngleDimension(data, AngleDimensionClass) {
	const dim = new AngleDimensionClass([
		data.vertex.x, data.vertex.y,
		data.startAngle || 0,
		data.endAngle || Math.PI / 2,
		data.arcRadius || 40,
		data.click1 || null,
		data.click2 || null
	]);
	dim.type = data.type;
	if (data.penStyle) dim.penStyle = data.penStyle;
	if (data.colorToken) dim.colorToken = data.colorToken;
	// Store IDs for later linking
	dim._line1Id = data.line1Id || null;
	dim._line2Id = data.line2Id || null;
	return dim;
}

// ============ Text ============

export function serializeText(shape) {
	return {
		...serializeBase(shape),
		x: shape.x,
		y: shape.y,
		text: shape.text,
		fontSize: shape.fontSize,
		fontFamily: shape.fontFamily,
		fontWeight: shape.fontWeight,
		fontStyle: shape.fontStyle,
		alignment: shape.alignment,
		boxWidth: shape.boxWidth,
		boxHeight: shape.boxHeight,
		rotation: shape.rotation
	};
}

export function deserializeText(data, TextClass, PenStyle) {
	const text = new TextClass([
		data.x, data.y,
		data.text,
		data.fontSize,
		data.fontFamily
	]);
	text.fontWeight = data.fontWeight || 'normal';
	text.fontStyle = data.fontStyle || 'normal';
	text.alignment = data.alignment || 'left';
	text.boxWidth = data.boxWidth || null;
	text.boxHeight = data.boxHeight || null;
	text.rotation = data.rotation || 0;
	text.penStyle = data.penStyle || PenStyle.VISIBLE;
	if (data.colorToken) text.colorToken = data.colorToken;
	return text;
}

// ============ Paper ============

export function serializePaper(shape) {
	return {
		...serializeBase(shape),
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
		paperSize: shape.paperSize,
		scale: shape.scale
	};
}

export function deserializePaper(data, PaperClass) {
	const paper = new PaperClass([data.x, data.y, data.width, data.height, data.paperSize, data.scale]);
	paper.type = data.type;
	if (data.penStyle) paper.penStyle = data.penStyle;
	if (data.colorToken) paper.colorToken = data.colorToken;
	return paper;
}

// ============ Image ============

export function serializeImage(shape) {
	return {
		...serializeBase(shape),
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
		rotation: shape.rotation,
		flipX: shape.flipX,
		flipY: shape.flipY,
		opacity: shape.opacity,
		locked: shape.locked,
		src: shape.src
	};
}

export function deserializeImage(data, ImageClass) {
	const img = new ImageClass([data.x, data.y, data.width, data.height]);
	img.type = data.type;
	if (data.penStyle) img.penStyle = data.penStyle;
	if (data.colorToken) img.colorToken = data.colorToken;
	if (data.locked !== undefined) img.locked = data.locked;
	if (data.rotation !== undefined) img.rotation = data.rotation;
	if (data.flipX !== undefined) img.flipX = data.flipX;
	if (data.flipY !== undefined) img.flipY = data.flipY;
	if (data.opacity !== undefined) img.opacity = data.opacity;
	if (data.src) {
		img.loadImage(data.src);
	}
	return img;
}

// ============ Symbol Instance ============
// Symbol instances use sourceGroupId and offset (new simplified model)

export function serializeSymbol(shape) {
	return {
		...serializeBase(shape),
		sourceGroupId: shape.sourceGroupId,
		offsetX: shape.offsetX,
		offsetY: shape.offsetY
	};
}

export function deserializeSymbol(data, SymbolInstanceClass) {
	const inst = new SymbolInstanceClass([
		data.sourceGroupId,
		data.offsetX,
		data.offsetY
	]);
	inst.type = data.type;
	if (data.penStyle) inst.penStyle = data.penStyle;
	if (data.colorToken) inst.colorToken = data.colorToken;
	return inst;
}
