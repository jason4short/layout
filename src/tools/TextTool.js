import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Text} 				from '../geometry/Text.js';
import {AddShapeCommand} 	from '../core/Commands.js';

import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import toolManager			from './ToolManager.js';

const STATE = {
	IDLE: 0,
	EDITING: 1      // Typing text on canvas
};

export class TextTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Text";
		this.usage 	= "Click to place text, then type. Enter for new line, Escape to finish.";

		this.generateGuides 	= false;

		this.state 				= STATE.IDLE;
		this.text 				= null;
		this.cursorPos 			= 0;  // Character position in text
		this.selectionStart 	= null;  // Start of selection (null = no selection)
		this.selectionEnd 		= null;  // End of selection
		this.isSelecting 		= false; // Currently dragging to select
		this.cursorVisible 		= true;
		this.cursorBlinkTimer 	= null;
		this.isEditingExisting 	= false;

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
		this.onKeyDown 			= this.onKeyDown.bind(this);
	}

	begin(){
		this.state = STATE.IDLE;
		// Add keyboard listener for text input
		stage.addEventListener('keyDown', this.onKeyDown);
	}

	exit(){
		this.commitText();
		stage.removeEventListener('keyDown', this.onKeyDown);
		this.stopCursorBlink();
	}

	updateCursor(){
		stage.setCursor('text');
	}

	reset(){
		// If editing, commit the text first
		if(this.state === STATE.EDITING && this.text){
			this.commitText();
			return;
		}

		this.state = STATE.IDLE;
		this.text = null;
		this.cursorPos = 0;
		this.selectionStart = null;
		this.selectionEnd = null;
		this.isSelecting = false;
		this.isEditingExisting = false;
		this.stopCursorBlink();
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	startCursorBlink(){
		this.stopCursorBlink();
		this.cursorVisible = true;
		this.cursorBlinkTimer = setInterval(() => {
			this.cursorVisible = !this.cursorVisible;
			stage.render();
		}, 530);
	}

	stopCursorBlink(){
		if(this.cursorBlinkTimer){
			clearInterval(this.cursorBlinkTimer);
			this.cursorBlinkTimer = null;
		}
		this.cursorVisible = false;
	}

	clearSelection(){
		this.selectionStart = null;
		this.selectionEnd = null;
		this.isSelecting = false;
	}

	hasSelection(){
		return this.selectionStart !== null && this.selectionEnd !== null && this.selectionStart !== this.selectionEnd;
	}

	getSelectionRange(){
		if(!this.hasSelection()) return null;
		const start = Math.min(this.selectionStart, this.selectionEnd);
		const end = Math.max(this.selectionStart, this.selectionEnd);
		return { start, end };
	}

	deleteSelection(){
		const range = this.getSelectionRange();
		if(!range) return false;

		const before = this.text.text.slice(0, range.start);
		const after = this.text.text.slice(range.end);
		this.text.text = before + after;
		this.cursorPos = range.start;
		this.clearSelection();
		this.text.update();
		return true;
	}

	onMouseDown(e)
	{
		// Use snap point which is already in world coordinates
		const worldPos = { x: data.snapPoint.x, y: data.snapPoint.y };

		// Check if clicking on existing text to edit it
		const clickedText = this.findTextAtPoint(worldPos);

		if(this.state === STATE.EDITING){
			// Check if clicking within the text being edited
			if(this.text){
				const hit = this.text.getGeoSnap(worldPos, null, 5);
				if(hit){
					// Clicking within current text - position cursor
					const newPos = this.getCursorPosFromClick(this.text, worldPos);

					if(stage.shiftKey && this.selectionStart === null){
						// Shift+click with no selection - select from cursor to click
						this.selectionStart = this.cursorPos;
						this.selectionEnd = newPos;
						this.cursorPos = newPos;
					} else if(stage.shiftKey){
						// Shift+click with selection - extend selection
						this.selectionEnd = newPos;
						this.cursorPos = newPos;
					} else {
						// Normal click - start potential drag selection
						this.cursorPos = newPos;
						this.selectionStart = newPos;
						this.selectionEnd = null;
						this.isSelecting = true;
					}
					this.cursorVisible = true;
					stage.render();
					return;
				}
			}

			// Commit current text
			this.commitText();

			// If clicked on another text, edit that one
			if(clickedText){
				this.text = clickedText;
				this.cursorPos = this.getCursorPosFromClick(clickedText, worldPos);
				this.isEditingExisting = true;
				this.clearSelection();
				data.deleteShape(this.text);
				data.addTempShape(this.text);
				this.state = STATE.EDITING;
				this.startCursorBlink();
				stage.render();
			} else {
				// Clicked on blank canvas - switch to pointer tool
				toolManager.setTool(toolManager.pointerTool);
			}
			return;
		}

		// Not editing - check if clicking existing text
		if(clickedText){
			// Edit existing text
			this.text = clickedText;
			this.cursorPos = this.getCursorPosFromClick(clickedText, worldPos);
			this.isEditingExisting = true;
			this.clearSelection();

			// Remove from shapes temporarily and add to temp
			data.deleteShape(this.text);
			data.addTempShape(this.text);

			this.state = STATE.EDITING;
			this.startCursorBlink();
			stage.render();
			return;
		}

		// Create new text at click position (empty, just cursor)
		data.selectNone();
		this.text = new Text([worldPos.x, worldPos.y, '', 16, 'Arial']);
		this.cursorPos = 0;
		this.isEditingExisting = false;
		this.clearSelection();
		data.addTempShape(this.text);

		this.state = STATE.EDITING;
		this.startCursorBlink();
		stage.render();
	}

	findTextAtPoint(point){
		// Find text shape at click point
		for(const shape of data.shapes){
			if(shape.geometry === Shape.TEXT){
				const hit = shape.getGeoSnap(point, null, 5);
				if(hit){
					return shape;
				}
			}
		}
		return null;
	}

	getCursorPosFromClick(textShape, clickPoint){
		// Use canvas to measure text accurately
		const canvas = stage.canvas;
		const ctx = canvas.getContext('2d');

		const fontStyle = textShape.fontStyle === 'italic' ? 'italic' : '';
		const fontWeight = textShape.fontWeight === 'bold' ? 'bold' : '';
		ctx.font = `${fontStyle} ${fontWeight} ${textShape.fontSize}px ${textShape.fontFamily}`.trim();

		const lineHeight = textShape.fontSize * 1.2;
		const lines = textShape.text.split('\n');

		// Find which line was clicked
		const relativeY = clickPoint.y - textShape.y;
		let clickedLine = Math.floor(relativeY / lineHeight);
		clickedLine = Math.max(0, Math.min(clickedLine, lines.length - 1));

		// Find character position within the line
		const relativeX = clickPoint.x - textShape.x;
		const line = lines[clickedLine];

		let charPos = 0;
		for(let i = 0; i <= line.length; i++){
			const width = ctx.measureText(line.slice(0, i)).width;
			if(width >= relativeX){
				// Check if click is closer to this char or previous
				if(i > 0){
					const prevWidth = ctx.measureText(line.slice(0, i - 1)).width;
					if(relativeX - prevWidth < width - relativeX){
						charPos = i - 1;
					} else {
						charPos = i;
					}
				} else {
					charPos = 0;
				}
				break;
			}
			charPos = i;
		}

		// Convert line + charPos to absolute cursor position
		let absolutePos = 0;
		for(let i = 0; i < clickedLine; i++){
			absolutePos += lines[i].length + 1; // +1 for newline
		}
		absolutePos += charPos;

		return absolutePos;
	}

	onMouseMove(e){
		// Handle drag selection
		if(this.state === STATE.EDITING && this.isSelecting && this.text){
			const worldPos = { x: data.snapPoint.x, y: data.snapPoint.y };
			const newPos = this.getCursorPosFromClick(this.text, worldPos);
			this.selectionEnd = newPos;
			this.cursorPos = newPos;
			this.cursorVisible = true;
			stage.render();
		}
	}

	onMouseUp(e){
		// Finalize selection
		if(this.isSelecting){
			this.isSelecting = false;
			// If start and end are the same, clear selection (it was just a click)
			if(this.selectionStart === this.selectionEnd){
				this.selectionStart = null;
				this.selectionEnd = null;
			}
			stage.render();
		}
	}

	onKeyDown(e){
		if(this.state !== STATE.EDITING || !this.text) return;

		const key = e.key;

		// Handle Cmd+A (select all)
		if((e.metaKey || e.ctrlKey) && key === 'a'){
			this.selectionStart = 0;
			this.selectionEnd = this.text.text.length;
			this.cursorPos = this.text.text.length;
			this.cursorVisible = true;
			stage.render();
			return;
		}

		// Don't handle other keys if Cmd/Ctrl/Alt are pressed (except shift)
		if(e.ctrlKey || e.metaKey || e.altKey) return;

		if(key === 'Enter'){
			// Delete selection first if any
			this.deleteSelection();
			// Enter = newline
			this.insertChar('\n');
			return;
		}

		if(key === 'Backspace'){
			// If selection, delete it
			if(this.hasSelection()){
				this.deleteSelection();
				stage.render();
				return;
			}
			// Otherwise delete char before cursor
			if(this.cursorPos > 0){
				const before = this.text.text.slice(0, this.cursorPos - 1);
				const after = this.text.text.slice(this.cursorPos);
				this.text.text = before + after;
				this.cursorPos--;
				this.text.update();
				stage.render();
			}
			return;
		}

		if(key === 'Delete'){
			// If selection, delete it
			if(this.hasSelection()){
				this.deleteSelection();
				stage.render();
				return;
			}
			// Otherwise delete char after cursor
			if(this.cursorPos < this.text.text.length){
				const before = this.text.text.slice(0, this.cursorPos);
				const after = this.text.text.slice(this.cursorPos + 1);
				this.text.text = before + after;
				this.text.update();
				stage.render();
			}
			return;
		}

		if(key === 'ArrowLeft'){
			if(e.shiftKey){
				// Extend selection
				if(this.selectionStart === null){
					this.selectionStart = this.cursorPos;
				}
				if(this.cursorPos > 0){
					this.cursorPos--;
					this.selectionEnd = this.cursorPos;
				}
			} else {
				// Collapse selection or move cursor
				if(this.hasSelection()){
					const range = this.getSelectionRange();
					this.cursorPos = range.start;
					this.clearSelection();
				} else if(this.cursorPos > 0){
					this.cursorPos--;
				}
			}
			this.cursorVisible = true;
			stage.render();
			return;
		}

		if(key === 'ArrowRight'){
			if(e.shiftKey){
				// Extend selection
				if(this.selectionStart === null){
					this.selectionStart = this.cursorPos;
				}
				if(this.cursorPos < this.text.text.length){
					this.cursorPos++;
					this.selectionEnd = this.cursorPos;
				}
			} else {
				// Collapse selection or move cursor
				if(this.hasSelection()){
					const range = this.getSelectionRange();
					this.cursorPos = range.end;
					this.clearSelection();
				} else if(this.cursorPos < this.text.text.length){
					this.cursorPos++;
				}
			}
			this.cursorVisible = true;
			stage.render();
			return;
		}

		if(key === 'ArrowUp'){
			if(e.shiftKey){
				// Extend selection vertically
				if(this.selectionStart === null){
					this.selectionStart = this.cursorPos;
				}
				const moved = this.moveCursorVertically(-1, true);
				// If couldn't move up (on first line), go to start of text
				if(!moved){
					this.cursorPos = 0;
				}
				this.selectionEnd = this.cursorPos;
				this.cursorVisible = true;
				stage.render();
			} else {
				if(this.hasSelection()){
					const range = this.getSelectionRange();
					this.cursorPos = range.start;
					this.clearSelection();
				}
				this.moveCursorVertically(-1);
			}
			return;
		}

		if(key === 'ArrowDown'){
			if(e.shiftKey){
				// Extend selection vertically
				if(this.selectionStart === null){
					this.selectionStart = this.cursorPos;
				}
				const moved = this.moveCursorVertically(1, true);
				// If couldn't move down (on last line), go to end of text
				if(!moved){
					this.cursorPos = this.text.text.length;
				}
				this.selectionEnd = this.cursorPos;
				this.cursorVisible = true;
				stage.render();
			} else {
				if(this.hasSelection()){
					const range = this.getSelectionRange();
					this.cursorPos = range.end;
					this.clearSelection();
				}
				this.moveCursorVertically(1);
			}
			return;
		}

		// Regular character input
		if(key.length === 1){
			// Delete selection first if any
			this.deleteSelection();
			this.insertChar(key);
		}
	}

	insertChar(char){
		const before = this.text.text.slice(0, this.cursorPos);
		const after = this.text.text.slice(this.cursorPos);
		this.text.text = before + char + after;
		this.cursorPos++;
		this.text.update();
		this.cursorVisible = true;
		stage.render();
	}

	moveCursorVertically(direction, forSelection = false){
		const text = this.text.text;
		const lines = text.split('\n');

		// Find current line and column
		let charCount = 0;
		let currentLine = 0;
		let currentCol = 0;

		for(let i = 0; i < lines.length; i++){
			const lineLength = lines[i].length;
			if(charCount + lineLength >= this.cursorPos && (i === lines.length - 1 || charCount + lineLength >= this.cursorPos)){
				if(this.cursorPos <= charCount + lineLength){
					currentLine = i;
					currentCol = this.cursorPos - charCount;
					break;
				}
			}
			charCount += lineLength + 1; // +1 for newline
		}

		// Calculate target line
		const targetLine = currentLine + direction;

		// Bounds check
		if(targetLine < 0 || targetLine >= lines.length){
			return false;
		}

		// Calculate new cursor position
		const targetLineLength = lines[targetLine].length;
		const targetCol = Math.min(currentCol, targetLineLength);

		// Calculate absolute position
		let newPos = 0;
		for(let i = 0; i < targetLine; i++){
			newPos += lines[i].length + 1; // +1 for newline
		}
		newPos += targetCol;

		this.cursorPos = newPos;
		this.cursorVisible = true;
		if(!forSelection){
			stage.render();
		}
		return true;
	}

	commitText(){
		if(!this.text) return;

		const textToSelect = this.text;

		if(this.text.text.trim().length > 0){
			// Commit the text
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.text));

			// Select the committed text
			data.selectNone();
			textToSelect.selected = true;
		} else {
			// Empty text, just remove
			data.clearTempShapes();
		}

		this.stopCursorBlink();
		this.state = STATE.IDLE;
		this.text = null;
		this.cursorPos = 0;
		stage.render();
	}

	// Called by renderer to get cursor info for drawing
	getCursorInfo(){
		if(this.state !== STATE.EDITING || !this.text){
			return null;
		}

		const info = {
			text: this.text,
			position: this.cursorPos,
			cursorVisible: this.cursorVisible
		};

		// Include selection info if present
		if(this.hasSelection()){
			const range = this.getSelectionRange();
			info.selectionStart = range.start;
			info.selectionEnd = range.end;
		}

		return info;
	}
}
