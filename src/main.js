import { Sketchpad } from 'keda/three/Sketchpad';
import { Rain } from './sketches/rain/Rain';
import { Navscan } from './sketches/navscan/Navscan';
import { Blockflow } from './sketches/blockflow/Blockflow';
import { Ablaze } from './sketches/ablaze/Ablaze';

const sketchpad = new Sketchpad( {
	container: 'background',
	//debug: true,
	//fps: 240,
	//fps: 2,
	//fps: 0,
} );

const options = { sketchpad };
const sketches = {
	rain: () => new Rain( options ),
	navscan: () => new Navscan( options ),
	blockflow: () => new Blockflow( options ),
	ablaze: () => new Ablaze( options ),
};

//const sketch = sketches.rain();
//const sketch = sketches.navscan();
//const sketch = sketches.blockflow();
const sketch = sketches.ablaze();

sketchpad.init( sketch );
