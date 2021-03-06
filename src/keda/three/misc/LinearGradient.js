import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

import varyingUV from 'keda/glsl/varyingUV.vert.glsl';
import bayerMatrixDither from 'keda/glsl/bayerMatrixDither.glsl';
import linearGradient from 'keda/glsl/linearGradient.glsl';

class LinearGradient extends Mesh {

	constructor( {
		color1 = 0xffffff,
		color2 = 0x000000,
		angle = 90,
	} = {} ) {

		const geometry = new PlaneGeometry( 2, 2 );
		const material = new ShaderMaterial( {
			...LinearGradient.shader,
			uniforms: {
				uAngle:  { value: angle },
				uColor1: { value: new Color( color1 ) },
				uColor2: { value: new Color( color2 ) },
			},
		} );

		super( geometry, material );

		this.frustumCulled = false;

	}

	get angle() {

		return this.material.uniforms.uAngle.value;

	}

	set angle( value ) {

		this.material.uniforms.uAngle.value = value;

	}

	get color1() {

		return this.material.uniforms.uColor1.value;

	}

	set color1( value ) {

		this.material.uniforms.uColor1.value = value;

	}

	get color2() {

		return this.material.uniforms.uColor2.value;

	}

	set color2( value ) {

		this.material.uniforms.uColor2.value = value;

	}

}

LinearGradient.shader =  {
	depthWrite: false,
	depthTest: false,

	vertexShader: varyingUV,
	fragmentShader: /*glsl*/`
		uniform float uAngle;
		uniform vec3 uColor1;
		uniform vec3 uColor2;
		varying vec2 vUv;
		
		${ linearGradient }
		${ bayerMatrixDither }

		void main() {

			vec2 origin = vec2( 0.5, 0.5 );
			vec2 target = vUv - origin;
			vec3 color = linearGradient( origin, target, uColor1, uColor2, uAngle );
			
			color = bayerMatrixDither( color );

			gl_FragColor = vec4( color, 1.0 );
			
		}`
	,
};

export { LinearGradient };
