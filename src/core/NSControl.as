class NSControl extends NSView {

	var target			:Object
	var _action			:String
	var _value			:Object;
	var _tag			:Number		= 0;
	var _enabled		:Boolean	= true;
	var _continuous		:Boolean	= false;
	
	function NSControl(){
		super();
		useHandCursor 		= false;
		enabled 			= true;

		//_superView = _parent;
		/*
		if (_superView.window != undefined){
			_superView.window.registerControl(this);
			window = _superView.window;
			
		} else{
			control_on_color 		= OS.focus_control_on_color
			control_off_color 		= OS.focus_control_off_color	
			control_press_on_color 	= OS.focus_control_press_on_color
			control_press_off_color = OS.focus_control_press_off_color		
		}
		*/
		
	}
	/*
	function windowDidBecomeKey(bool){
		if (bool){
			control_on_color 			= OS.focus_control_on_color
			control_off_color 			= OS.focus_control_off_color	
			control_press_on_color 		= OS.focus_control_press_on_color
			control_press_off_color		= OS.focus_control_press_off_color
		}else{
			control_on_color 			= OS.blur_control_on_color
			control_off_color 			= OS.blur_control_off_color
		}
		display();
	}
	*/
	
	
	
//------------------------------------------
	
	function get enabled(){
		return _enabled;
	}

	function set enabled(val:Boolean){
		_enabled = val
	}
	

//------------------------------------------
	/*
	function get target(){
		return _target;
	}

	function set target(val:Object){
		_target = val
	}
	*/

//------------------------------------------
	function get action(){
		return _action;
	}

	function set action(val:String){
		_action = val
	}


//------------------------------------------
	function get value(){
		return _value;
	}

	function set value(val:Object){
		_value = val
	}


//------------------------------------------
	function get tag(){
		return _tag;
	}

	function set tag(val:Number){
		_tag = val
	}

//------------------------------------------
	function get continuous(){
		return _continuous;
	}

	function set continuous(val:Boolean){
		_continuous = val
	}

}