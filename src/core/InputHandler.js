import toolManager from '../tools/ToolManager.js';
import units from './Units.js';

const ICON_PATH = 'src/assets/prop_icons';

// Map dimension labels to icon filenames
const LABEL_ICON_MAP = {
	'Line length': 'width',
	'Circle radius': 'radius',
	'Polygon radius': 'radius',
	'Fillet radius': 'radius',
	'Chamfer distance': 'width',
	'Offset distance': 'width',
	'Board length': 'width',
	'Slot length': 'width',
};

export class InputHandler
{
 	constructor(id){

		this.dimensionInputValue 	= '';
		this.dimensionInputNumber 	= null;
		this.onDimensionCommit 		= null;
		this.id 					= id;
		this.init();
	}

    init(id=null){
    	if(id) this.id = id;

		this.input 			= document.getElementById(this.id);
		this.inputBar		= document.getElementById('inputBar');
		this.inputLabel		= document.getElementById('inputLabel');
		this.iconWrap		= document.getElementById('inputIconWrap');
		this.onInput 		= this.onInput.bind(this);
		this.onKeyDown 		= this.onKeyDown.bind(this);

		this.input.addEventListener('input', this.onInput);
		this.input.addEventListener('keydown', this.onKeyDown);
	}

	onInput(){
		this.parseValue(this.input.value);
	}

	parseValue(value)
	{
		this.dimensionInputValue = value;

		// Try units parser first (handles "1in", "3 ft", "1 1/2"", etc.)
		const parsedWithUnits = units.parse(value);
		if (parsedWithUnits !== null) {
			this.dimensionInputNumber = parsedWithUnits;
			return;
		}

		// Fall back to plain number parsing
		const parsedNumber = Number(value);
		if (Number.isFinite(parsedNumber)) {
			this.dimensionInputNumber = parsedNumber;
		} else {
			this.dimensionInputNumber = null;
		}
	}

	onKeyDown(e)
	{
		if(e.key === 'Enter'){
			if(typeof this.onDimensionCommit === 'function'){
				this.onDimensionCommit(this.dimensionInputNumber);
				this.input.blur();
				this.clear();
			}
		}

		if(e.key === 'Escape'){
			this.input.value = '';
			this.input.blur();
			this.clear();
			// Switch to pointer tool
			toolManager.setTool(toolManager.pointerTool);
		}
	}

	clear() {
		this.setLabel('');
		this.input.value = '';
		if (this.iconWrap) {
			this.iconWrap.removeAttribute('style');
			this.iconWrap.classList.add('hidden');
		}
	}

	setLabel(text) {
		if (this.inputLabel) this.inputLabel.textContent = text;
	}

	setIcon(label) {
		if (!this.iconWrap) return;
		const icon = LABEL_ICON_MAP[label];
		if (icon) {
			this.iconWrap.style.setProperty('--icon', `url('${ICON_PATH}/${icon}.svg')`);
		} else {
			this.iconWrap.removeAttribute('style');
		}
	}

	setInputValue(value, label)
	{
		if (label) {
			this.setLabel(label);
			this.setIcon(label);
		}
		if (this.iconWrap) this.iconWrap.classList.remove('hidden');
		// Format the value in current display units (without unit suffix for easy editing)
		this.input.value = units.format(value, units.currentUnit, false);
		this.input.focus();
		this.input.select();
	};

	setCallback(handler)
	{
		this.onDimensionCommit = handler;
	}


}
