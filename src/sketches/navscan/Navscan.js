import {
	BufferGeometry,
	BufferAttribute,
	LineBasicMaterial,
	LineSegments,
	Vector3
} from 'three';

import { BloomPass } from 'keda/three/postprocessing/BloomPass';
import { Sketch } from 'keda/three/Sketch';

import { NavscanControls } from './NavscanControls';
import { NavscanSettings } from './NavscanSettings';
import { NavscanShaders } from './NavscanShaders';

class Navscan extends Sketch {

	constructor( settings = {} ) {

		super( { defaults: NavscanSettings, settings } );

	}

	init() {

		this.effects.add( 'bloom', new BloomPass( this.settings.bloom ) );

		super.init( NavscanControls );

	}

	initScene() {

		const { tilesX, tilesZ, tileWidth, tileDepth } = this.settings;

		const width = tilesX * tileWidth;
		const depth = tilesZ * tileDepth;
		const offsetX = - width / 2;
		const offsetZ = - depth;

		const pointsX = tilesX + 1;
		const pointsZ = tilesZ + 1;

		const tiles = tilesX * tilesZ;
		const points = pointsX * pointsZ;
		const vertices = tiles * 8; // 2 points * 4 lines

		if ( this.debug ) console.log( { points, tiles } );

		const positions = new Float32Array( vertices * 3 );

		// Compute tiles

		const positionsX = new Float32Array( points );
		const positionsZ = new Float32Array( points );
		let positionX = 0;
		let positionZ = 0;
		let pointX = 0;
		let pointZ = 0;

		for ( let point = 0; point < points; point ++ ) {

			positionsX[ positionX ++ ] = offsetX + tileWidth * pointX;
			positionsZ[ positionZ ++ ] = offsetZ + tileDepth * pointZ;

			pointX = ( pointX + 1 ) % pointsX;
			if ( pointX === 0 ) pointZ ++;

		}

		// Fill geometry

		let position = 0;
		let tileX = 0;
		let tileZ = 0;

		pointX = 0;
		pointZ = 0;

		let backLeft, backRight, frontLeft, frontRight;

		const addVertex = ( index ) => {

			positions[ position ++ ] = positionsX[ index ];
			positions[ position ++ ] = 0;
			positions[ position ++ ] = positionsZ[ index ];

		};

		const addLine = ( a, b ) => {

			addVertex( a );
			addVertex( b );

		};

		for ( let tile = 0; tile < tiles; tile ++ ) {

			backLeft = tile + tileZ;
			backRight = backLeft + 1;
			frontLeft = tile + pointsX + tileZ;
			frontRight = frontLeft + 1;

			addLine( backLeft, backRight );
			addLine( backRight, frontRight );
			addLine( frontRight, frontLeft );
			addLine( frontLeft, backLeft );

			tileX = ( tileX + 1 ) % tilesX;
			if ( tileX === 0 ) tileZ ++;

		}

		const geometry = new BufferGeometry();
		geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) );

		// Lines

		const material = new LineBasicMaterial( this.settings.material );
		material.onBeforeCompile = this.initShader.bind( this );

		const grid = new LineSegments( geometry, material );
		grid.position.set( 0, 0, this.settings.offsetZ );
		this.add( grid );
		this.grid = grid;

		// Define uniforms

		this.shader = {
			uniforms: {
				uAmp: { value: 2.0 },
				uDistance: { value: 0.0 },
				uNoiseScale: { value: new Vector3( 0.1, 0.03, 0.07 ) },
			},
		};

	}

	initShader( shader ) {

		NavscanShaders.edit( shader );
		Object.assign( shader.uniforms, this.shader.uniforms );
		this.shader = shader;

	}



	tick( delta ) {

		this.shader.uniforms.uDistance.value += this.settings.speed.value * delta;

		super.tick( delta );

	}

}

export { Navscan };
