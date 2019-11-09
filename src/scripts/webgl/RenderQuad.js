/*
  To use it, simply declare:
  `const post = new PostFX(rendering);`
  
  Then on update, instead of:
  `rendering.render(scene, camera);`
  replace with:
  `post.render(scene, camera);`
*/
import * as THREE from 'three';

const vertexShader = `precision highp float;
  attribute vec2 position;
  
  void main() {
    // Look ma! no projection matrix multiplication,
    // because we pass the values directly in clip space coordinates.
    gl_Position = vec4(position, 1.0, 1.0);
  }`;

const fragmentShader = `precision highp float;
  uniform sampler2D uScene;
  uniform vec2 uResolution;
  
  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec3 color = vec3(uv, 1.0);
    color = texture2D(uScene, uv).rgb;
  
    // Do your cool postprocessing here
    color.r += sin(uv.x * 50.0);
  
    gl_FragColor = vec4(color, 1.0);
  }`;

export default class RenderQuad {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    // three.js for .render() wants a camera, even if we're not using it :(
    this.dummyCamera = new THREE.OrthographicCamera();
    this.geometry = new THREE.BufferGeometry();

    // Triangle expressed in clip space coordinates
    const vertices = new Float32Array([
      -1.0, -1.0,
      3.0, -1.0,
      -1.0, 3.0
    ]);

    this.geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 2));

    this.resolution = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(this.resolution);

    this.target = new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, {
      format: RGBFormat,
      stencilBuffer: false,
      depthBuffer: true,
    });

    this.material = new THREE.RawShaderMaterial({
      fragmentShader,
      vertexShader,
      uniforms: {
        uScene: { value: this.target.texture },
        uResolution: { value: this.resolution },
      },
    });

    // TODO: handle the resize -> update uResolution uniform and this.target.setSize()

    this.triangle = new THREE.Mesh(this.geometry, this.material);
    // Our triangle will be always on screen, so avoid frustum culling checking
    this.triangle.frustumCulled = false;
    this.scene.add(this.triangle);
  }

  render(scene, camera) {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.dummyCamera);
  }
}