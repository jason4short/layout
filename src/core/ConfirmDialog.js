// ConfirmDialog - Shows/hides the #confirmDialog element from index.html

const overlay = document.getElementById('confirmDialog');
const msgEl = document.getElementById('confirmDialogMessage');
const btnCancel = document.getElementById('confirmDialogCancel');
const btnConfirm = document.getElementById('confirmDialogConfirm');

let _onConfirm = null;

function close() {
	overlay.classList.add('hidden');
	document.removeEventListener('keydown', blockKey, true);
	document.removeEventListener('keyup', blockKey, true);
	window.removeEventListener('mousemove', blockMouse, true);
	window.removeEventListener('mousedown', blockMouse, true);
	window.removeEventListener('mouseup', blockMouse, true);
	window.removeEventListener('wheel', blockMouse, true);
	_onConfirm = null;
}

// Block all keyboard events from reaching Stage (which uses capture phase)
function blockKey(e) {
	if (e.key === 'Escape') { close(); return; }
	e.stopPropagation();
}

// Block mouse events that target anything behind the overlay
function blockMouse(e) {
	if (!overlay.contains(e.target)) {
		e.stopPropagation();
		e.preventDefault();
	}
}

btnCancel.addEventListener('click', close);
btnConfirm.addEventListener('click', () => { const cb = _onConfirm; close(); if (cb) cb(); });
overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

export function showConfirmDialog(message, onConfirm) {
	msgEl.textContent = message;
	_onConfirm = onConfirm;
	overlay.classList.remove('hidden');

	document.addEventListener('keydown', blockKey, true);
	document.addEventListener('keyup', blockKey, true);
	window.addEventListener('mousemove', blockMouse, true);
	window.addEventListener('mousedown', blockMouse, true);
	window.addEventListener('mouseup', blockMouse, true);
	window.addEventListener('wheel', blockMouse, true);

	btnCancel.focus();
}
