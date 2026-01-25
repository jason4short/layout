export class DoubleClick
{
	constructor()
	{
		this.last_timer	= 0;		
	}

	click()
	{
		const temp = Date.now();
		const delta = (temp - this.last_timer);
		this.last_timer = temp;
		//trace(delta)
		
		return(delta > 100 && delta < 220);
	}
}
