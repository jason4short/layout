import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Text} 				from '../geometry/Text.js';
import {AddShapeCommand} 	from '../core/Commands.js';

import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import toolManager			from './ToolManager.js';
import inspector			from '../core/Inspector.js';

const STATE = {
	IDLE: 0,
	EDITING: 1
};

export class TextTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Text";
		this.usage 	= "Click to place text, then type. Escape to finish.";

		this.generateGuides 	= false;

		// Defaults for new text (remembered across placements)
		this.defaultFontSize 	= 16;
		this.defaultFontFamily 	= 'Outfit';
		this.defaultFontWeight 	= 'normal';
		this.defaultFontStyle 	= 'normal';

		this.state 				= STATE.IDLE;
		this.text 				= null;
		this.isEditingExisting 	= false;
		this.cursorVisible 		= true;
		this.cursorBlinkTimer 	= null;
		this._textarea 			= null;
		this._blurTimeout 		= null;
		this._positionSyncTimer = null;
		this._resizeObserver 	= null;
		this._expectedWidth 	= 0;
		this._expectedHeight 	= 0;

		// Cursor/selection state (synced from textarea)
		this.cursorPos 			= 0;
		this.selectionStart 	= null;
		this.selectionEnd 		= null;

		this.onMouseDown 			= this.onMouseDown.bind(this);
		this._onInput 				= this._onInput.bind(this);
		this._onKeydown 			= this._onKeydown.bind(this);
		this._onSelectionChange 	= this._onSelectionChange.bind(this);
		this._onBlur 				= this._onBlur.bind(this);
	}

	begin(){
		this.state = STATE.IDLE;
		this._textarea = document.getElementById('textEditInput');
		inspector.showToolPanel(this);
	}

	deactivate(){
		this.commitText();
		inspector.clearToolPanel();
	}

	getInspectorSchema(){
		const fontOptions = [
			{ value: 'Outfit', label: 'Outfit' },
			{ value: 'Arial', label: 'Arial' },
			{ value: 'Helvetica', label: 'Helvetica' },
			{ value: 'Times New Roman', label: 'Times New Roman' },
			{ value: 'Georgia', label: 'Georgia' },
			{ value: 'Courier New', label: 'Courier New' },
			{ value: 'Verdana', label: 'Verdana' },
			{ value: 'Tahoma', label: 'Tahoma' },
			{ value: 'Trebuchet MS', label: 'Trebuchet MS' },
			{ value: 'Impact', label: 'Impact' },
			{ value: 'Comic Sans MS', label: 'Comic Sans MS' }
		];

		// Edit the active text shape if editing, otherwise show defaults
		const target = this.text || this;
		const isText = !!this.text;
		const getFontFamily = () => isText ? target.fontFamily : this.defaultFontFamily;
		const getFontSize   = () => isText ? target.fontSize   : this.defaultFontSize;
		const getFontWeight = () => isText ? target.fontWeight  : this.defaultFontWeight;
		const getFontStyle  = () => isText ? target.fontStyle   : this.defaultFontStyle;

		return {
			name: 'Text',
			sections: [
				{
					title: 'Font',
					fields: [
						{
							key: 'fontFamily',
							label: 'Family',
							type: 'select',
							options: fontOptions,
							get: getFontFamily,
							set: (v) => {
								if (this.text) { this.text.fontFamily = v; this.text.update(); this._positionTextarea(); stage.render(); }
								this.defaultFontFamily = v;
							}
						},
						{
							key: 'fontSize',
							label: 'Size',
							type: 'number',
							min: 1, max: 500, step: 1, precision: 0,
							get: getFontSize,
							set: (v) => {
								if (this.text) { this.text.fontSize = v; this.text.update(); this._positionTextarea(); stage.render(); }
								this.defaultFontSize = v;
							}
						},
						{
							key: 'fontWeight',
							label: 'Bold',
							type: 'checkbox',
							get: () => getFontWeight() === 'bold',
							set: (v) => {
								const w = v ? 'bold' : 'normal';
								if (this.text) { this.text.fontWeight = w; this.text.update(); this._positionTextarea(); stage.render(); }
								this.defaultFontWeight = w;
							}
						},
						{
							key: 'fontStyle',
							label: 'Italic',
							type: 'checkbox',
							get: () => getFontStyle() === 'italic',
							set: (v) => {
								const s = v ? 'italic' : 'normal';
								if (this.text) { this.text.fontStyle = s; this.text.update(); this._positionTextarea(); stage.render(); }
								this.defaultFontStyle = s;
							}
						}
					]
				}
			]
		};
	}

	updateCursor(){
		stage.setCursor('text');
	}

	reset(){
		if(this.state === STATE.EDITING && this.text){
			this.commitText();
			return;
		}

		this.state = STATE.IDLE;
		this.text = null;
		this.isEditingExisting = false;
		this._hideTextarea();
		this.stopCursorBlink();
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	startCursorBlink(){
		this.stopCursorBlink();
		this.cursorVisible = true;
		this.emitCursorInfo();

		this.cursorBlinkTimer = setInterval(() => {
			this.cursorVisible = !this.cursorVisible;
			this.emitCursorInfo();
			stage.render();
		}, 530);
	}

	stopCursorBlink(){
		if(this.cursorBlinkTimer){
			clearInterval(this.cursorBlinkTimer);
			this.cursorBlinkTimer = null;
		}
		this.cursorVisible = false;
		this.emitCursorInfo();
	}

	onMouseDown(e)
	{
		const worldPos = { x: data.snapPoint.x, y: data.snapPoint.y };
		const clickedText = this.findTextAtPoint(worldPos);

		if(this.state === STATE.EDITING){
			if(this.text){
				const hit = this.text.getGeoSnap(worldPos, null, 5);
				if(hit){
					// Keep edit mode active when clicking inside the current text.
					clearTimeout(this._blurTimeout);
					this._blurTimeout = null;

					// Reposition cursor via click within the text
					const newPos = this.getCursorPosFromClick(this.text, worldPos);
					if(this._textarea){
						this._textarea.focus({ preventScroll: true });
						this._textarea.setSelectionRange(newPos, newPos);
					}
					this._syncCursor();
					return;
				}
			}

			// Clicked outside current text - commit it
			this.commitText();

			if(clickedText){
				this._startEditing(clickedText, worldPos);
			} else {
				toolManager.setTool(toolManager.pointerTool);
			}
			return;
		}

		if(clickedText){
			this._startEditing(clickedText, worldPos);
			return;
		}

		// Create new text at click position
		data.selectNone();
		this.text = new Text([worldPos.x, worldPos.y, '', this.defaultFontSize, this.defaultFontFamily]);
		this.text.fontWeight = this.defaultFontWeight;
		this.text.fontStyle = this.defaultFontStyle;
		this.isEditingExisting = false;
		data.addTempShape(this.text);

		this.state = STATE.EDITING;
		this._showTextarea('');
		this.startCursorBlink();
		inspector.showToolPanel(this);
		stage.render();
	}

	onMouseMove(e){}
	onMouseUp(e){}

	// Begin editing an existing text shape
	_startEditing(textShape, clickPos)
	{
		this.text = textShape;
		this.isEditingExisting = true;

		data.deleteShape(this.text);
		data.addTempShape(this.text);

		this.state = STATE.EDITING;
		this._showTextarea(textShape.text);

		const pos = clickPos ? this.getCursorPosFromClick(textShape, clickPos) : textShape.text.length;
		if(this._textarea) this._textarea.setSelectionRange(pos, pos);
		this._syncCursor();

		this.startCursorBlink();
		inspector.showToolPanel(this);
		stage.render();
	}

	_showTextarea(value)
	{
		if(!this._textarea) return;

		// Cancel any pending blur-commit from a previous edit
		clearTimeout(this._blurTimeout);
		this._blurTimeout = null;

		// Remove old listeners before re-adding (prevents duplicates)
		this._removeTextareaListeners();

		this._textarea.value = value;
		this._textarea.addEventListener('input', this._onInput);
		this._textarea.addEventListener('keydown', this._onKeydown);
		this._textarea.addEventListener('blur', this._onBlur);
		document.addEventListener('selectionchange', this._onSelectionChange);
		this._setTextEditingFlag(true);
		this._positionTextarea();
		this._startPositionSync();
		this._startResizeObserver();
		this._focusTextareaAtEnd();

		// Some browsers can briefly refuse focus on off-screen inputs.
		// Retry on next frame so typing still works reliably.
		requestAnimationFrame(() => {
			if(this.state !== STATE.EDITING || !this._textarea) return;
			if(document.activeElement !== this._textarea){
				this._focusTextareaAtEnd();
			}
		});
	}

	_focusTextareaAtEnd()
	{
		if(!this._textarea) return;
		const end = this._textarea.value.length;
		this._textarea.focus({ preventScroll: true });
		this._textarea.setSelectionRange(end, end);
		this._syncCursor();
	}

	_hideTextarea()
	{
		if(!this._textarea) return;
		// Remove listeners before blurring so blur doesn't trigger _onBlur
		clearTimeout(this._blurTimeout);
		this._blurTimeout = null;
		this._stopPositionSync();
		this._stopResizeObserver();
		this._setTextEditingFlag(false);
		this._textarea.style.top = '-9999px';
		this._textarea.style.left = '-9999px';
		this._textarea.style.width = '1px';
		this._textarea.style.height = '1px';
		this._textarea.style.opacity = '0';
		this._textarea.style.pointerEvents = 'none';
		this._removeTextareaListeners();
		this._textarea.blur();
	}

	_removeTextareaListeners()
	{
		if(!this._textarea) return;
		this._textarea.removeEventListener('input', this._onInput);
		this._textarea.removeEventListener('keydown', this._onKeydown);
		this._textarea.removeEventListener('blur', this._onBlur);
		document.removeEventListener('selectionchange', this._onSelectionChange);
	}

	_onInput(e)
	{
		if(!this.text) return;
		this.text.text = this._textarea.value;
		this.text.update();
		this._positionTextarea();
		this._syncCursor();
		this.cursorVisible = true;
		this.emitCursorInfo();
		stage.render();
	}

	_onKeydown(e)
	{
		if(e.key === 'Escape'){
			e.preventDefault();
			this.commitText();
			return;
		}

		// Sync cursor after navigation keys (browser updates selectionStart after event)
		if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
			setTimeout(() => this._syncCursor(), 0);
		}
	}

	_onBlur(e)
	{
		// Delayed commit so click events can process first (e.g. clicking another text shape)
		this._blurTimeout = setTimeout(() => {
			this._blurTimeout = null;
			if(document.activeElement === this._textarea) return;
			if(this.state === STATE.EDITING){
				this.commitText();
			}
		}, 50);
	}

	_onSelectionChange()
	{
		if(document.activeElement === this._textarea){
			this._syncCursor();
		}
	}

	// Read selection from textarea and sync to canvas cursor rendering
	_syncCursor()
	{
		if(!this._textarea) return;
		this.cursorPos = this._textarea.selectionStart;
		const hasSel = this._textarea.selectionStart !== this._textarea.selectionEnd;
		this.selectionStart = hasSel ? this._textarea.selectionStart : null;
		this.selectionEnd   = hasSel ? this._textarea.selectionEnd   : null;
		this.emitCursorInfo();
		stage.render();
	}

	findTextAtPoint(point){
		for(const shape of data.shapes){
			if(shape.geometry === Shape.TEXT){
				const hit = shape.getGeoSnap(point, null, 5);
				if(hit) return shape;
			}
		}
		return null;
	}

	// Calculate character index from a world-space click position
	getCursorPosFromClick(textShape, clickPoint){
		const ctx = stage.canvas.getContext('2d');

		const fontStyle  = textShape.fontStyle  === 'italic' ? 'italic' : '';
		const fontWeight = textShape.fontWeight === 'bold'   ? 'bold'   : '';
		ctx.font = `${fontStyle} ${fontWeight} ${textShape.fontSize}px ${textShape.fontFamily}`.trim();

		const lineHeight = textShape.fontSize * 1.2;
		const lines      = textShape.text.split('\n');

		const relativeY  = clickPoint.y - textShape.y;
		let clickedLine  = Math.floor(relativeY / lineHeight);
		clickedLine      = Math.max(0, Math.min(clickedLine, lines.length - 1));

		const relativeX = clickPoint.x - textShape.x;
		const line      = lines[clickedLine];

		let charPos = 0;
		for(let i = 0; i <= line.length; i++){
			const width = ctx.measureText(line.slice(0, i)).width;
			if(width >= relativeX){
				if(i > 0){
					const prevWidth = ctx.measureText(line.slice(0, i - 1)).width;
					charPos = (relativeX - prevWidth < width - relativeX) ? i - 1 : i;
				} else {
					charPos = 0;
				}
				break;
			}
			charPos = i;
		}

		let absolutePos = 0;
		for(let i = 0; i < clickedLine; i++){
			absolutePos += lines[i].length + 1; // +1 for newline
		}
		absolutePos += charPos;
		return absolutePos;
	}

	commitText(){
		if(!this.text) return;

		this._hideTextarea();
		this.stopCursorBlink();

		// Height is always content-driven; clear any fixed boxHeight
		this.text.boxHeight = null;
		this.text.update();

		const textToSelect = this.text;

		if(this.text.text.trim().length > 0){
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.text));
			data.selectNone();
			textToSelect.selected = true;
		} else {
			data.clearTempShapes();
		}

		this.state = STATE.IDLE;
		this.text = null;
		this.cursorPos = 0;
		this.selectionStart = null;
		this.selectionEnd = null;
		stage.render();
	}

	// Called by renderer to get cursor info for canvas drawing
	getCursorInfo(){
		if(this.state !== STATE.EDITING || !this.text) return null;

		const info = {
			text: this.text,
			position: this.cursorPos || 0,
			cursorVisible: this.cursorVisible
		};

		if(this.selectionStart !== null && this.selectionEnd !== null && this.selectionStart !== this.selectionEnd){
			info.selectionStart = Math.min(this.selectionStart, this.selectionEnd);
			info.selectionEnd   = Math.max(this.selectionStart, this.selectionEnd);
		}

		return info;
	}

	emitCursorInfo(){
		stage.dispatchEvent('text-cursor-update', this.getCursorInfo());
	}

	_setTextEditingFlag(isEditing)
	{
		if(!this.text) return;
		this.text._editingWithTextarea = isEditing;
	}

	_startPositionSync()
	{
		this._stopPositionSync();
		this._positionSyncTimer = setInterval(() => {
			if(this.state !== STATE.EDITING || !this.text) return;
			this._positionTextarea();
		}, 50);
	}

	_stopPositionSync()
	{
		if(this._positionSyncTimer){
			clearInterval(this._positionSyncTimer);
			this._positionSyncTimer = null;
		}
	}

	_startResizeObserver()
	{
		this._stopResizeObserver();
		if(!this._textarea) return;

		this._resizeObserver = new ResizeObserver((entries) => {
			if(!this.text || this.state !== STATE.EDITING) return;

			const entry = entries[0];
			const w = Math.round(entry.contentRect.width);

			// Ignore programmatic resizes from _positionTextarea
			if(Math.abs(w - this._expectedWidth) < 2) return;

			// User dragged the resize handle — convert screen px to world coords
			this.text.boxWidth = w / stage.zoom;
			this.text.update();
			this._positionTextarea();
			stage.render();
		});

		this._resizeObserver.observe(this._textarea);
	}

	_stopResizeObserver()
	{
		if(this._resizeObserver){
			this._resizeObserver.disconnect();
			this._resizeObserver = null;
		}
	}

	_positionTextarea()
	{
		if(!this._textarea || !this.text) return;

		// worldToScreen gives canvas-local coords; add canvas rect for fixed positioning
		const canvasRect = stage.canvas.getBoundingClientRect();
		const screenPos  = stage.worldToScreen(this.text.bounds.x, this.text.y);

		const fontPx    = Math.max(12, this.text.fontSize * stage.zoom);
		const lineHeight = fontPx * 1.2;
		const lines      = this._textarea.value.split('\n');

		const ctx = stage.canvas.getContext('2d');
		const fontStyle  = this.text.fontStyle  === 'italic' ? 'italic' : '';
		const fontWeight = this.text.fontWeight === 'bold'   ? 'bold'   : '';
		ctx.font = `${fontStyle} ${fontWeight} ${fontPx}px ${this.text.fontFamily}`.trim();

		let maxLineWidth = 0;
		for(const line of lines){
			maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
		}

		const width  = Math.max(80,  Math.ceil(this.text.boxWidth ? this.text.boxWidth * stage.zoom : maxLineWidth + fontPx));
		const height = Math.max(lineHeight, Math.ceil(Math.max(1, lines.length) * lineHeight));

		const border = 1;

		// Track expected content size so ResizeObserver can distinguish user resizes
		// (contentRect excludes border, so track the content area)
		this._expectedWidth  = Math.round(width);
		this._expectedHeight = Math.round(height);

		// Offset by border width so text content aligns with canvas rendering
		this._textarea.style.top    = `${Math.round(canvasRect.top  + screenPos.y) - border}px`;
		this._textarea.style.left   = `${Math.round(canvasRect.left + screenPos.x) - border}px`;
		this._textarea.style.width  = `${width + border * 2}px`;
		this._textarea.style.height = `${height + border * 2}px`;
		this._textarea.style.padding       = '0';
		this._textarea.style.opacity       = '1';
		this._textarea.style.pointerEvents = 'auto';
		this._textarea.style.fontFamily    = this.text.fontFamily;
		this._textarea.style.fontSize      = `${fontPx}px`;
		this._textarea.style.fontStyle     = this.text.fontStyle;
		this._textarea.style.fontWeight    = this.text.fontWeight;
		this._textarea.style.lineHeight    = `${lineHeight}px`;
		this._textarea.style.whiteSpace    = this.text.boxWidth ? 'pre-wrap' : 'pre';
		this._textarea.style.wordBreak     = this.text.boxWidth ? 'break-word' : 'normal';
	}
}
