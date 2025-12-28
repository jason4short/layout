//************************************************************************************
//	@author Jason Short
//	@since 5/8/04
//************************************************************************************

class NSButtIcon extends NSControl {

	var icon			:MovieClip;
	
	var highlight		:Boolean	= false;
	
	var _delay			:Number		= 75
	var _periodicDelay	:Number 	= 400
	var _showButton		:Boolean	= true

	var _actionOn		:Number		= 0 // 0 = only on release, 1 = onPress
	var interval		:Number;

	function NSButtIcon(){
		super();
	}
	

	function press(){
		window.keyCheck();//make the window key

		highlight 		= true;
		display();

		if (_actionOn == 1)
			target[action](this);
			
		if (_continuous){
			repeatLoop();
			interval = setInterval(this, "waitLoop", _periodicDelay);
		}
	
	}

	function release(release){
		clearInterval(interval);
		if (_actionOn == 0)
			target[action](this);	
		highlight 		= false;
		display()
	}
	
	
	function releaseOut(releaseOut){
		clearInterval(interval);
		highlight 		= false;
		display()
	}
	
	function dragOut(dragOut){
		clearInterval(interval);
		highlight 		= false;
		display()
	}
	
	function dragOver(dragOver){
		if (_continuous)
			interval = setInterval(this, "repeatLoop", delay);
		highlight		= true;
		display()
	}


	//continuous code
		
	function waitLoop(waitLoop){
		repeatLoop();
		clearInterval(interval);
		interval = setInterval(this, "repeatLoop", delay);
	}
	
	function repeatLoop(repeatLoop){
		target[action](this);
	}


	function setFrame(x:Number,y:Number,w:Number,h:Number){
		super.setFrame(x,y,w,h);
		icon._x = Math.floor(frame.w/2 - icon._width/2)
		icon._y = Math.floor(frame.h/2 - icon._height/2)
		icon.ox = icon._x
		icon.oy = icon._y
	}

	function draw(){
		if (!_enabled){
			if (_showButton) _global.NSDraw.buttonUp(this,0,0,frame.w,frame.h);
			icon.gotoAndStop(3);
			return;
		}
		if (highlight){	// pressed
			if (_showButton) _global.NSDraw.buttonDown(this,0,0,frame.w,frame.h);
			icon.gotoAndStop(2);
			
		}else{
			if (_showButton) _global.NSDraw.buttonUp(this,0,0,frame.w,frame.h);
			icon.gotoAndStop(1);
		}
		
	}


	//------------------------------------------
	function get enabled(){
		return _enabled;
	}

	function set enabled(val:Boolean){
		_enabled = val
		if (_enabled){
			onPress 			= press;
			onRelease 			= release;
			onReleaseOutside 	= releaseOut;
			onDragOut 			= dragOut;
			onDragOver 			= dragOver;
		}else{
			delete onPress;
			delete onRelease;
			delete onReleaseOutside;
			delete onDragOut;
		}
		display();
	}

	//------------------------------------------

	function set iconName(val:String){
		var _iconName = val
		if (val == null){
			icon.removeMovieClip()
		}else{
			icon = attachMovie(_iconName, "icon",1);
		}
	}


	//------------------------------------------
	function get delay(){
		return _delay;
	}

	function set delay(val:Number){
		_delay = val
	}
	
	//------------------------------------------
	function get periodicDelay(){
		return _periodicDelay;
	}

	function set periodicDelay(val:Number){
		_periodicDelay = val
	}

	//------------------------------------------
	function get showButton(){
		return _showButton;
	}

	function set showButton(val:Boolean){
		_showButton = val
		display();
	}

	//------------------------------------------
	function get actionOn(){
		return _actionOn;
	}

	function set actionOn(val:String){
		if (val == "press")
		_actionOn = 1
		else 
		_actionOn = 0;
	}

}