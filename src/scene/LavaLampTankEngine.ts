import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BubbleColorId, BubbleNote, DriftSpeedPreset } from '../types';
import {
  IMPORTANCE_LEVELS,
  calculateDynamicBubbleRadius,
  getBubbleTheme,
  getDeadlineInfo,
  mergeBubbleNotes,
} from '../constants';
import { soundFx } from '../audio/soundEffects';

export interface OrbScreenSnapshot {
  id: string;
  screenX: number;
  screenY: number;
  screenRadius: number;
  opacity: number;
  isFiltered: boolean;
  isHovered: boolean;
  isDragging: boolean;
  zOrder: number;
}

export interface MergePreviewState {
  active: boolean;
  blocked?: boolean;
  x: number;
  y: number;
  combinedLevel: number;
}

interface BurstPearl {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  scale: number;
}

interface AmbientPearl {
  x: number;
  y: number;
  z: number;
  speed: number;
  phase: number;
  scale: number;
}

interface LavaOrbEntity {
  note: BubbleNote;
  group: THREE.Group;
  outerShell: THREE.Mesh;
  innerCore: THREE.Mesh;
  equatorCollar: THREE.Mesh;
  crownLens: THREE.Mesh;
  todayRing: THREE.Mesh;
  videoRing: THREE.Mesh;
  hitProxy: THREE.Mesh;
  outerMaterial: THREE.MeshPhysicalMaterial;
  coreMaterial: THREE.MeshPhysicalMaterial;
  collarMaterial: THREE.MeshStandardMaterial;

  // Physics in world space
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetWorldRadius: number;
  currentWorldRadius: number;
  mass: number;

  // Lava-lamp ultra-slow thermal cycle & natural roaming
  thermalPhase: number;
  thermalFreq: number;
  swirlPhase: number;
  wanderAngle: number;
  cruiseSpeed: number;

  // Soft squish kinematics
  squishScale: THREE.Vector3;
  squishVel: THREE.Vector3;

  // Birth / filter opacity
  spawnScale: number;
  opacity: number;
  isDragging: boolean;
  shaderUniforms: { uTime: { value: number }; uSquishPulse: { value: number } };
}

