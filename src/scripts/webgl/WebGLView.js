import * as THREE from 'three';
import GLTFLoader from 'three-gltf-loader';
import glslify from 'glslify';
import Tweakpane from 'tweakpane';
import OrbitControls from 'three-orbitcontrols';
import TweenMax from 'TweenMax';
import baseDiffuseFrag from '../../shaders/basicDiffuse.frag';
import basicDiffuseVert from '../../shaders/basicDiffuse.vert';
import dougFrag from '../../shaders/doug.frag';
import dougVert from '../../shaders/doug.vert';
import MouseCanvas from '../MouseCanvas';
import TextCanvas from '../TextCanvas';
import RenderTri from '../RenderTri';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { debounce } from '../utils/debounce';

export default class WebGLView {
  constructor(app) {
    this.app = app;
    this.PARAMS = {
      rotSpeed: 0.005
    };

    this.init();
  }

  async init() {
    this.initThree();
    this.initBgScene();
    this.initTweakPane();
    await this.loadMesh();
    this.initLights();
    this.setupTextCanvas();
    this.initMouseMoveListen();
    this.initMouseCanvas();
    this.initRenderTri();
    this.initPostProcessing();
    this.initResizeHandler();

    this.hideLoader();
  }

  hideLoader() {
    let el = document.getElementById('loader');
    el.style.display = 'none';
    // debugger;
  }

  initResizeHandler() {
    window.addEventListener(
      'resize',
      debounce(() => {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.renderer.setSize(this.width, this.height);

        // render tri
        this.renderTri.renderer.setSize(this.width, this.height);
        this.renderTri.triMaterial.uniforms.uResolution.value = new THREE.Vector2(
          this.width,
          this.height
        );

        // bg scene
        this.bgRenderTarget.setSize(this.width, this.height);
        this.bgCamera.aspect = this.width / this.height;
        this.bgCamera.updateProjectionMatrix();

        // text canvas
        this.textCanvas.canvas.width = this.width;
        this.textCanvas.canvas.height = this.height;
        this.setupTextCanvas();
        this.renderTri.triMaterial.uniforms.uTextCanvas.value = this.textCanvas.texture;

        // mouse canvas
        this.mouseCanvas.canvas.width = this.width;
        this.mouseCanvas.canvas.height = this.height;

        // composer
        this.composer.setSize(this.width, this.height);
      }, 500)
    );
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // const bloomPass = new BloomPass(
    //   1, // strength
    //   25, // kernel size
    //   4, // sigma ?
    //   256 // blur render target resolution
    // );
    // this.composer.addPass(bloomPass);

    // const filmPass = new FilmPass(
    //   0.35, // noise intensity
    //   0.025, // scanline intensity
    //   648, // scanline count
    //   false // grayscale
    // );
    // filmPass.renderToScreen = true;
    // this.composer.addPass(filmPass);
  }

  initTweakPane() {
    this.pane = new Tweakpane();

    this.pane
      .addInput(this.PARAMS, 'rotSpeed', {
        min: 0.0,
        max: 0.5
      })
      .on('change', value => { });

    this.pane.containerElem_.style.display = 'none';
  }

  initMouseCanvas() {
    this.mouseCanvas = new MouseCanvas();
  }

  initMouseMoveListen() {
    this.mouse = new THREE.Vector2();
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    window.addEventListener('mousemove', ({ clientX, clientY }) => {
      // this.mouse.x = (clientX / this.width) * 2 - 1;
      // this.mouse.y = -(clientY / this.height) * 2 + 1;

      TweenMax.to(this.mouse, 4.5, {
        x: (clientX / this.width) * 2 - 1,
        y: -(clientY / this.height) * 2 + 1
      })

      this.mouseCanvas.addTouch(this.mouse);
    });
  }

  initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.autoClear = true;

