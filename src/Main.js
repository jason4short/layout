import stage from './core/Stage.js';

import data from './data/Data.js';
import toolManager from './tools/ToolManager.js';

import {Shape} from './geometry/Geometry.js';
import {Intersections} from './data/Intersections.js';

//import toolManager from './tools/ToolManager.js';

//let tools = new ToolManager();


let intersections = new Intersections();
//let line1 = data.createShape(Shape.LINE, [200,200,300,200]);
//let line2 = data.createShape(Shape.LINE, [100,0,100,400]);
//data.createShape(Shape.LINE, [100,100,240,120]);
//data.createShape(Shape.CIRCLE, [300,300,100]);


stage.init();		
toolManager.init();


window.addEventListener('keydown', onKeyDown);




function onKeyDown(e)
{
//	console.log("Jason! ")
//	console.log(data.shapeIntersections)
//	console.log(data.snapPoints)
//	console.log(data.guideIntersections)
}

