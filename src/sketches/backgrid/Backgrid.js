import { BoxGeometry, EdgesGeometry, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, LineBasicMaterial, LineSegments, PlaneGeometry } from 'three';

import { Sketch } from 'keda/three/Sketch';
import { CameraBounds } from '../../keda/three/misc/CameraBounds';

import { BackgridControls } from './BackgridControls';
import { BackgridSettings } from './BackgridSettings';

class Backgrid extends Sketch {

	constructor( settings = {} ) {

		super( { defaults: BackgridSettings, settings } );

		this.bounds = new CameraBounds(
			this.camera, - 1, - 3,
		);

	}

	init() {

		super.init( BackgridControls );

		this.shader.uniforms.uCursor.value = this.controls.cursor.position;

	}

	build() {

		const { settings } = this;

		const boxSize = 0.016;
		const boxMargin = 0.3;
		const boxSpacing = boxSize + boxMargin;


		const box = new PlaneGeometry( boxSize, boxSize );
		const edges = new EdgesGeometry( box );

		//const dotCount = 1024; // 32 * 32;

		const size = 64;
		const dotCount = size * size;
		const offsets = new Float32Array( dotCount * 3 );


		const totalSize = boxSpacing * size;
		const startX = ( boxSpacing - totalSize ) / 2;
		const startY = - ( boxSpacing - totalSize ) / 2;

		this.size = totalSize;

		let o = 0;

		for ( let row = 0; row < size; row ++ ) {

			for ( let column = 0; column < size; column ++ ) {

				offsets[ o ++ ] = startX + column * boxSpacing;
				offsets[ o ++ ] = startY - row * boxSpacing;
				offsets[ o ++ ] = 0;

			}

		}

		const coreGeometry = new InstancedBufferGeometry();
		coreGeometry.instanceCount = dotCount;
		coreGeometry.setAttribute(
			'position',
			new Float32BufferAttribute().copy( edges.attributes.position )
		);
		coreGeometry.setAttribute(
			'aOffset',
			new InstancedBufferAttribute( offsets, 3 )
		);

		const coreMaterial = new LineBasicMaterial( settings.material );
		coreMaterial.onBeforeCompile = this.editShader.bind( this );

		const cores = new LineSegments( coreGeometry, coreMaterial );
		this.add( cores );
		this.dots = cores;

		// Shells

		const shellScale = 2.9;
		edges.scale( shellScale, shellScale, shellScale );

		const shellGeometry = new InstancedBufferGeometry();
		shellGeometry.instanceCount = dotCount;
		shellGeometry.setAttribute(
			'position',
			new Float32BufferAttribute().copy( edges.attributes.position )
		);
		shellGeometry.setAttribute(
			'aOffset',
			new InstancedBufferAttribute( offsets, 3 )
		);

		const shells = new LineSegments( shellGeometry, coreMaterial );
		shells.position.copy( cores.position );
		this.add( shells );
		this.shells = shells;

		this.shader = {
			uniforms: {
				uCursor: { value: null }
			},
		};

	}

	editShader( shader ) {

		// THREE tokens ( r136 )

		const common = '#include <common>';
		const beginVertex = '#include <begin_vertex>';
		//const diffuseColor = 'vec4 diffuseColor = vec4( diffuse, opacity )';

		// Vertex

		const vertexDeclarations = /*glsl*/`
			attribute vec3 aOffset;
			uniform vec3 uCursor;
		`;
		const vertexChanges = /*glsl*/`
			transformed *= clamp( 
				pow( 1.0 / length( uCursor - aOffset ) + 1.0 , 2.0 ),
				0.0,
				6.0
			);
			transformed += aOffset;
		`;

		//const fragmentDeclarations = /*glsl*/`

		//`;
		//const fragmentChanges = /*glsl*/`

		//`;

		// Apply

		shader.vertexShader = shader.vertexShader.replace(
			common,
			common + vertexDeclarations
		);
		shader.vertexShader = shader.vertexShader.replace(
			beginVertex,
			beginVertex + vertexChanges
		);
		//shadeBackragmentShader = shader.fragmentShader.replace(
		//	common,
		//	common + fragmentDeclarations
		//);
		//shader.fragmentShader = shader.fragmentShader.replace(
		//	diffuseColor,
		//	fragmentChanges
		//);

		Object.assign( shader.uniforms, this.shader.uniforms );

		this.shader = shader;

	}

}

export { Backgrid };