    this.clock = new THREE.Clock();
  }

  setupTextCanvas() {
    this.textCanvas = new TextCanvas(this);
  }

  loadMesh() {
    return new Promise((res, rej) => {
      let loader = new GLTFLoader();

      loader.load('https://raw.githubusercontent.com/pfreema1/threejs-custom-shaders/shader-test-5/static/PreviousTests/Test2.gltf', object => {
        // debugger;
        console.log('object:  ', object);
        this.bgScene = object.scene;
        this.doug = object.scene.children[2];
        this.doug.add(new THREE.AxesHelper());
        this.dougMesh = this.doug.children[1];
        this.dougMesh.material.transparent = true;
        this.dp = [];
        // this.bgScene.add(this.doug);
        this.doug.position.z -= 5;
        this.group = new THREE.Group();
        // this.group.add(this.doug);

        // setup doug animation
        this.mixer = new THREE.AnimationMixer(object.scene);
        let actions = [];
        actions.push(this.mixer.clipAction(object.animations[0]));
        actions[0].loop = THREE.LoopPingPong;
        actions[0].play();
        actions[0].timeScale = 1.0;

        // setup points doug
        const pointsMaterialShader = THREE.ShaderLib.points;
        const uniforms = {
          time: {
            type: 'f',
            value: 0
          },
          size: {
            type: 'f',
            value: 2
          },
          scale: {
            type: 'f',
            value: 1
          },
          dougX: {
            type: 'f',
            value: 0
          }
        };
        const customUniforms = THREE.UniformsUtils.merge([pointsMaterialShader, uniforms]);
        const shaderMaterialParams = {
          uniforms: customUniforms,
          vertexShader: glslify(dougVert),
          fragmentShader: glslify(dougFrag) //pointsMaterialShader.fragmentShader,
        };
        const pointMat = new THREE.ShaderMaterial(shaderMaterialParams);

        for (let i = 0; i < 3; i++) {
          const dp = new THREE.Points(this.dougMesh.geometry, pointMat);
          dp.position.set(0, 2, 278);
          dp.scale.set(0.14 + (i * 0.002), 0.14 + (i * 0.002), 0.14 + (i * 0.002));
          dp.positionScalar = Math.random() * 2 - 1;
          this.dp.push(dp);
          this.bgScene.add(dp);
          // this.group.add(dp);
        }




        res();
      });
    });
  }

  initRenderTri() {
    this.resize();

    this.renderTri = new RenderTri(
      this.scene,
      this.renderer,
      this.bgRenderTarget,
      this.mouseCanvas,
      this.textCanvas
    );
  }

  normalize(x, fromMin, fromMax) {
    let totalRange;

    x = Math.abs(x);
    totalRange = Math.abs(fromMin) + Math.abs(fromMax);
    // now we can map out the range from 0 to the totalRange and get a normalized (0 - 1) value
    return x / totalRange;
  }

  initBgScene() {
    this.bgRenderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );
    this.bgCamera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.01,
      1000
    );

    // this.bgCamera.position.z = 3;
    this.bgCamera.position.set(-20, 0, -40);
    this.controls = new OrbitControls(this.bgCamera, this.renderer.domElement);
    this.controls.update();

    this.bgScene = new THREE.Scene();
  }

  initLights() {
    this.pointLight = new THREE.PointLight(0xffffff, 100);
    this.pointLight.position.set(0, 50, 50);
    this.bgScene.add(this.pointLight);
  }

  resize() {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.fovHeight =
      2 *
      Math.tan((this.camera.fov * Math.PI) / 180 / 2) *
      this.camera.position.z;
    this.fovWidth = this.fovHeight * this.camera.aspect;

    this.renderer.setSize(window.innerWidth, window.innerHeight);

    if (this.trackball) this.trackball.handleResize();
  }

  updateTestMesh(time) {
    this.testMesh.rotation.y += this.PARAMS.rotSpeed;

    this.testMeshMaterial.uniforms.u_time.value = time;
  }

  updateTextCanvas(time) {
    this.textCanvas.textLine.update(time);
    this.textCanvas.textLine.draw(time);
    this.textCanvas.texture.needsUpdate = true;
  }

  updateDougPoints(time) {
    for (let i = 0; i < this.dp.length; i++) {
      let dp = this.dp[i];

      dp.position.x = this.mouse.x * dp.positionScalar * 200;

      // dp.position.x = Math.min(Math.max(dp.position.x, -15), 15);

      dp.material.uniforms.dougX.value = dp.position.x;

      dp.material.uniforms.time.value = time;

      // dp.opacity = 0.2;

    }
  }

  updateDoug(time) {
    this.bgCamera.lookAt(this.doug.position);
    // this.doug.rotation.z += 0.002;
    // this.doug.rotation.x += 0.002;
  }

  update() {
    const delta = this.clock.getDelta();
    const time = performance.now() * 0.0005;

    this.controls.update();

    if (this.mixer) {
      this.mixer.update(delta);
    }

    if (this.dp) {
      this.updateDougPoints(time);
    }

    if (this.doug) {
      this.updateDoug(time);
    }

    if (this.renderTri) {
      this.renderTri.triMaterial.uniforms.uTime.value = time;
    }

    if (this.testMesh) {
      this.updateTestMesh(time);
    }

    if (this.mouseCanvas) {
      this.mouseCanvas.update();
    }

    if (this.textCanvas) {
      this.updateTextCanvas(time);
    }

    if (this.trackball) this.trackball.update();
  }

  draw() {
    this.renderer.setRenderTarget(this.bgRenderTarget);
    this.renderer.render(this.bgScene, this.bgCamera);
    this.renderer.setRenderTarget(null);

    this.renderer.render(this.scene, this.camera);

    if (this.composer) {
      this.composer.render();
    }
  }
}
