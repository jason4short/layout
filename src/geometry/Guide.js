import {Shape, Geometry} from './Geometry.js';
import {Construction} from './Construction.js';

export class Guide extends Construction
{
	constructor(params)
	{
		super(params);
		this.type 		= Shape.GUIDE
	}
}
