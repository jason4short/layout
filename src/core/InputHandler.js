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

// Map icon names used in multi-field mode
const ICON_NAME_MAP = {
	'width': 'width',
	'height': 'height',
	'radius': 'radius',
};

function resolveIcon(name) {
	const mapped = ICON_NAME_MAP[name] || LABEL_ICON_MAP[name];
	return mapped ? `url('${ICON_PATH}/${mapped}.svg')` : null;
}

function parseNumber(value) {
	const parsedWithUnits = units.parse(value);
	if (parsedWithUnits !== null) return parsedWithUnits;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export class InputHandler
{
 	constructor(id){

		this.dimensionInputValue 	= '';
		this.dimensionInputNumber 	= null;
		this.onDimensionCommit 		= null;
		this.id 					= id;

		// Multi-field state
		this._multiMode = false;
		this._field2Callback = null;
		this._field2Number = null;

		this.init();
	}

    init(id=null){
    	if(id) this.id = id;

		this.input 			= document.getElementById(this.id);
		this.inputBar		= document.getElementById('inputBar');
		this.inputLabel		= document.getElementById('inputLabel');
		this.iconWrap		= document.getElementById('inputIconWrap');

		// Second field elements
		this.input2			= document.getElementById('toolbarTextInput2');
		this.iconWrap2		= document.getElementById('inputIconWrap2');

		this.onInput 		= this.onInput.bind(this);
		this.onKeyDown 		= this.onKeyDown.bind(this);
		this._onInput2		= this._onInput2.bind(this);
		this._onKeyDown2	= this._onKeyDown2.bind(this);

		this.input.addEventListener('input', this.onInput);
		this.input.addEventListener('keydown', this.onKeyDown);

		if (this.input2) {
			this.input2.addEventListener('input', this._onInput2);
			this.input2.addEventListener('keydown', this._onKeyDown2);
		}
	}

	onInput(){
		this.dimensionInputNumber = parseNumber(this.input.value);
	}

	_onInput2(){
		this._field2Number = parseNumber(this.input2.value);
	}

	parseValue(value)
	{
		this.dimensionInputValue = value;
		this.dimensionInputNumber = parseNumber(value);
	}

	onKeyDown(e)
	{
		if(e.key === 'Tab' && this._multiMode){
			e.preventDefault();
			this.input2.focus();
			this.input2.select();
			return;
		}

		if(e.key === 'Enter'){
			this._commit();
			return;
		}

		if(e.key === 'Escape'){
			this._dismiss();
		}
	}

	_onKeyDown2(e)
	{
		if(e.key === 'Tab'){
			e.preventDefault();
			this.input.focus();
			this.input.select();
			return;
		}

		if(e.key === 'Enter'){
			this._commit();
			return;
		}

		if(e.key === 'Escape'){
			this._dismiss();
		}
	}

	_commit() {
		// Parse latest values
		this.dimensionInputNumber = parseNumber(this.input.value);

		if (this._multiMode) {
			this._field2Number = parseNumber(this.input2.value);
			if (typeof this.onDimensionCommit === 'function') {
				this.onDimensionCommit(this.dimensionInputNumber);
			}
			if (typeof this._field2Callback === 'function') {
				this._field2Callback(this._field2Number);
			}
		} else {
			if (typeof this.onDimensionCommit === 'function') {
				this.onDimensionCommit(this.dimensionInputNumber);
			}
		}

		this.input.blur();
		if (this.input2) this.input2.blur();
	}

	_dismiss() {
		this.input.value = '';
		this.input.blur();
		if (this.input2) {
			this.input2.value = '';
			this.input2.blur();
		}
		this.clear();
		toolManager.setTool(toolManager.pointerTool);
	}

	clear() {
		this.setLabel('');
		this.input.value = '';
		this._multiMode = false;
		this._field2Callback = null;
		this._field2Number = null;
		if (this.iconWrap) {
			this.iconWrap.removeAttribute('style');
			this.iconWrap.classList.add('hidden');
		}
		if (this.input2) this.input2.value = '';
		if (this.iconWrap2) {
			this.iconWrap2.removeAttribute('style');
			this.iconWrap2.classList.add('hidden');
		}
	}

	setLabel(text) {
		if (this.inputLabel) this.inputLabel.textContent = text;
	}

	setIcon(label) {
		if (!this.iconWrap) return;
		const iconUrl = resolveIcon(label);
		if (iconUrl) {
			this.iconWrap.style.setProperty('--icon', iconUrl);
		} else {
			this.iconWrap.removeAttribute('style');
		}
	}

	// Single-value mode (existing API)
	setInputValue(value, label)
	{
		if (label) {
			this.setLabel(label);
			this.setIcon(label);
		}
		if (this.iconWrap) this.iconWrap.classList.remove('hidden');
		this.input.value = units.format(value, units.currentUnit, false);
		this.input.focus();
		this.input.select();
	}

	// Multi-value mode: fields = [{value, label, icon, callback}, ...]
	setInputValues(label, fields)
	{
		this.clear();
		this._multiMode = true;
		this.setLabel(label);

		// First field
		const f1 = fields[0];
		if (f1) {
			this.onDimensionCommit = f1.callback;
			const iconUrl = resolveIcon(f1.icon);
			if (iconUrl && this.iconWrap) {
				this.iconWrap.style.setProperty('--icon', iconUrl);
			}
			if (this.iconWrap) this.iconWrap.classList.remove('hidden');
			this.input.value = units.format(f1.value, units.currentUnit, false);
		}

		// Second field
		const f2 = fields[1];
		if (f2) {
			this._field2Callback = f2.callback;
			const iconUrl = resolveIcon(f2.icon);
			if (iconUrl && this.iconWrap2) {
				this.iconWrap2.style.setProperty('--icon', iconUrl);
			}
			if (this.iconWrap2) this.iconWrap2.classList.remove('hidden');
			this.input2.value = units.format(f2.value, units.currentUnit, false);
		}

		this.input.focus();
		this.input.select();
	}

	setCallback(handler)
	{
		this.onDimensionCommit = handler;
	}


}