// Pre-allocated scratch math objects (zero GC in render loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _edgeVec = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _rayHitPoint = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createAuroraSwirlTexture(
  primaryHex: string,
  secondaryHex: string,
  metalHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep molten base
  const baseGrad = ctx.createLinearGradient(0, 0, size, size);
  baseGrad.addColorStop(0, '#040814');
  baseGrad.addColorStop(0.5, primaryHex);
  baseGrad.addColorStop(1, secondaryHex);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Soft swirling aurora bands
  for (let i = 0; i < 14; i++) {
    const cx = (Math.sin(i * 1.7) * 0.35 + 0.5) * size;
    const cy = (Math.cos(i * 2.1) * 0.35 + 0.5) * size;
    const r = size * (0.22 + (i % 4) * 0.08);
    const g = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    const bandColor = i % 3 === 0 ? metalHex : i % 2 === 0 ? primaryHex : secondaryHex;
    g.addColorStop(0, `${bandColor}cc`);
    g.addColorStop(0.55, `${bandColor}44`);
    g.addColorStop(1, 'rgba(4, 8, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle brushed micro-sheen streaks
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = metalHex;
  for (let s = 0; s < 26; s++) {
    const y = (s / 26) * size;
    ctx.lineWidth = 1.5 + (s % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.33,
      y + Math.sin(s) * 28,
      size * 0.66,
      y - Math.cos(s) * 28,
      size,
      y
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(34, 211, 238, 0.36)');
  grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class LavaLampTankEngine {
  private mountEl: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private isSoftwareGl: boolean;

  private width = 1280;
  private height = 720;
  private worldHalfW = 10;
  private worldHalfH = 6.5;

  // Shared procedural geometries & cached aurora textures
  private outerSphereGeo: THREE.SphereGeometry;
  private innerCoreGeo: THREE.SphereGeometry;
  private collarTorusGeo: THREE.TorusGeometry;
  private crownLatheGeo: THREE.LatheGeometry;
  private todayRingGeo: THREE.TorusGeometry;
  private videoRingGeo: THREE.TorusGeometry;
  private hitSphereGeo: THREE.SphereGeometry;
  private auroraTextures = new Map<BubbleColorId, THREE.CanvasTexture>();
  private shadowTexture: THREE.CanvasTexture;

  // Apparatus & instanced pearls
  private vesselGroup: THREE.Group;
  private plinthEmitterMat: THREE.MeshStandardMaterial | null = null;
  private ambientPearlsMesh: THREE.InstancedMesh;
  private ambientPearls: AmbientPearl[] = [];
  private burstPearlsMesh: THREE.InstancedMesh;
  private burstPearls: BurstPearl[] = [];
  private mergeBridgeMesh: THREE.Mesh;
  private mergeBridgeMat: THREE.MeshBasicMaterial;
  private mergeTargetRing: THREE.Mesh;

  // Orb entities
  private orbs: LavaOrbEntity[] = [];

  // Camera parallax & gentle zoom state
  private defaultCameraZ = 18.5;
  private targetCameraZ = 18.5;
  private parallaxTargetX = 0;
  private parallaxTargetY = 0;
  private cameraCurrentPos = new THREE.Vector3(0, 0, 18.5);
  private cameraLookTarget = new THREE.Vector3(0, 0, 0);

  // Interaction & raycasting
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2(-10, -10);
  private draggedOrb: LavaOrbEntity | null = null;
  private mergeCandidate: LavaOrbEntity | null = null;
  private blockedMergeCandidate: LavaOrbEntity | null = null;
  private hoveredOrbId: string | null = null;
  private isPointerDown = false;
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private dragWorldOffset = new THREE.Vector3();
  private lastDragPos = new THREE.Vector3();
  private lastRaycastTime = 0;
  private lastCollisionTimes = new Map<string, number>();
  private activeCategoryFilter: string | null = null;
  private mergeSameCategoryOnly = true;
  private driftSpeedMultiplier = 1.0;
  private pendingSplitPositions = new Map<string, { x: number; y: number; z: number; angle: number }>();

  // Lifecycle & callbacks
  private frameId = 0;
  private isRunning = false;
  private lastTime = 0;
  private elapsed = 0;

  private onBubbleClickCb: ((note: BubbleNote) => void) | null = null;
  private onBubbleMoveToTodayCb: ((noteId: string, isToday: boolean) => void) | null = null;
  private onBubbleMergeCb: ((mergedNote: BubbleNote, sourceNoteId: string) => void) | null = null;
  private onFrameSyncCb: ((snapshots: OrbScreenSnapshot[], mergePreview: MergePreviewState | null) => void) | null = null;
  private onBubbleCollideCb: ((id1: string, id2: string) => void) | null = null;
  private onContextLostCb: ((lost: boolean) => void) | null = null;

  constructor(mountEl: HTMLElement) {
    this.mountEl = mountEl;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.width = Math.max(320, mountEl.clientWidth || window.innerWidth);
    this.height = Math.max(240, mountEl.clientHeight || window.innerHeight);

    // 1. Renderer setup with highest crisp resolution & tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.mountEl.appendChild(this.renderer.domElement);

    // WebGL context safety listeners
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // 2. Scene, Camera & Matched Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#030508');
    this.scene.fog = new THREE.FogExp2('#030508', 0.02);

    this.camera = new THREE.PerspectiveCamera(42, this.width / this.height, 0.1, 100);
    this.camera.position.copy(this.cameraCurrentPos);
    this.camera.lookAt(this.cameraLookTarget);
    this.raycaster.layers.set(1);

    // 3. Studio Environment IBL (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmremGenerator.dispose();

    // 4. Studio Three-Point Lighting + Softboxes
    this.setupLighting();

    // 5. Shared Geometries & Textures
    this.outerSphereGeo = new THREE.SphereGeometry(1, 56, 40);
    this.innerCoreGeo = new THREE.SphereGeometry(0.75, 44, 32);
    this.collarTorusGeo = new THREE.TorusGeometry(0.99, 0.02, 16, 72);
    this.todayRingGeo = new THREE.TorusGeometry(1.16, 0.018, 12, 64);
    this.videoRingGeo = new THREE.TorusGeometry(1.09, 0.015, 12, 64);
    this.hitSphereGeo = new THREE.SphereGeometry(1.06, 16, 12);

    // Lathe crown refraction collar profile
    const lathePts = [
      new THREE.Vector2(0.18, 0.94),
      new THREE.Vector2(0.38, 0.91),
      new THREE.Vector2(0.45, 0.87),
      new THREE.Vector2(0.24, 0.89),
      new THREE.Vector2(0.16, 0.93),
    ];
    this.crownLatheGeo = new THREE.LatheGeometry(lathePts, 48);
    this.crownLatheGeo.computeVertexNormals();

    this.shadowTexture = createRadialShadowTexture();

    // 6. Obsidian Lava-Lamp Vessel & Today Thermal Plinth
    this.vesselGroup = this.buildVesselApparatus();
    this.scene.add(this.vesselGroup);

    // 7. Instanced Micro-Pearls (28 ultra-subtle suspended dust motes in calm fluid)
    const pearlGeo = new THREE.SphereGeometry(0.04, 10, 8);
    const pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.65,
      roughness: 0.25,
      iridescence: 0.8,
      transparent: true,
      opacity: 0.24,
    });
    this.ambientPearlsMesh = new THREE.InstancedMesh(pearlGeo, pearlMat, 28);
    this.ambientPearlsMesh.frustumCulled = false;
    this.initAmbientPearls();
    this.scene.add(this.ambientPearlsMesh);

    // Burst pearls for completion pop
    const burstGeo = new THREE.SphereGeometry(0.08, 12, 10);
    const burstMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.burstPearlsMesh = new THREE.InstancedMesh(burstGeo, burstMat, 64);
    this.burstPearlsMesh.frustumCulled = false;
    this.burstPearlsMesh.setColorAt(0, new THREE.Color(0xffffff));
    this.burstPearlsMesh.count = 0;
    this.scene.add(this.burstPearlsMesh);

    // 8. Merge bridge & target ring
    const bridgeGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 16, 1, true);
    bridgeGeo.rotateX(Math.PI / 2);
    this.mergeBridgeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mergeBridgeMesh = new THREE.Mesh(bridgeGeo, this.mergeBridgeMat);
    this.mergeBridgeMesh.visible = false;
    this.scene.add(this.mergeBridgeMesh);

    const targetRingGeo = new THREE.TorusGeometry(1.22, 0.025, 12, 64);
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    this.mergeTargetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    this.mergeTargetRing.visible = false;
    this.scene.add(this.mergeTargetRing);

    // 9. Post-processing (Bloom + ACES OutputPass on hardware GPUs)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.composer.setSize(this.width, this.height);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height),
        0.34, // crisp subtle aurora glow
        0.52,
        0.80
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    this.updateWorldBounds();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private setupLighting() {
    // Cool zenith / obsidian abyss hemisphere fill
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x050814, 0.85);
    this.scene.add(hemi);

    // Warm key directional light
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.85);
    keyLight.position.set(7, 9, 10);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 32;
      const d = 12;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Dichroic violet/cyan rim light from behind for specular edge definition
    const rimLight = new THREE.DirectionalLight(0xa855f7, 1.35);
    rimLight.position.set(-8, -4, -9);
    this.scene.add(rimLight);

    const aquaRim = new THREE.DirectionalLight(0x22d3ee, 1.05);
    aquaRim.position.set(8, -6, -7);
    this.scene.add(aquaRim);

    // Studio Softboxes (RectAreaLight) for liquid-metal highlights on GPUs
    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const leftSoftbox = new THREE.RectAreaLight(0xe0f2fe, 2.8, 4.5, 14);
      leftSoftbox.position.set(-12, 1, 7);
      leftSoftbox.lookAt(0, 0, 0);
      this.scene.add(leftSoftbox);

      const rightSoftbox = new THREE.RectAreaLight(0xf3e8ff, 2.4, 4.5, 14);
      rightSoftbox.position.set(12, -1, 7);
      rightSoftbox.lookAt(0, 0, 0);
      this.scene.add(rightSoftbox);
    }
  }

  private buildVesselApparatus(): THREE.Group {
    const group = new THREE.Group();

    // 1. Grounded bottom obsidian thermal plinth (Today Zone anchor)
    const plinthBaseGeo = new THREE.CylinderGeometry(8.5, 9.2, 0.36, 64);
    const plinthBaseMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.88,
      roughness: 0.28,
    });
    const plinthBase = new THREE.Mesh(plinthBaseGeo, plinthBaseMat);
    plinthBase.position.set(0, -5.8, -1.2);
    plinthBase.receiveShadow = true;
    group.add(plinthBase);

    // 2. Luminous aurora thermal emitter ring on plinth
    const emitterGeo = new THREE.TorusGeometry(6.8, 0.045, 16, 96);
    emitterGeo.rotateX(Math.PI / 2);
    this.plinthEmitterMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.4,
      metalness: 0.4,
      roughness: 0.2,
    });
    const emitterRing = new THREE.Mesh(emitterGeo, this.plinthEmitterMat);
    emitterRing.position.set(0, -5.6, -1.2);
    group.add(emitterRing);

    // 3. Soft radial contact shadow & thermal aura plane
    const shadowGeo = new THREE.PlaneGeometry(18, 10);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.position.set(0, -5.58, -1.2);
    group.add(shadowPlane);

    // 4. Upper capillary titanium halo ring framing top of tank
    const topHaloGeo = new THREE.TorusGeometry(7.2, 0.028, 12, 96);
    topHaloGeo.rotateX(Math.PI / 2);
    const topHaloMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.92,
      roughness: 0.22,
    });
    const topHalo = new THREE.Mesh(topHaloGeo, topHaloMat);
    topHalo.position.set(0, 6.4, -1.5);
    group.add(topHalo);

    return group;
  }

  private initAmbientPearls() {
    this.ambientPearls = [];
    for (let i = 0; i < 28; i++) {
      this.ambientPearls.push({
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 14,
        z: -4 + Math.random() * 5,
        speed: 0.008 + Math.random() * 0.014, // Nearly still background suspension so only bubbles clearly glide
        phase: Math.random() * Math.PI * 2,
        scale: 0.3 + Math.random() * 0.55,
      });
    }
  }

  private getOrCreateAuroraTexture(colorId: BubbleColorId, primary: string, secondary: string, metal: string): THREE.CanvasTexture {
    const existing = this.auroraTextures.get(colorId);
    if (existing) return existing;
    const tex = createAuroraSwirlTexture(
      primary,
      secondary,
      metal,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    this.auroraTextures.set(colorId, tex);
    return tex;
  }

  private createOrbEntity(note: BubbleNote, index: number, totalCount: number): LavaOrbEntity {
    const theme = getBubbleTheme(note);
    const importanceMeta = IMPORTANCE_LEVELS[note.importance] || IMPORTANCE_LEVELS[3];
    const pxRadius = calculateDynamicBubbleRadius(note.importance, note.title, note.fullNote);
    const worldRadius = this.pixelToWorldRadius(pxRadius);

    const group = new THREE.Group();

    const swirlTex = this.getOrCreateAuroraTexture(
      theme.id,
      theme.color,
      theme.auroraSecondary,
      theme.metalTint
    );

    // Part 1: Outer iridescent liquid-metal refractive shell (with subtle slow harmonic vertex undulation)
    const outerMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(theme.metalTint),
      metalness: 0.78,
      roughness: 0.10,
      iridescence: 1.0,
      iridescenceIOR: 1.38,
      iridescenceThicknessRange: [180, 560],
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
      envMapIntensity: 1.45,
    });

    const shaderUniforms = {
      uTime: { value: index * 1.7 },
      uSquishPulse: { value: 0 },
    };

    outerMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shaderUniforms.uTime;
      shader.uniforms.uSquishPulse = shaderUniforms.uSquishPulse;
      shader.vertexShader =
        'uniform float uTime;\nuniform float uSquishPulse;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float w1 = sin(transformed.y * 2.3 + uTime * 0.45) * cos(transformed.x * 1.8 - uTime * 0.35);
        float w2 = sin(transformed.z * 2.5 + uTime * 0.40);
        transformed += objectNormal * ((w1 * 0.025 + w2 * 0.015) * (1.0 + uSquishPulse * 0.5));
        `
      );
    };

    const outerShell = new THREE.Mesh(this.outerSphereGeo, outerMaterial);
    outerShell.renderOrder = 3;
    outerShell.castShadow = !this.isSoftwareGl;
    group.add(outerShell);

    // Part 2: Inner molten aurora plasma nucleus
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(theme.color),
      map: swirlTex,
      emissive: new THREE.Color(theme.color),
      emissiveMap: swirlTex,
      emissiveIntensity: 0.62,
      metalness: 0.18,
      roughness: 0.38,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
    });
    const innerCore = new THREE.Mesh(this.innerCoreGeo, coreMaterial);
    innerCore.renderOrder = 1;
    group.add(innerCore);

    // Part 3: Brushed metallic meniscus equatorial collar (roughness contrast >= 0.25)
    const collarMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.accentColor),
      emissive: new THREE.Color(theme.auroraSecondary),
      emissiveIntensity: 0.25,
      metalness: 0.94,
      roughness: 0.32,
    });
    const equatorCollar = new THREE.Mesh(this.collarTorusGeo, collarMaterial);
    equatorCollar.rotation.set(0.45, 0.2, 0.3);
    equatorCollar.renderOrder = 2;
    group.add(equatorCollar);

    // Part 4: Optical polar crown lens (LatheGeometry accent detail)
    const crownLens = new THREE.Mesh(this.crownLatheGeo, outerMaterial);
    crownLens.renderOrder = 4;
    group.add(crownLens);

    // Part 5a: Today Goal Zone orbital ring
    const todayRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
    });
    const todayRing = new THREE.Mesh(this.todayRingGeo, todayRingMat);
    todayRing.rotation.x = Math.PI / 2.4;
    todayRing.visible = note.isToday;
    group.add(todayRing);

    // Part 5b: Video attachment halo ring
    const videoRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.accentColor),
      transparent: true,
      opacity: 0.75,
    });
    const videoRing = new THREE.Mesh(this.videoRingGeo, videoRingMat);
    videoRing.rotation.set(-0.65, 0.4, 0);
    videoRing.visible = Boolean(note.videoAttachment);
    group.add(videoRing);

    // Dedicated invisible proxy sphere on layer 1 for instantaneous raycasting
    const hitProxy = new THREE.Mesh(
      this.hitSphereGeo,
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitProxy.layers.set(1);
    hitProxy.userData.orbId = note.id;
    group.add(hitProxy);

    // Initial calm lava-lamp spatial spread
    const cols = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, totalCount))));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const spreadX = (col + 0.5) / cols - 0.5;
    const spreadY = note.isToday
      ? -this.worldHalfH * 0.56 + (Math.random() - 0.5) * 0.6
      : 0.55 - ((row + 0.5) / Math.max(2, Math.ceil(totalCount / cols))) * 0.85;

    const initX = spreadX * (this.worldHalfW * 1.45) + (Math.random() - 0.5) * 0.8;
    const initY = Math.max(
      -this.worldHalfH + worldRadius + 1.4,
      Math.min(this.worldHalfH - worldRadius - 0.8, spreadY * this.worldHalfH * 1.2)
    );
    const initZ = (Math.random() - 0.5) * 2.2;

    const splitSpawn = this.pendingSplitPositions.get(note.id);
    if (splitSpawn) {
      this.pendingSplitPositions.delete(note.id);
      group.position.set(splitSpawn.x, splitSpawn.y, splitSpawn.z);
    } else {
      group.position.set(initX, initY, initZ);
    }
    group.scale.setScalar(0.01);
    this.scene.add(group);

    const initWanderAngle = splitSpawn ? splitSpawn.angle : Math.random() * Math.PI * 2;
    const initCruiseSpeed = 0.22 + Math.random() * 0.12;

    return {
      note,
      group,
      outerShell,
      innerCore,
      equatorCollar,
      crownLens,
      todayRing,
      videoRing,
      hitProxy,
      outerMaterial,
      coreMaterial,
      collarMaterial,
      position: group.position,
      velocity: new THREE.Vector3(
        Math.cos(initWanderAngle) * initCruiseSpeed,
        Math.sin(initWanderAngle) * initCruiseSpeed * 0.8,
        (Math.random() - 0.5) * 0.04
      ),
      targetWorldRadius: worldRadius,
      currentWorldRadius: worldRadius,
      mass: importanceMeta.mass,
      thermalPhase: Math.random() * Math.PI * 2,
      thermalFreq: 0.06 + Math.random() * 0.05,
      swirlPhase: Math.random() * Math.PI * 2,
      wanderAngle: initWanderAngle,
      cruiseSpeed: initCruiseSpeed,
      squishScale: new THREE.Vector3(1, 1, 1),
      squishVel: new THREE.Vector3(0, 0, 0),
      spawnScale: 0.01,
      opacity: 1,
      isDragging: false,
      shaderUniforms,
    };
  }

  private pixelToWorldRadius(px: number): number {
    const visibleHeight = 2 * this.defaultCameraZ * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const worldPerPx = visibleHeight / Math.max(400, this.height);
    return THREE.MathUtils.clamp(px * worldPerPx * 0.88, 0.58, 2.05);
  }

  private updateWorldBounds() {
    const visibleHeight = 2 * this.defaultCameraZ * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const visibleWidth = visibleHeight * (this.width / Math.max(1, this.height));
    this.worldHalfH = visibleHeight * 0.5;
    this.worldHalfW = visibleWidth * 0.5;

    // Position grounded plinth neatly at bottom of tank view
    if (this.vesselGroup) {
      const plinth = this.vesselGroup.children[0];
      const emitter = this.vesselGroup.children[1];
      const shadow = this.vesselGroup.children[2];
      const topHalo = this.vesselGroup.children[3];
      if (plinth) plinth.position.y = -this.worldHalfH - 0.15;
      if (emitter) emitter.position.y = -this.worldHalfH + 0.05;
      if (shadow) shadow.position.y = -this.worldHalfH + 0.07;
      if (topHalo) topHalo.position.y = this.worldHalfH + 0.2;
    }
  }

  public setCallbacks(
    onBubbleClick: (note: BubbleNote) => void,
    onBubbleMoveToToday: (noteId: string, isToday: boolean) => void,
    onBubbleMerge?: (mergedNote: BubbleNote, sourceNoteId: string) => void
  ) {
    this.onBubbleClickCb = onBubbleClick;
    this.onBubbleMoveToTodayCb = onBubbleMoveToToday;
    this.onBubbleMergeCb = onBubbleMerge || null;
  }

  public setVisualSyncCallbacks(
    onFrameSync: (snapshots: OrbScreenSnapshot[], mergePreview: MergePreviewState | null) => void,
    onBubbleCollide: (id1: string, id2: string) => void,
    onContextLost?: (lost: boolean) => void
  ) {
    this.onFrameSyncCb = onFrameSync;
    this.onBubbleCollideCb = onBubbleCollide;
    this.onContextLostCb = onContextLost || null;
  }

  public setCategoryFilter(category: string | null) {
    this.activeCategoryFilter = category;
  }

  public setConfig(opts: { mergeSameCategoryOnly: boolean; driftSpeed: DriftSpeedPreset }) {
    this.mergeSameCategoryOnly = opts.mergeSameCategoryOnly;
    this.driftSpeedMultiplier =
      opts.driftSpeed === 'ultra-slow' ? 0.62 : opts.driftSpeed === 'gentle' ? 1.45 : 1.0;
  }

  public registerSplitPosition(sourceId: string, newId: string) {
    const sourceOrb = this.orbs.find((o) => o.note.id === sourceId);
    if (!sourceOrb) return;
    const angle = Math.random() * Math.PI * 2;
    const offset = Math.max(0.95, sourceOrb.currentWorldRadius * 0.9);
    sourceOrb.wanderAngle = angle + Math.PI;
    sourceOrb.squishScale.set(0.86, 1.15, 0.96);
    this.pendingSplitPositions.set(newId, {
      x: THREE.MathUtils.clamp(sourceOrb.position.x + Math.cos(angle) * offset, -this.worldHalfW + 1, this.worldHalfW - 1),
      y: THREE.MathUtils.clamp(sourceOrb.position.y + Math.sin(angle) * offset, -this.worldHalfH + 1, this.worldHalfH - 1),
      z: sourceOrb.position.z,
      angle,
    });
  }

  public resetCamera() {
    this.targetCameraZ = this.defaultCameraZ;
    this.parallaxTargetX = 0;
    this.parallaxTargetY = 0;
  }

  public agitateTank() {
    soundFx.playBounce(0.75);
    this.orbs.forEach((orb) => {
      // Gentle, dreamy thermal swirl rather than chaotic jitter
      const angle = Math.random() * Math.PI * 2;
      const force = 0.28 + Math.random() * 0.22;
      orb.velocity.x += Math.cos(angle) * force;
      orb.velocity.y += Math.sin(angle) * force * 0.7;
      orb.squishScale.set(1.08, 0.92, 1.04);
    });
  }

  public triggerCompletionPop(noteId: string) {
    const idx = this.orbs.findIndex((o) => o.note.id === noteId);
    if (idx === -1) return;
    const orb = this.orbs[idx];
    const theme = getBubbleTheme(orb.note);
    soundFx.playCompletionBurst();

    // Spawn 3D burst micro-pearls
    const baseColor = new THREE.Color(theme.accentColor);
    for (let i = 0; i < 24; i++) {
      if (this.burstPearls.length >= 64) break;
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      this.burstPearls.push({
        position: orb.position.clone(),
        velocity: dir.multiplyScalar(1.2 + Math.random() * 2.0),
        color: baseColor.clone(),
        life: 0,
        maxLife: 0.9 + Math.random() * 0.5,
        scale: 0.6 + Math.random() * 0.9,
      });
    }

    this.disposeOrbEntity(orb);
    this.orbs.splice(idx, 1);
  }

  private disposeOrbEntity(orb: LavaOrbEntity) {
    this.scene.remove(orb.group);
    orb.outerMaterial.dispose();
    orb.coreMaterial.dispose();
    orb.collarMaterial.dispose();
    (orb.todayRing.material as THREE.Material).dispose();
    (orb.videoRing.material as THREE.Material).dispose();
    (orb.hitProxy.material as THREE.Material).dispose();
  }

  public syncNotes(notes: BubbleNote[]) {
    const existingMap = new Map<string, LavaOrbEntity>();
    this.orbs.forEach((o) => existingMap.set(o.note.id, o));

    const updated: LavaOrbEntity[] = [];
    const seen = new Set<string>();

    notes.forEach((note, index) => {
      seen.add(note.id);
      const existing = existingMap.get(note.id);
      const pxRadius = calculateDynamicBubbleRadius(note.importance, note.title, note.fullNote);
      const targetWorldRadius = this.pixelToWorldRadius(pxRadius);
      const importanceMeta = IMPORTANCE_LEVELS[note.importance] || IMPORTANCE_LEVELS[3];

      if (existing) {
        const prevTheme = getBubbleTheme(existing.note);
        const nextTheme = getBubbleTheme(note);
        existing.note = note;
        existing.targetWorldRadius = targetWorldRadius;
        existing.mass = importanceMeta.mass;
        existing.todayRing.visible = note.isToday;
        existing.videoRing.visible = Boolean(note.videoAttachment);

        if (prevTheme.id !== nextTheme.id) {
          const swirlTex = this.getOrCreateAuroraTexture(
            nextTheme.id,
            nextTheme.color,
            nextTheme.auroraSecondary,
            nextTheme.metalTint
          );
          existing.outerMaterial.color.set(nextTheme.metalTint);
          existing.coreMaterial.color.set(nextTheme.color);
          existing.coreMaterial.emissive.set(nextTheme.color);
          existing.coreMaterial.map = swirlTex;
          existing.coreMaterial.emissiveMap = swirlTex;
          existing.coreMaterial.needsUpdate = true;
          existing.collarMaterial.color.set(nextTheme.accentColor);
          existing.collarMaterial.emissive.set(nextTheme.auroraSecondary);
          (existing.videoRing.material as THREE.MeshBasicMaterial).color.set(nextTheme.accentColor);
        }

        updated.push(existing);
      } else {
        updated.push(this.createOrbEntity(note, index, notes.length));
      }
    });

    // Dispose removed orbs
    existingMap.forEach((orb, id) => {
      if (!seen.has(id)) {
        this.disposeOrbEntity(orb);
      }
    });

    this.orbs = updated;
  }

  public resize(width: number, height: number) {
    this.width = Math.max(320, width);
    this.height = Math.max(240, height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    if (this.composer) {
      this.composer.setSize(this.width, this.height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(this.width, this.height);
    }

    this.updateWorldBounds();
    this.orbs.forEach((orb) => {
      const pxRadius = calculateDynamicBubbleRadius(orb.note.importance, orb.note.title, orb.note.fullNote);
      orb.targetWorldRadius = this.pixelToWorldRadius(pxRadius);
    });
  }

  public handleWheel(deltaY: number) {
    this.targetCameraZ = THREE.MathUtils.clamp(
      this.targetCameraZ + deltaY * 0.008,
      13.0,
      24.0
    );
  }

  private updatePointerNdc(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const relX = (clientX - rect.left) / Math.max(1, rect.width);
    const relY = (clientY - rect.top) / Math.max(1, rect.height);
    this.pointerNdc.x = relX * 2 - 1;
    this.pointerNdc.y = -(relY * 2 - 1);

    // Whisper-subtle mouse parallax so background never steals motion from the orbs
    this.parallaxTargetX = THREE.MathUtils.clamp(this.pointerNdc.x * 0.28, -0.28, 0.28);
    this.parallaxTargetY = THREE.MathUtils.clamp(this.pointerNdc.y * 0.18, -0.18, 0.18);
  }

  public handlePointerDown(clientX: number, clientY: number) {
    this.updatePointerNdc(clientX, clientY);
    this.isPointerDown = true;
    this.dragStartClientX = clientX;
    this.dragStartClientY = clientY;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hitProxies = this.orbs.map((o) => o.hitProxy);
    const intersects = this.raycaster.intersectObjects(hitProxies, false);

    if (intersects.length > 0) {
      const orbId = intersects[0].object.userData.orbId as string;
      const found = this.orbs.find((o) => o.note.id === orbId);
      if (found) {
        this.draggedOrb = found;
        found.isDragging = true;
        _dragPlane.set(new THREE.Vector3(0, 0, 1), -found.position.z);
        this.raycaster.ray.intersectPlane(_dragPlane, _rayHitPoint);
        this.dragWorldOffset.copy(found.position).sub(_rayHitPoint);
        this.lastDragPos.copy(found.position);

        soundFx.playSquish();
        found.squishScale.set(0.89, 1.13, 0.94);
      }
    }
  }

  public handlePointerMove(clientX: number, clientY: number) {
    this.updatePointerNdc(clientX, clientY);

    if (this.draggedOrb && this.isPointerDown) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      _dragPlane.set(new THREE.Vector3(0, 0, 1), -this.draggedOrb.position.z);
      if (this.raycaster.ray.intersectPlane(_dragPlane, _rayHitPoint)) {
        const targetX = _rayHitPoint.x + this.dragWorldOffset.x;
        const targetY = _rayHitPoint.y + this.dragWorldOffset.y;

        const padX = this.worldHalfW - this.draggedOrb.currentWorldRadius - 0.3;
        const padY = this.worldHalfH - this.draggedOrb.currentWorldRadius - 0.3;

        const clampedX = THREE.MathUtils.clamp(targetX, -padX, padX);
        const clampedY = THREE.MathUtils.clamp(targetY, -padY, padY);

        this.draggedOrb.velocity.set(
          (clampedX - this.draggedOrb.position.x) * 4.5,
          (clampedY - this.draggedOrb.position.y) * 4.5,
          0
        );
        this.draggedOrb.position.x = clampedX;
        this.draggedOrb.position.y = clampedY;
      }

      // Check proximity for magnetic bubble merge (respecting Same-Category policy)
      let closestAllowed: LavaOrbEntity | null = null;
      let minAllowedRatio = 0.85;
      let closestBlocked: LavaOrbEntity | null = null;
      let minBlockedRatio = 0.80;

      for (const other of this.orbs) {
        if (other === this.draggedOrb) continue;
        const dist = _vecA.copy(other.position).sub(this.draggedOrb.position).length();
        const combinedRadii = this.draggedOrb.currentWorldRadius + other.currentWorldRadius;
        const ratio = dist / Math.max(0.1, combinedRadii);
        const canMerge =
          !this.mergeSameCategoryOnly || other.note.category === this.draggedOrb.note.category;

        if (canMerge) {
          if (ratio < minAllowedRatio) {
            minAllowedRatio = ratio;
            closestAllowed = other;
          }
        } else if (ratio < minBlockedRatio) {
          minBlockedRatio = ratio;
          closestBlocked = other;
        }
      }
      this.mergeCandidate = closestAllowed;
      this.blockedMergeCandidate = closestAllowed ? null : closestBlocked;
      return;
    }

    // Throttled raycast for hover detection
    const now = performance.now();
    if (now - this.lastRaycastTime < 40) return;
    this.lastRaycastTime = now;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hitProxies = this.orbs.map((o) => o.hitProxy);
    const intersects = this.raycaster.intersectObjects(hitProxies, false);

    const nextHoverId =
      intersects.length > 0 ? (intersects[0].object.userData.orbId as string) : null;

    if (nextHoverId !== this.hoveredOrbId) {
      this.hoveredOrbId = nextHoverId;
      if (nextHoverId) {
        const hovered = this.orbs.find((o) => o.note.id === nextHoverId);
        if (hovered) {
          hovered.squishScale.set(1.09, 0.92, 1.05);
        }
      }
    }
  }

  public handlePointerUp(clientX?: number, clientY?: number) {
    if (this.draggedOrb) {
      const orb = this.draggedOrb;
      orb.isDragging = false;
      this.draggedOrb = null;

      const endX = clientX ?? this.dragStartClientX;
      const endY = clientY ?? this.dragStartClientY;
      const moveDist = Math.hypot(endX - this.dragStartClientX, endY - this.dragStartClientY);

      if (this.mergeCandidate) {
        const targetOrb = this.mergeCandidate;
        this.mergeCandidate = null;

        const mergedNote = mergeBubbleNotes(targetOrb.note, orb.note);
        soundFx.playMerge();

        targetOrb.note = mergedNote;
        const pxRadius = calculateDynamicBubbleRadius(
          mergedNote.importance,
          mergedNote.title,
          mergedNote.fullNote
        );
        targetOrb.targetWorldRadius = this.pixelToWorldRadius(pxRadius);
        targetOrb.squishScale.set(1.18, 0.85, 1.12);

        this.disposeOrbEntity(orb);
        this.orbs = this.orbs.filter((o) => o !== orb);
        this.onBubbleMergeCb?.(mergedNote, orb.note.id);
      } else if (moveDist < 8) {
        // Click / Tap -> Open Note Modal
        orb.velocity.multiplyScalar(0.15);
        soundFx.playPop(1.1);
        this.onBubbleClickCb?.(orb.note);
      } else {
        // Clamp release velocity strictly to slow lava-lamp calm speed
        orb.velocity.clampLength(0, 0.45);

        // Check Today Goal Zone drop at bottom of tank
        const rect = this.renderer.domElement.getBoundingClientRect();
        const isDroppedInTodayZone = endY - rect.top > rect.height - 150;
        if (isDroppedInTodayZone && !orb.note.isToday) {
          orb.note.isToday = true;
          orb.todayRing.visible = true;
          soundFx.playTodayDock();
          this.onBubbleMoveToTodayCb?.(orb.note.id, true);
        } else if (!isDroppedInTodayZone && orb.note.isToday) {
          orb.note.isToday = false;
          orb.todayRing.visible = false;
          soundFx.playPop(0.85);
          this.onBubbleMoveToTodayCb?.(orb.note.id, false);
        }
      }
    }

    this.mergeCandidate = null;
    this.blockedMergeCandidate = null;
    this.isPointerDown = false;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.scheduleNextTick();
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
  }

  public dispose() {
    this.stop();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.orbs.forEach((o) => this.disposeOrbEntity(o));
    this.orbs = [];

    this.outerSphereGeo.dispose();
    this.innerCoreGeo.dispose();
    this.collarTorusGeo.dispose();
    this.crownLatheGeo.dispose();
    this.todayRingGeo.dispose();
    this.videoRingGeo.dispose();
    this.hitSphereGeo.dispose();
    this.shadowTexture.dispose();
    this.auroraTextures.forEach((t) => t.dispose());
    this.auroraTextures.clear();

    this.ambientPearlsMesh.geometry.dispose();
    (this.ambientPearlsMesh.material as THREE.Material).dispose();
    this.burstPearlsMesh.geometry.dispose();
    (this.burstPearlsMesh.material as THREE.Material).dispose();
    this.mergeBridgeMesh.geometry.dispose();
    this.mergeBridgeMat.dispose();
    this.mergeTargetRing.geometry.dispose();
    (this.mergeTargetRing.material as THREE.Material).dispose();

    this.envRT?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.mountEl) {
      this.mountEl.removeChild(this.renderer.domElement);
    }
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
    this.onContextLostCb?.(true);
  };

  private handleContextRestored = () => {
    this.onContextLostCb?.(false);
    this.start();
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (!this.isRunning) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextTick() {
    if (!this.isRunning) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = () => {
    if (!this.isRunning) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.elapsed += dt;

    this.updatePhysics(dt);
    this.renderScene();
    this.scheduleNextTick();
  };

  private steerAngleToward(current: number, target: number, maxStep: number): number {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
  }

  private updatePhysics(dt: number) {
    // 1. Smoothly damp camera parallax & gentle zoom
    this.cameraCurrentPos.x = THREE.MathUtils.damp(
      this.cameraCurrentPos.x,
      this.parallaxTargetX,
      3.5,
      dt
    );
    this.cameraCurrentPos.y = THREE.MathUtils.damp(
      this.cameraCurrentPos.y,
      this.parallaxTargetY,
      3.5,
      dt
    );
    this.cameraCurrentPos.z = THREE.MathUtils.damp(
      this.cameraCurrentPos.z,
      this.targetCameraZ,
      4.2,
      dt
    );
    this.camera.position.copy(this.cameraCurrentPos);
    this.camera.lookAt(this.cameraLookTarget);

    // 2. Barely-perceptible liquid glow breath inside orb cores
    this.auroraTextures.forEach((tex) => {
      tex.offset.x = (tex.offset.x + dt * 0.002) % 1;
      tex.offset.y = (tex.offset.y + dt * 0.001) % 1;
    });

    // Update shader clocks
    for (let i = 0; i < this.orbs.length; i++) {
      this.orbs[i].shaderUniforms.uTime.value = this.elapsed + i * 1.3;
    }

    // Gentle plinth glow breath
    if (this.plinthEmitterMat) {
      this.plinthEmitterMat.emissiveIntensity = 1.2 + Math.sin(this.elapsed * 0.65) * 0.22;
    }

    // 3. Update instanced suspended dust motes (barely breathing so bubbles are the clear slow-moving focus)
    for (let i = 0; i < this.ambientPearls.length; i++) {
      const p = this.ambientPearls[i];
      p.y += p.speed * dt;
      if (p.y > this.worldHalfH + 1.0) {
        p.y = -this.worldHalfH - 1.0;
        p.x = (Math.random() - 0.5) * this.worldHalfW * 2;
      }
      const swayX = Math.sin(this.elapsed * 0.08 + p.phase) * 0.06;
      _dummyObj.position.set(p.x + swayX, p.y, p.z);
      _dummyObj.scale.setScalar(p.scale);
      _dummyObj.updateMatrix();
      this.ambientPearlsMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    this.ambientPearlsMesh.instanceMatrix.needsUpdate = true;

    // 4. Update completion burst pearls
    if (this.burstPearls.length > 0) {
      for (let i = this.burstPearls.length - 1; i >= 0; i--) {
        const bp = this.burstPearls[i];
        bp.life += dt;
        if (bp.life >= bp.maxLife) {
          this.burstPearls.splice(i, 1);
          continue;
        }
        bp.position.addScaledVector(bp.velocity, dt);
        bp.velocity.multiplyScalar(Math.exp(-2.8 * dt));
        bp.velocity.y += 0.25 * dt;
      }
      this.burstPearlsMesh.count = this.burstPearls.length;
      for (let i = 0; i < this.burstPearls.length; i++) {
        const bp = this.burstPearls[i];
        const fade = Math.max(0.01, 1 - bp.life / bp.maxLife);
        _dummyObj.position.copy(bp.position);
        _dummyObj.scale.setScalar(bp.scale * fade);
        _dummyObj.updateMatrix();
        this.burstPearlsMesh.setMatrixAt(i, _dummyObj.matrix);
        this.burstPearlsMesh.setColorAt(i, bp.color);
      }
      this.burstPearlsMesh.instanceMatrix.needsUpdate = true;
      if (this.burstPearlsMesh.instanceColor) {
        this.burstPearlsMesh.instanceColor.needsUpdate = true;
      }
    } else {
      this.burstPearlsMesh.count = 0;
    }

    // 5. Update Lava-Lamp Orbs with genuine, steady, very slow roaming across the tank
    const todayTargetY = -this.worldHalfH * 0.55;

    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];

      // Smooth birth & dynamic radius scaling
      orb.spawnScale = THREE.MathUtils.damp(orb.spawnScale, 1, 3.2, dt);
      orb.currentWorldRadius = THREE.MathUtils.damp(
        orb.currentWorldRadius,
        orb.targetWorldRadius,
        3.5,
        dt
      );

      // Slow organic squish spring relaxation
      const springK = 38;
      const springDamp = 6.2;
      orb.squishVel.x += ((1 - orb.squishScale.x) * springK - orb.squishVel.x * springDamp) * dt;
      orb.squishVel.y += ((1 - orb.squishScale.y) * springK - orb.squishVel.y * springDamp) * dt;
      orb.squishVel.z += ((1 - orb.squishScale.z) * springK - orb.squishVel.z * springDamp) * dt;

      orb.squishScale.x = THREE.MathUtils.clamp(orb.squishScale.x + orb.squishVel.x * dt, 0.78, 1.24);
      orb.squishScale.y = THREE.MathUtils.clamp(orb.squishScale.y + orb.squishVel.y * dt, 0.78, 1.24);
      orb.squishScale.z = THREE.MathUtils.clamp(orb.squishScale.z + orb.squishVel.z * dt, 0.78, 1.24);

      const finalRadius = orb.currentWorldRadius * orb.spawnScale;
      orb.group.scale.set(
        finalRadius * orb.squishScale.x,
        finalRadius * orb.squishScale.y,
        finalRadius * orb.squishScale.z
      );

      // Slow ambient rotation of inner core & meniscus collar
      orb.innerCore.rotation.y += dt * 0.06;
      orb.innerCore.rotation.x += dt * 0.025;
      orb.equatorCollar.rotation.y += dt * 0.045;
      orb.equatorCollar.rotation.z = Math.sin(this.elapsed * 0.14 + orb.swirlPhase) * 0.35;
      if (orb.todayRing.visible) {
        orb.todayRing.rotation.z += dt * 0.10;
      }
      if (orb.videoRing.visible) {
        orb.videoRing.rotation.y -= dt * 0.08;
      }

      // Filter & deadline gentle luminance
      const isFilteredOut =
        this.activeCategoryFilter !== null && orb.note.category !== this.activeCategoryFilter;
      orb.opacity = THREE.MathUtils.damp(orb.opacity, isFilteredOut ? 0.20 : 1.0, 5.0, dt);
      orb.outerMaterial.opacity = 0.44 * orb.opacity;
      const deadlineInfo = getDeadlineInfo(orb.note.deadline);
      const urgencyGlow =
        deadlineInfo.urgencyLevel >= 3
          ? 0.85 + Math.sin(this.elapsed * 1.4 + orb.thermalPhase) * 0.18
          : 0.62;
      orb.coreMaterial.emissiveIntensity = urgencyGlow * orb.opacity;

      if (!orb.isDragging) {
        const boundX = Math.max(1.5, this.worldHalfW - finalRadius - 0.45);
        const boundTop = Math.max(1.0, this.worldHalfH - finalRadius - 0.6);
        const boundBottom = -this.worldHalfH + finalRadius + 0.55;

        // Smooth continuous curved wandering across the entire screen
        const turnRate =
          Math.sin(this.elapsed * 0.17 + orb.thermalPhase) * 0.22 +
          Math.cos(this.elapsed * 0.09 + orb.swirlPhase) * 0.14;
        orb.wanderAngle += turnRate * dt;

        // Soft predictive boundary turn-away so orbs curve gracefully around the tank
        const margin = 1.4;
        if (orb.position.x > boundX - margin) {
          orb.wanderAngle = this.steerAngleToward(orb.wanderAngle, Math.PI, dt * 1.1);
        } else if (orb.position.x < -boundX + margin) {
          orb.wanderAngle = this.steerAngleToward(orb.wanderAngle, 0, dt * 1.1);
        }
        if (orb.position.y > boundTop - margin * 0.8) {
          orb.wanderAngle = this.steerAngleToward(orb.wanderAngle, -Math.PI * 0.5, dt * 1.1);
        } else if (orb.position.y < boundBottom + margin * 0.8) {
          orb.wanderAngle = this.steerAngleToward(orb.wanderAngle, Math.PI * 0.5, dt * 1.1);
        }

        // Compute steady, very slow target cruise velocity scaled by user drift speed preset
        const thermalBreath = 0.85 + 0.25 * Math.sin(this.elapsed * orb.thermalFreq + orb.thermalPhase);
        const speed = orb.cruiseSpeed * thermalBreath * this.driftSpeedMultiplier;
        let desiredVx = Math.cos(orb.wanderAngle) * speed;
        let desiredVy = Math.sin(orb.wanderAngle) * speed * 0.82;
        const desiredVz = Math.sin(this.elapsed * 0.11 + orb.thermalPhase) * 0.04 - orb.position.z * 0.08;

        if (orb.note.isToday) {
          // Today orbs roam freely horizontally along the lower thermal band with gentle vertical bobbing
          const bandOffset = (todayTargetY - orb.position.y) * 0.32;
          desiredVy = desiredVy * 0.35 + bandOffset;
        } else {
          // Keep normal orbs peacefully above the plinth zone while roaming the whole screen
          const minNormalY = -this.worldHalfH + finalRadius + 1.55;
          if (orb.position.y < minNormalY) {
            desiredVy = Math.max(desiredVy, (minNormalY - orb.position.y) * 0.45);
            orb.wanderAngle = this.steerAngleToward(orb.wanderAngle, Math.PI * 0.5, dt * 0.9);
          }
        }

        // Smooth viscous velocity blending (maintains steady slow glide without freezing or jitter)
        const blend = 1 - Math.exp(-1.8 * dt);
        orb.velocity.x += (desiredVx - orb.velocity.x) * blend;
        orb.velocity.y += (desiredVy - orb.velocity.y) * blend;
        orb.velocity.z += (desiredVz - orb.velocity.z) * blend;
        orb.velocity.clampLength(0, 0.48);

        orb.position.addScaledVector(orb.velocity, dt);

        // Hard safety containment inside screen bounds
        if (orb.position.x < -boundX) {
          orb.position.x = -boundX;
          orb.velocity.x = Math.abs(orb.velocity.x) * 0.6;
          orb.wanderAngle = 0;
        } else if (orb.position.x > boundX) {
          orb.position.x = boundX;
          orb.velocity.x = -Math.abs(orb.velocity.x) * 0.6;
          orb.wanderAngle = Math.PI;
        }

        if (orb.position.y > boundTop) {
          orb.position.y = boundTop;
          orb.velocity.y = -Math.abs(orb.velocity.y) * 0.6;
          orb.wanderAngle = -Math.PI * 0.5;
        } else if (orb.position.y < boundBottom) {
          orb.position.y = boundBottom;
          orb.velocity.y = Math.abs(orb.velocity.y) * 0.6;
          orb.wanderAngle = Math.PI * 0.5;
        }

        orb.position.z = THREE.MathUtils.clamp(orb.position.z, -1.8, 1.6);
      }
    }

    // 6. Soft Orb-to-Orb Collision & Magnetic Merge Pull
    for (let i = 0; i < this.orbs.length; i++) {
      for (let j = i + 1; j < this.orbs.length; j++) {
        const b1 = this.orbs[i];
        const b2 = this.orbs[j];

        _vecA.copy(b2.position).sub(b1.position);
        const dist = _vecA.length();
        const minDist = (b1.currentWorldRadius + b2.currentWorldRadius) * 1.04;

        if (dist < minDist && dist > 0.0001) {
          const isMergePair =
            this.draggedOrb &&
            this.mergeCandidate &&
            ((b1 === this.draggedOrb && b2 === this.mergeCandidate) ||
              (b2 === this.draggedOrb && b1 === this.mergeCandidate));

          if (isMergePair) {
            const target = b1 === this.draggedOrb ? b2 : b1;
            const dragged = b1 === this.draggedOrb ? b1 : b2;
            target.velocity.x += (dragged.position.x - target.position.x) * 1.2 * dt;
            target.velocity.y += (dragged.position.y - target.position.y) * 1.2 * dt;
            continue;
          }

          const overlap = minDist - dist;
          _vecA.divideScalar(dist); // normal
          const totalMass = b1.mass + b2.mass;
          const r1 = b2.mass / totalMass;
          const r2 = b1.mass / totalMass;

          if (!b1.isDragging) {
            b1.position.addScaledVector(_vecA, -overlap * r1 * 0.35);
          }
          if (!b2.isDragging) {
            b2.position.addScaledVector(_vecA, overlap * r2 * 0.35);
          }

          // Gentle momentum nudge
          _vecB.copy(b1.velocity).sub(b2.velocity);
          const relDot = _vecB.dot(_vecA);
          if (relDot > 0) {
            const impulse = (1.15 * relDot) / totalMass;
            if (!b1.isDragging) {
              b1.velocity.addScaledVector(_vecA, -impulse * b2.mass * 0.35);
              const awayAngle1 = Math.atan2(-_vecA.y, -_vecA.x);
              b1.wanderAngle = this.steerAngleToward(b1.wanderAngle, awayAngle1, dt * 1.4);
            }
            if (!b2.isDragging) {
              b2.velocity.addScaledVector(_vecA, impulse * b1.mass * 0.35);
              const awayAngle2 = Math.atan2(_vecA.y, _vecA.x);
              b2.wanderAngle = this.steerAngleToward(b2.wanderAngle, awayAngle2, dt * 1.4);
            }
          }

          // Throttled CSS + 3D squish on collision
          const now = performance.now();
          const key = b1.note.id < b2.note.id ? `${b1.note.id}:${b2.note.id}` : `${b2.note.id}:${b1.note.id}`;
          const lastHit = this.lastCollisionTimes.get(key) || 0;
          if (now - lastHit > 520 && overlap > 0.03) {
            this.lastCollisionTimes.set(key, now);

            if (Math.abs(_vecA.x) > Math.abs(_vecA.y)) {
              b1.squishScale.set(0.90, 1.10, 1.02);
              b2.squishScale.set(0.90, 1.10, 1.02);
            } else {
              b1.squishScale.set(1.10, 0.90, 1.02);
              b2.squishScale.set(1.10, 0.90, 1.02);
            }
            this.onBubbleCollideCb?.(b1.note.id, b2.note.id);
          }
        }
      }
    }

    // 7. Update 3D merge bridge visual
    if (this.draggedOrb && this.mergeCandidate) {
      const a = this.draggedOrb.position;
      const b = this.mergeCandidate.position;
      const dist = a.distanceTo(b);
      this.mergeBridgeMesh.visible = true;
      this.mergeBridgeMesh.position.copy(a).add(b).multiplyScalar(0.5);
      this.mergeBridgeMesh.lookAt(b);
      this.mergeBridgeMesh.scale.set(1, 1, Math.max(0.1, dist));
      this.mergeBridgeMat.opacity = 0.45 + Math.sin(this.elapsed * 5) * 0.15;

      this.mergeTargetRing.visible = true;
      this.mergeTargetRing.position.copy(b);
      this.mergeTargetRing.scale.setScalar(
        this.mergeCandidate.currentWorldRadius * (1 + Math.sin(this.elapsed * 5) * 0.05)
      );
      this.mergeTargetRing.lookAt(this.camera.position);
    } else {
      this.mergeBridgeMesh.visible = false;
      this.mergeTargetRing.visible = false;
    }
  }

  private renderScene() {
    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (!this.onFrameSyncCb) return;

    // Project 3D orb centers and radii to crisp 2D DOM coordinates
    _camRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);

    const snapshots: OrbScreenSnapshot[] = [];
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      _projVec.copy(orb.position).project(this.camera);

      const screenX = ((_projVec.x + 1) * 0.5) * this.width;
      const screenY = ((-_projVec.y + 1) * 0.5) * this.height;

      _edgeVec.copy(orb.position).addScaledVector(_camRight, orb.currentWorldRadius * orb.spawnScale);
      _edgeVec.project(this.camera);
      const edgeScreenX = ((_edgeVec.x + 1) * 0.5) * this.width;
      const screenRadius = Math.max(18, Math.abs(edgeScreenX - screenX));

      const isFiltered =
        this.activeCategoryFilter !== null && orb.note.category !== this.activeCategoryFilter;

      snapshots.push({
        id: orb.note.id,
        screenX,
        screenY,
        screenRadius,
        opacity: orb.opacity,
        isFiltered,
        isHovered: this.hoveredOrbId === orb.note.id,
        isDragging: orb.isDragging,
        zOrder: Math.round((1 - _projVec.z) * 1000),
      });
    }

    let mergePreview: MergePreviewState | null = null;
    if (this.draggedOrb && this.mergeCandidate) {
      _vecC.copy(this.draggedOrb.position).add(this.mergeCandidate.position).multiplyScalar(0.5);
      _vecC.project(this.camera);
      mergePreview = {
        active: true,
        blocked: false,
        x: ((_vecC.x + 1) * 0.5) * this.width,
        y: ((-_vecC.y + 1) * 0.5) * this.height - 64,
        combinedLevel: Math.min(5, this.draggedOrb.note.importance + this.mergeCandidate.note.importance),
      };
    } else if (this.draggedOrb && this.blockedMergeCandidate) {
      _vecC.copy(this.draggedOrb.position).add(this.blockedMergeCandidate.position).multiplyScalar(0.5);
      _vecC.project(this.camera);
      mergePreview = {
        active: true,
        blocked: true,
        x: ((_vecC.x + 1) * 0.5) * this.width,
        y: ((-_vecC.y + 1) * 0.5) * this.height - 64,
        combinedLevel: this.draggedOrb.note.importance,
      };
    }

    this.onFrameSyncCb(snapshots, mergePreview);
  }
}
