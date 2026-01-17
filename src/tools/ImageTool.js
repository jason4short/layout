import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {Image} 			from '../geometry/Image.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

import {AddShapeCommand} from '../core/Commands.js';

export class ImageTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Image";
		this.usage 	= "Select an image file to place on the canvas.";

		this.imageElement 	= null;
		this.imageSrc 		= null;
		this.preview 		= null;
		this.placing 		= false;

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		toolManager.addEventListener('mouseUp', this.onMouseUp);
		toolManager.addEventListener('mouseMove', this.onMouseMove);
		toolManager.addEventListener('mouseDown', this.onMouseDown);

		// Open file picker immediately
		this.openFilePicker();
	}

	exit(){
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		toolManager.removeEventListener('mouseMove', this.onMouseMove);
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		this.reset();
	}

	updateCursor(){
		if(this.placing){
			stage.setCursor('crosshair');
		} else {
			stage.setCursor('default');
		}
	}

	reset(){
		this.imageElement = null;
		this.imageSrc = null;
		this.placing = false;
		data.clearTempShapes();
		this.preview = null;
		stage.render();
	}

	openFilePicker(){
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';

		input.onchange = (e) => {
			const file = e.target.files[0];
			if(!file) return;

			// Read file as data URL (base64) so it persists when saved
			const reader = new FileReader();
			reader.onload = (event) => {
				const dataUrl = event.target.result;

				// Load the image to get dimensions
				const img = new window.Image();
				img.onload = () => {
					this.imageElement = img;
					this.imageSrc = dataUrl;
					this.placing = true;

					// Create preview at origin with natural size
					// Convert to world coordinates based on current zoom
					const worldWidth = stage.screenToWorldScale(img.naturalWidth);
					const worldHeight = stage.screenToWorldScale(img.naturalHeight);

					this.preview = new Image([0, 0, worldWidth, worldHeight]);
					this.preview.imageElement = img;
					this.preview.src = dataUrl;
					this.preview.loaded = true;
					this.preview.locked = true;

					data.addTempShape(this.preview);
					this.updateCursor();
					stage.render();
				};

				img.onerror = () => {
					console.error('Failed to load image:', file.name);
					alert('Failed to load image file.');
				};

				img.src = dataUrl;
			};

			reader.onerror = () => {
				console.error('Failed to read file:', file.name);
				alert('Failed to read image file.');
			};

			reader.readAsDataURL(file);
		};

		input.click();
	}

	onMouseDown(e){
		// Nothing on mouse down
	}

	onMouseMove(e){
		if(!this.placing || !this.preview) return;

		const snapPt = da.getCurrentSnapPoint();

		// Center the image on cursor
		this.preview.x = snapPt.x - this.preview.width / 2;
		this.preview.y = snapPt.y - this.preview.height / 2;
		this.preview.update();

		stage.render();
	}

	onMouseUp(e){
		if(!this.placing || !this.preview) return;

		// Finalize position
		const snapPt = da.getCurrentSnapPoint();
		this.preview.x = snapPt.x - this.preview.width / 2;
		this.preview.y = snapPt.y - this.preview.height / 2;
		this.preview.update();

		// Create final image and add it
		const finalImage = this.preview.clone();
		undoManager.execute(new AddShapeCommand(finalImage));

		// Clean up
		data.clearTempShapes();
		this.preview = null;
		this.placing = false;
		this.imageElement = null;
		this.imageSrc = null;

		this.updateCursor();
		stage.render();

		// Switch back to pointer tool
		toolManager.setTool(toolManager.pointerTool);
	}
}
