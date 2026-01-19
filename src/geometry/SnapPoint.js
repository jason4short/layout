
export class SnapPoint
{
	constructor(x = 0, y = 0)
	{
		this.x 			= x;
		this.y 			= y;
		this.distance	= 0;
		this.shape		= null;
		this.label		= null;
	}

// 	addLabel(label) {
// 		if (!this.labels.includes(label)) {
// 			this.labels.push(label);
// 		}
// 	}
// 
// 	clearLabels() {
// 		this.labels = [];
// 	}
}