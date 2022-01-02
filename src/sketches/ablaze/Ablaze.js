import {
	CircleGeometry,
	Color,
	EdgesGeometry,
	Float32BufferAttribute,
	InstancedBufferAttribute,
	InstancedBufferGeometry,
	LineBasicMaterial,
	LineSegments,
	MathUtils,
	Mesh,
	MeshBasicMaterial,
	Uniform,
	Vector3,
} from 'three';

import rotateZ from 'keda/glsl/transform/rotateZ.glsl';
import { Sketch } from 'keda/three/Sketch';
import { GPGPU } from 'keda/three/gpgpu/GPGPU';
import { CameraBounds } from 'keda/three/misc/CameraBounds';
import { BloomPass } from 'keda/three/postprocessing/BloomPass';

import { AblazeControls } from './AblazeControls';
import { AblazeSettings } from './AblazeSettings';
import GPGPU_x_shader from './shaders/GPGPU_x.frag';
import GPGPU_y_shader from './shaders/GPGPU_y.frag';
import GPGPU_z_shader from './shaders/GPGPU_z.frag';

class Ablaze extends Sketch {

	constructor( settings = {} ) {

		super( { defaults: AblazeSettings, settings } );

		this.bounds = new CameraBounds(
			this.camera,
			this.settings.particle.near,
			this.settings.particle.far
		);

	}

	init() {

		super.init();

		this.effects.add( 'bloom', new BloomPass( this.settings.bloom ) );

		this.controls = new AblazeControls( this );

	}

	build() {

		const { random, settings } = this;

		// Disc

		const discGeometry = new CircleGeometry(
			settings.disc.size,
			settings.disc.segments
		);
		const discMaterial = new MeshBasicMaterial( settings.disc.fill );
		const disc = new Mesh( discGeometry, discMaterial );
		disc.position.z = settings.particle.near + settings.disc.offset;
		this.add( disc );

		const circleGeometry = new EdgesGeometry( discGeometry );
		const circleMaterial = new LineBasicMaterial( {
			...settings.particle.material,
			...settings.disc.stroke,
		} );
		const circle = new LineSegments(
			circleGeometry,
			circleMaterial
		);
		circle.position.copy( disc.position );
		this.add( circle );

		// Particle Geometry

		const { GPGPUTextureSize } = settings;
		const particleCount = GPGPUTextureSize * GPGPUTextureSize;

		const shape = new CircleGeometry( settings.particle.size, 3 );
		shape.rotateZ( Math.PI / 2 );
		const edges = new EdgesGeometry( shape );

		const positionsX = new Float32Array( particleCount );
		const positionsY = new Float32Array( particleCount );
		const positionsZ = new Float32Array( particleCount );
		const targets = new Float32Array( particleCount * 2 );
		const noises = new Float32Array( particleCount );

		this.bounds.update();
		const { left, right, bottom, top, near, far } = this.bounds;

		for ( let i = 0, j = 0; i < particleCount; i ++ ) {

			positionsX[ i ] = random.number( left, right );
			positionsY[ i ] = random.number( bottom, top );
			positionsZ[ i ] = random.number( near, far );

			targets[ j ++ ] = ( i % GPGPUTextureSize ) / GPGPUTextureSize;
			targets[ j ++ ] = ~ ~ ( i / GPGPUTextureSize ) / GPGPUTextureSize;

			noises[ i ] = random.noise();

		}

		const geometry = new InstancedBufferGeometry();
		geometry.instanceCount = particleCount;
		geometry.setAttribute(
			'position',
			new Float32BufferAttribute().copy( edges.attributes.position )
		);
		geometry.setAttribute(
			'GPGPU_target',
			new InstancedBufferAttribute( targets, 2 )
		);
		geometry.setAttribute(
			'aNoise',
			new InstancedBufferAttribute( noises, 1 )
		);

		// Particle

		const material = new LineBasicMaterial( settings.particle.material );
		material.onBeforeCompile = this.editShader.bind( this );

		const particles = new LineSegments( geometry, material );
		particles.frustumCulled = false;
		this.particles = particles;
		this.add( particles );

		// Complete

		this.particleCountMax = particleCount;
		this.particleCountMin = Math.round( particleCount * 0.1 );
		this.updateInstanceCount();

		shape.dispose();
		edges.dispose();

		this.initGPGPU( positionsX, positionsY, positionsZ );

	}

