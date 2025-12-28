import {Rectangle} from "./Rectangle.js";
import {InteractiveObject} from "./InteractiveObject.js";

export class View extends InteractiveObject
{
	// private members

	constructor()
	{
		super();
	}

	draw()
	{
		// force override?
        //throw new Error("Method 'draw()' must be implemented.");
        
	}

	
	getBounds(){
	
		return new Rectangle()
	}
	

}

