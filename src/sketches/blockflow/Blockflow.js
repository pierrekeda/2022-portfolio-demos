import {
	BoxGeometry,
	Color,
	EdgesGeometry,
	Float32BufferAttribute,
	InstancedBufferAttribute,
	InstancedBufferGeometry,
	LineBasicMaterial,
	LineSegments,
	PlaneGeometry
} from 'three';
import simplex3D from 'keda/glsl/simplex3D.glsl';
import { Sketch } from 'keda/three/Sketch';
import { BloomPass } from 'keda/three/postprocessing/BloomPass';
import { BlockflowSettings } from './BlockflowSettings';
import { BlockflowControls } from './BlockflowControls';

class Blockflow extends Sketch {

	constructor( settings = {} ) {

		super( { defaults: BlockflowSettings, settings } );

		this.time = 0;
		this.setSpeed();

	}

	init() {

		this.build();

		this.effects.add( 'bloom', new BloomPass( this.settings.bloom ) );

		this.controls = new BlockflowControls( this );
		this.shader.uniforms.uCursor.value = this.controls.cursor.position;

	}

	build() {

		// Computations

		const { settings } = this;
		const { tile } = settings;
		const instances = tile.countX * tile.countZ;

		const netWidth = tile.width + tile.margin.x;
		const netDepth = tile.depth + tile.margin.z;
		this.width = netWidth * tile.countX - tile.margin.x;
		this.depth = netDepth * tile.countZ - tile.margin.z;

		const offsetX = - ( this.width - tile.width ) / 2;
		const offsetY = - tile.height * 0.5;
		const offsetZ = - ( this.depth - tile.depth ) / 2;

		if ( this.debug ) console.log( { instances } );

		// Geometry

		const box = new BoxGeometry( tile.width, tile.height, tile.depth );
		const edges = new EdgesGeometry( box );

		const positions = new Float32Array( edges.attributes.position.array );
		const attributeCount = 3 * instances;
		const offsets = new Float32Array( attributeCount );

		let tileX = 0;
		let tileZ = 0;

		for ( let i = 0; i < attributeCount; i += 3 ) {

			offsets[   i   ] = offsetX + tileX * netWidth;
			offsets[ i + 1 ] = offsetY;
			offsets[ i + 2 ] = offsetZ + tileZ * netDepth;

			tileX = ( tileX + 1 ) % tile.countX;
			if ( tileX === 0 ) tileZ ++;

		}

		const geometry = new InstancedBufferGeometry();
		geometry.instanceCount = instances;
		geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		geometry.setAttribute( 'aOffset', new InstancedBufferAttribute( offsets, 3 ) );

		// Material

		this.shader = {
			uniforms: {
				// Vertex
				uCursor: { value: null },
				uAmplitude:  { value: settings.amplitude.value },
				uScale: 	 { value: settings.scale.value },
				uThickness:  { value: settings.thickness.value },
				uTurbulence: { value: settings.turbulence.value },
				uTime: { value: 0 },

				// Fragment
				uHighColor: { value: new Color( settings.highColor ) },
			},
		};

		const material = new LineBasicMaterial( settings.material );
		material.onBeforeCompile = this.editShader.bind( this );

		// Grid

		this.grid = new LineSegments( geometry, material );
		this.add( this.grid );

		// Border

		const plane = new PlaneGeometry(
			this.width + settings.border,
			this.depth + settings.border,
		);
		plane.rotateX( - Math.PI / 2 );
		this.border = new LineSegments( new EdgesGeometry( plane ), material );
		this.add( this.border );

		// Cleanup

		box.dispose();
		edges.dispose();
		plane.dispose();

	}

	editShader( shader ) {

		// THREE tokens ( r135 )

		const common = '#include <common>';
		const beginVertex = '#include <begin_vertex>';
		const diffuseColor = 'vec4 diffuseColor = vec4( diffuse, opacity )';

		// Vertex

		const vertexDeclarations = /*glsl*/`
			attribute vec3 aOffset;
			uniform float uAmplitude;
			uniform float uScale;
			uniform float uTime;
			uniform float uThickness;
			uniform float uTurbulence;
			uniform vec3 uCursor;
			varying float vHeight;
			${simplex3D}
		`;

		const vertexChanges = /*glsl*/`
			transformed += aOffset;

			float distanceToCursor = length( uCursor - aOffset );
			float force = - 1.0 / ( 1.618 + sqrt( distanceToCursor ) );

			float waves = simplex3D(
				uScale * 0.02 * aOffset.x, 
				distanceToCursor * 0.1 - uTime,
				uScale * 0.02 * aOffset.z
			) * force * 8.0;

			float turbulence = simplex3D(
				aOffset.x * uScale,
				aOffset.z * uScale,
				uTime
			) * uTurbulence;

			float noise = abs( uThickness + waves + turbulence );

			transformed.y *= position.y * noise * uAmplitude;

			vHeight = transformed.y;
		`;

		// Fragment

		const fragmentDeclarations = /*glsl*/`
			uniform vec3 uHighColor;
			varying float vHeight;
		`;

		const fragmentChanges = /*glsl*/`
			vec4 diffuseColor = vec4( mix( diffuse, uHighColor, vHeight ), opacity );
		`;

		// Apply changes

		shader.vertexShader = shader.vertexShader.replace(
			common,
			common + vertexDeclarations
		);
		shader.vertexShader = shader.vertexShader.replace(
			beginVertex,
			beginVertex + vertexChanges
		);
		shader.fragmentShader = shader.fragmentShader.replace(
			common,
			common + fragmentDeclarations
		);
		shader.fragmentShader = shader.fragmentShader.replace(
			diffuseColor,
			fragmentChanges
		);

		Object.assign( shader.uniforms, this.shader.uniforms );

		this.shader = shader;

	}

	tick( delta ) {

		this.time += delta * this.speed;
		this.shader.uniforms.uTime.value = this.time;

		super.tick( delta );

	}

	setSpeed( speed = this.settings.speed.value, multiplier = 0.0001 ) {

		this.speed = speed * multiplier;

	}

}

export { Blockflow };