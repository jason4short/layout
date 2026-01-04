
export class InputHandler
{
 	constructor(id){
	
		this.dimensionInputValue 	= '';
		this.dimensionInputNumber 	= null;
		this.onDimensionCommit 		= null;
		this.id 					= id;
		this.init();
	}
		
    init(id=null){
    	if(id) this.id = id;
    	
		this.input 			= document.getElementById(this.id);
		this.onInput 		= this.onInput.bind(this);
		this.onKeyDown 		= this.onKeyDown.bind(this);

		this.input.addEventListener('input', this.onInput);
		this.input.addEventListener('keydown', this.onKeyDown);
	}

	onInput(){
		this.parseValue(this.input.value);
	}
	
	parseValue(value)
	{
		this.dimensionInputValue = value;
		const parsedNumber = Number(value);
		
		if(Number.isFinite(parsedNumber)){
			this.dimensionInputNumber = parsedNumber;
		}else{
			this.dimensionInputNumber = null;
		}
	}
	
	onKeyDown(e)
	{
		if(e.key === 'Enter'){
			if(typeof this.onDimensionCommit === 'function'){
				this.onDimensionCommit(this.dimensionInputNumber);
				//this.input.value = '';
				this.input.blur();			
			}
		}
	
		if(e.key === 'Escape'){
			this.input.value = '';
			this.input.blur();
		}
	}

	focus(){
	
	
	}
	
	
	setInputValue(value)
	{
		this.input.value = Number(value);
		this.input.focus();
		this.input.select();
		
	};
	
	setCallback(handler)
	{
		this.onDimensionCommit = handler;
	}


}