	initGPGPU( positionsX, positionsY, positionsZ ) {

		const { settings } = this;

		GPGPU.init( this.sketchpad.renderer );

		const gpgpu = new GPGPU( this.particleCountMax );
		this.gpgpu = gpgpu;

		const { epsilon, speed, scale, strength } = settings.curl;
		this.curlEpsilon = new Uniform( epsilon );
		this.curlScale = new Uniform( scale );
		this.curlSpeed = new Uniform( speed / ( epsilon * 2 ) );
		this.curlStrength = new Uniform( new Vector3(
			strength.x,
			strength.y,
			strength.z
		) );
		this.delta = new Uniform( 0 );
		this.time = new Uniform( 0 );
		this.wind = new Uniform( new Vector3() );

		const uniformsXYZ = {
			uEpsilon: this.curlEpsilon,
			uCurlScale: this.curlScale,
			uCurlSpeed: this.curlSpeed,
			uCurlStrength: this.curlStrength,
			uDelta: this.delta,
			uTime: this.time,
			uWind: this.wind,
		};

		gpgpu.addVariable( 'x', {
			data: positionsX,
			shader: GPGPU_x_shader,
			uniforms: {
				uBounds: { value: this.bounds.x },
				...uniformsXYZ,
			},
		} );

		gpgpu.addVariable( 'y', {
			data: positionsY,
			shader: GPGPU_y_shader,
			uniforms: {
				uBounds: { value: this.bounds.y },
				...uniformsXYZ,
			},
		} );

		gpgpu.addVariable( 'z', {
			data: positionsZ,
			shader: GPGPU_z_shader,
			uniforms: {
				uBounds: { value: this.bounds.z },
				...uniformsXYZ,
			},
		} );

		gpgpu.assign( 'x', 'y' );
		gpgpu.assign( 'x', 'z' );
		gpgpu.assign( 'y', 'x' );
		gpgpu.assign( 'y', 'z' );
		gpgpu.assign( 'z', 'x' );
		gpgpu.assign( 'z', 'y' );

		this.shader = {
			uniforms: {
				uTime: this.time,
				uColorTop: { value: new Color( settings.particle.colorTop ) },
				uRotation: { value: settings.rotation },
				uBounds: { value: this.bounds.y },
				uScale: { value: new Vector3(
					settings.scale.top,
					settings.scale.bottom,
					settings.scale.gradient,
				) },
				GPGPU_x: gpgpu.x,
				GPGPU_y: gpgpu.y,
				GPGPU_z: gpgpu.z,
			},
		};

	}

	editShader( shader ) {

		// THREE tokens ( r136 )

		const common = '#include <common>';
		const beginVertex = '#include <begin_vertex>';
		const diffuseColor = 'vec4 diffuseColor = vec4( diffuse, opacity )';

		// Vertex

		const vertexDeclarations = /*glsl*/`
			attribute vec2 GPGPU_target;
			uniform sampler2D GPGPU_x;
			uniform sampler2D GPGPU_y;
			uniform sampler2D GPGPU_z;

			attribute float aNoise;
			uniform float uRotation;
			uniform float uTime;
			varying float vAltitude;
			uniform vec3 uBounds;
			uniform vec3 uScale;

			${ GPGPU.FloatPack.glsl }

			${ rotateZ }
		`;
		const vertexChanges = /*glsl*/`
			float translateX = unpackFloat( texture2D( GPGPU_x, GPGPU_target ) );
			float translateY = unpackFloat( texture2D( GPGPU_y, GPGPU_target ) );
			float translateZ = unpackFloat( texture2D( GPGPU_z, GPGPU_target ) );

			vAltitude = mix( 1.0, 0.0, ( translateY - uBounds.x ) / uBounds.z );
			
			float scale = mix( 
				uScale.x,
				uScale.y,
				vAltitude * mix( uScale.z, 1.0, aNoise )
			);
			mat3 rotation = rotateZ( uTime * uRotation * aNoise );
			
			transformed *= scale * rotation;
			transformed += vec3( translateX, translateY, translateZ );
		`;

		const fragmentDeclarations = /*glsl*/`
			uniform vec3 uColorTop;
			varying float vAltitude;
		`;
		const fragmentChanges = /*glsl*/`
			vec4 diffuseColor = vec4( 
				mix( uColorTop, diffuse, vAltitude ), 
				opacity
			);
		`;

		// Apply

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

	updateInstanceCount() {

		const instanceCount = Math.floor( MathUtils.clamp(
			this.settings.particle.count * this.camera.aspect,
			this.particleCountMin,
			this.particleCountMax
		) );
		this.particles.geometry.instanceCount = instanceCount;

	}

	resize( width, height, pixelRatio ) {

		super.resize( width, height, pixelRatio );

		if ( ! this.particles ) return;
		this.bounds.update();
		this.updateInstanceCount();

	}

	tick( delta ) {

		const scaledDelta = delta * this.settings.speed;
		this.delta.value = scaledDelta;
		this.time.value += scaledDelta * this.settings.timeFactor;

		this.gpgpu.tick();

		super.tick( delta );

	}

}

export { Ablaze };
