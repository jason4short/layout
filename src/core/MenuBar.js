// MenuBar - Dropdown menu open/close logic

class MenuBar {
	constructor() {
		this.triggers = document.querySelectorAll('.menu-trigger');
		this._openTrigger = null;

		this._onTriggerClick = this._onTriggerClick.bind(this);
		this._onDocumentClick = this._onDocumentClick.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);

		for (const trigger of this.triggers) {
			trigger.addEventListener('click', this._onTriggerClick);
		}
		document.addEventListener('click', this._onDocumentClick);
		document.addEventListener('keydown', this._onKeyDown);
	}

	_onTriggerClick(e) {
		const trigger = e.currentTarget;

		// If clicking a menu-item inside the dropdown, close the menu and let event propagate
		if (e.target.closest('.menu-item')) {
			this._close();
			return;
		}

		e.stopPropagation();

		if (this._openTrigger === trigger) {
			this._close();
		} else {
			this._close();
			trigger.classList.add('open');
			this._openTrigger = trigger;
		}
	}

	_onDocumentClick() {
		this._close();
	}

	_onKeyDown(e) {
		if (e.key === 'Escape') this._close();
	}

	_close() {
		if (this._openTrigger) {
			this._openTrigger.classList.remove('open');
			this._openTrigger = null;
		}
	}
}

const menuBar = new MenuBar();
export default menuBar;
