import { GPGPU } from 'keda/three/gpgpu/GPGPU';
import { Sketchpad } from 'keda/three/Sketchpad';

import { Rain } from './sketches/rain/Rain';
import { Navscan } from './sketches/navscan/Navscan';
import { Blockflow } from './sketches/blockflow/Blockflow';
import { Ablaze } from './sketches/ablaze/Ablaze';
import { Backgrid } from './sketches/backgrid/Backgrid';
import { Cyberdark } from './sketches/cyberdark/Cyberdark';

const sketchpad = new Sketchpad( {
	container: 'background',
	//debug: true,
	//stats: true,
	//fps: 60,
} );

GPGPU.init( sketchpad.renderer );

const options = { sketchpad };

const sketches = {
	rain: () => new Rain( options ),
	navscan: () => new Navscan( options ),
	blockflow: () => new Blockflow( options ),
	ablaze: () => new Ablaze( options ),
	backgrid: () => new Backgrid( options ),
	cyberdark: () => new Cyberdark( options ),
};

const hash = window.location.hash.replace( '#', '' );
const generator = sketches[ hash ] || sketches.navscan;

const sketch = generator();

sketchpad.init( sketch );

document.title = `${sketch.settings.name} - Pierre Keda`;
