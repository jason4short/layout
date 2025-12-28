import {EventDispatcher} from './EventDispatcher.js';

/*
CLICK : String = "click"
MOUSE_DOWN : String = "mouseDown"
MOUSE_MOVE : String = "mouseMove"
MOUSE_OUT : String = "mouseOut"
MOUSE_OVER : String = "mouseOver"
MOUSE_UP : String = "mouseUp"
RELEASE_OUTSIDE : String = "releaseOutside"
ROLL_OUT : String = "rollOut"
ROLL_OVER : String = "rollOver"
*/


class InteractiveObject extends EventDispatcher
{
	// private members

	constructor(source = null)
	{
		super();
		this.mousenabled = true;
		this.isDragging = false;
		this.mouseX 	= 0; // localX, localY
		this.mouseY 	= 0;
		
	}
	
// 	_handle_mouseDown()
// 	{
// 		this.dispatchEvent('mouseDown', {target:this});
// 	}
// 	
// 	_handle_mouseUp()
// 	{
// 		this.dispatchEvent('mouseUp', {target:this});	
// 	}
// 	
// 	_handle_mouseMove()
// 	{
// 		this.dispatchEvent('mouseMove', {target:this});	
// 	}
	
				//hit.dispatchEvent('mouseDown', {target:hit});

// 	windowDidBecomeKey(bool){
// 		for (var i=0; i< subviews.length;i++){
// 			subviews[i].windowDidBecomeKey(bool);
// 		}
// 		//trace("called display")
// 		display();
// 	}



	
	
}
export {InteractiveObject};

