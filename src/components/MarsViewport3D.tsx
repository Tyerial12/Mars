import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILDINGS } from '../data/buildings';
import {
  AnimatedPart,
  createBuildingMeshGroup,
  createOrbitalCargoRocket,
} from '../three/MarsModels';
import {
  BuildingType,
  CameraPreset,
  RocketEvent,
  TileData,
  WeatherState,
} from '../types/game';

interface MarsViewport3DProps {
  grid: TileData[][];
  selectedTile: { x: number; z: number } | null;
  selectedBlueprint: BuildingType | null;
  cameraPreset: CameraPreset;
  rotateTrigger: number;
  weather: WeatherState;
  terraformingIndex: number;
  rocketEvents: RocketEvent[];
  isTitleScreen: boolean;
  onSelectTile: (x: number, z: number) => void;
}

const GRID_SIZE = 10;
const TILE_SPACING = 2.05;

// Reusable module-scope math objects (Zero GC in render loop)
const _targetCameraPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _clearSkyColor = new THREE.Color('#190D0A');
const _stormSkyColor = new THREE.Color('#5E2513');
const _terraSkyColor = new THREE.Color('#0E2233');
const _currentSkyColor = new THREE.Color('#190D0A');

export const MarsViewport3D: React.FC<MarsViewport3DProps> = ({
  grid,
  selectedTile,
  selectedBlueprint,
  cameraPreset,
  rotateTrigger,
  weather,
  terraformingIndex,
  rocketEvents,
  isTitleScreen,
  onSelectTile,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so React state updates never recreate the WebGL canvas
  const propsRef = useRef({
    grid,
    selectedTile,
    selectedBlueprint,
    weather,
    terraformingIndex,
    isTitleScreen,
    onSelectTile,
  });
  propsRef.current = {
    grid,
    selectedTile,
    selectedBlueprint,
    weather,
    terraformingIndex,
    isTitleScreen,
    onSelectTile,
  };

  const sceneObjectsRef = useRef<{
    tileMeshes: Map<string, THREE.Mesh>;
    validRingMeshes: Map<string, THREE.Mesh>;
    buildingGroups: Map<string, { signature: string; group: THREE.Group; spawnScale: number }>;
    buildingsRoot: THREE.Group | null;
    selectionRing: THREE.Mesh | null;
    hoverRing: THREE.Mesh | null;
    rocketsGroup: THREE.Group | null;
    activeRockets: Map<string, { mesh: THREE.Group; startTime: number; baseX: number; baseZ: number; type: 'EXPORT' | 'SUPPLY_DROP' }>;
    cameraTransitionActive: boolean;
    orbitAngleOffset: number;
    isSoftwareGl: boolean;
    maxAnisotropy: number;
  }>({
    tileMeshes: new Map(),
    validRingMeshes: new Map(),
    buildingGroups: new Map(),
    buildingsRoot: null,
    selectionRing: null,
    hoverRing: null,
    rocketsGroup: null,
    activeRockets: new Map(),
    cameraTransitionActive: false,
    orbitAngleOffset: Math.PI / 4,
    isSoftwareGl: false,
    maxAnisotropy: 1,
  });

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();
    sceneObjectsRef.current.isSoftwareGl = isSoftwareGl;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    sceneObjectsRef.current.maxAnisotropy = maxAnisotropy;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#190D0A');
    const fog = new THREE.FogExp2('#190D0A', 0.016);
    scene.fog = fog;

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 160);
    camera.position.set(17.5, 16.5, 17.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.minPolarAngle = 0.18;
    controls.minDistance = 8;
    controls.maxDistance = 38;
    controls.target.set(0, 0.4, 0);

    // Cancel scripted camera transition when user interacts manually
    controls.addEventListener('start', () => {
      sceneObjectsRef.current.cameraTransitionActive = false;
    });

    // 4. Balanced 3-Point Martian Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#FFD8B8', '#3B1910', 0.85);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#FFF0DB', 2.2);
    sunLight.position.set(18, 26, 14);
    sunLight.castShadow = !isSoftwareGl;
    const d = 14;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#38BDF8', 0.55);
    rimLight.position.set(-16, 12, -16);
    scene.add(rimLight);

    // 5. Natural Outdoor Martian Crater Perimeter & Floor (Never an indoor box)
    const groundGeo = new THREE.CircleGeometry(65, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#451D12',
      roughness: 0.92,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.15;
    groundMesh.receiveShadow = !isSoftwareGl;
    scene.add(groundMesh);

    // Outer Crater Rim Cliffs & Boulders using InstancedMesh
    const cliffCount = 36;
    const cliffGeo = new THREE.DodecahedronGeometry(2.4, 1);
    const cliffMat = new THREE.MeshStandardMaterial({
      color: '#5C2616',
      roughness: 0.88,
      metalness: 0.08,
    });
    const cliffInstanced = new THREE.InstancedMesh(cliffGeo, cliffMat, cliffCount);
    cliffInstanced.castShadow = !isSoftwareGl;
    cliffInstanced.receiveShadow = !isSoftwareGl;
    const dummy = new THREE.Object3D();
    const colorVar = new THREE.Color();
    for (let i = 0; i < cliffCount; i++) {
      const angle = (i / cliffCount) * Math.PI * 2;
      const radius = 16.5 + (i % 3) * 2.2;
      dummy.position.set(
        Math.cos(angle) * radius,
        0.5 + (i % 4) * 0.35,
        Math.sin(angle) * radius
      );
      dummy.rotation.set(i * 0.4, angle, (i % 3) * 0.3);
      const sx = 1.1 + (i % 5) * 0.25;
      const sy = 0.7 + (i % 3) * 0.4;
      const sz = 1.1 + ((i + 2) % 4) * 0.25;
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      cliffInstanced.setMatrixAt(i, dummy.matrix);
      colorVar.set('#5C2616').offsetHSL(0, 0, ((i % 5) - 2) * 0.025);
      cliffInstanced.setColorAt(i, colorVar);
    }
    cliffInstanced.instanceMatrix.needsUpdate = true;
    if (cliffInstanced.instanceColor) cliffInstanced.instanceColor.needsUpdate = true;
    cliffInstanced.computeBoundingSphere();
    scene.add(cliffInstanced);

    // 6. Interactive 3D Crater Grid Tiles (10x10)
    const tilesGroup = new THREE.Group();
    scene.add(tilesGroup);

    const buildingsRoot = new THREE.Group();
    scene.add(buildingsRoot);
    sceneObjectsRef.current.buildingsRoot = buildingsRoot;

    const rocketsGroup = new THREE.Group();
    scene.add(rocketsGroup);
    sceneObjectsRef.current.rocketsGroup = rocketsGroup;

    // Selection & Hover Ring Indicators (polygonOffset enabled to prevent Z-fighting)
    const selRingGeo = new THREE.RingGeometry(0.76, 0.92, 8);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.rotation.z = Math.PI / 8;
    selectionRing.visible = false;
    scene.add(selectionRing);
    sceneObjectsRef.current.selectionRing = selectionRing;

    const hoverRingGeo = new THREE.RingGeometry(0.78, 0.88, 8);
    const hoverRingMat = new THREE.MeshBasicMaterial({
      color: '#F8FAFC',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const hoverRing = new THREE.Mesh(hoverRingGeo, hoverRingMat);
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.rotation.z = Math.PI / 8;
    hoverRing.visible = false;
    scene.add(hoverRing);
    sceneObjectsRef.current.hoverRing = hoverRing;

    // 7. Volumetric 3D Martian Dust Storm Particle System
    const dustCount = isSoftwareGl ? 220 : 650;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 34;
      dustPositions[i * 3 + 1] = Math.random() * 8 + 0.2;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: '#E07A48',
      size: 0.22,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // Raycasting setup (restricted to Layer 1 for high performance)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverRaycast = 0;

    const getTileWorldPos = (gx: number, gz: number, elevation: number) => {
      const wx = (gx - (GRID_SIZE - 1) / 2) * TILE_SPACING;
      const wz = (gz - (GRID_SIZE - 1) / 2) * TILE_SPACING;
      const wy = elevation * 0.28 + 0.2;
      return { wx, wy, wz };
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) return; // Was a camera drag/orbit, not a tile tap

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const intersects = raycaster.intersectObjects(tilesGroup.children, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (typeof hit.userData.gridX === 'number' && typeof hit.userData.gridZ === 'number') {
          propsRef.current.onSelectTile(hit.userData.gridX, hit.userData.gridZ);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverRaycast < 45) return;
      lastHoverRaycast = now;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const intersects = raycaster.intersectObjects(tilesGroup.children, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const gx = hit.userData.gridX;
        const gz = hit.userData.gridZ;
        const tile = propsRef.current.grid[gz]?.[gx];
        if (tile) {
          const { wx, wy, wz } = getTileWorldPos(gx, gz, tile.elevation);
          hoverRing.position.set(wx, wy + 0.03, wz);
          hoverRing.visible = true;
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
      hoverRing.visible = false;
      renderer.domElement.style.cursor = 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // Build initial 10x10 3D Tile Meshes
    const tileGeo = new THREE.CylinderGeometry(0.92, 0.98, 0.4, 8);
    const validRingGeo = new THREE.RingGeometry(0.68, 0.82, 8);

    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const key = `${x},${z}`;
        const mat = new THREE.MeshStandardMaterial({
          color: '#8C3B24',
          roughness: 0.82,
          metalness: 0.12,
        });
        const mesh = new THREE.Mesh(tileGeo, mat);
        mesh.rotation.y = Math.PI / 8;
        mesh.castShadow = !isSoftwareGl;
        mesh.receiveShadow = !isSoftwareGl;
        mesh.layers.enable(1); // Enable Layer 1 for raycasting
        mesh.userData = { gridX: x, gridZ: z };
        tilesGroup.add(mesh);
        sceneObjectsRef.current.tileMeshes.set(key, mesh);

        // Valid Blueprint Placement Ring
        const vRingMat = new THREE.MeshBasicMaterial({
          color: '#10B981',
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const vRing = new THREE.Mesh(validRingGeo, vRingMat);
        vRing.rotation.x = -Math.PI / 2;
        vRing.rotation.z = Math.PI / 8;
        vRing.visible = false;
        scene.add(vRing);
        sceneObjectsRef.current.validRingMeshes.set(key, vRing);
      }
    }

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 8. Continuous Simulation & Render Loop with Software-WebGL afterDraw Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      const { weather: curWeather, terraformingIndex: curTerra, isTitleScreen: titleMode } =
        propsRef.current;

      // Title screen slow camera orbit
      if (titleMode) {
        const angle = elapsed * 0.14;
        camera.position.set(Math.cos(angle) * 20, 14.5, Math.sin(angle) * 20);
        controls.target.set(0, 0.5, 0);
      } else if (sceneObjectsRef.current.cameraTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCameraPos.x, 5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCameraPos.y, 5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCameraPos.z, 5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLookAt.x, 6, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLookAt.y, 6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLookAt.z, 6, dt);

        if (camera.position.distanceToSquared(_targetCameraPos) < 0.05) {
          sceneObjectsRef.current.cameraTransitionActive = false;
        }
      }

      controls.update();

      // Animate 3D Building Sub-Parts & Spawn Bounce
      sceneObjectsRef.current.buildingGroups.forEach((entry) => {
        if (entry.spawnScale < 1) {
          entry.spawnScale = Math.min(1, entry.spawnScale + dt * 4.5);
          const baseLevelScale = 1 + ((entry.group.userData.level || 1) - 1) * 0.12;
          const s = baseLevelScale * entry.spawnScale;
          entry.group.scale.set(s, s, s);
        }

        const animParts = entry.group.userData.animParts as AnimatedPart[] | undefined;
        if (animParts) {
          for (let i = 0; i < animParts.length; i++) {
            const p = animParts[i];
            if (p.type === 'ROTATE_Y') {
              p.object.rotation.y += dt * p.speed;
            } else if (p.type === 'ROTATE_Z') {
              p.object.rotation.z += dt * p.speed;
            } else if (p.type === 'BOB_Y' && p.baseY !== undefined && p.amplitude !== undefined) {
              p.object.position.y = p.baseY + Math.sin(elapsed * p.speed) * p.amplitude;
            } else if (p.type === 'SOLAR_TILT') {
              p.object.rotation.y = Math.sin(elapsed * p.speed) * 0.28;
            } else if (p.type === 'PULSE_SCALE') {
              const s = 1 + Math.sin(elapsed * p.speed) * 0.06;
              p.object.scale.set(s, 1, s);
            }
          }
        }
      });

      // Animate Active 3D Orbital Cargo Rockets
      sceneObjectsRef.current.activeRockets.forEach((rEntry, id) => {
        const age = (performance.now() - rEntry.startTime) / 1000;
        if (age > 4.0) {
          rocketsGroup.remove(rEntry.mesh);
          sceneObjectsRef.current.activeRockets.delete(id);
        } else {
          if (rEntry.type === 'EXPORT') {
            // Ascends to orbit
            const y = 0.6 + Math.pow(age * 1.4, 2.2) * 3.5;
            rEntry.mesh.position.set(rEntry.baseX, y, rEntry.baseZ);
          } else {
            // Descends from orbit then hovers briefly
            const t = Math.min(1, age / 2.5);
            const y = (1 - Math.pow(t, 0.5)) * 18 + 0.6;
            rEntry.mesh.position.set(rEntry.baseX, y, rEntry.baseZ);
          }
        }
      });

      // Update Volumetric 3D Dust Storm Particles & Atmospheric Fog
      const isStorm = curWeather.status === 'ACTIVE_STORM';
      const stormIntensity = isStorm ? curWeather.stormTier / 3 : 0;
      const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      const windSpeed = isStorm ? 8 + curWeather.stormTier * 6 : 1.5;

      for (let i = 0; i < dustCount; i++) {
        let px = posAttr.getX(i) + dt * windSpeed;
        let py = posAttr.getY(i) + Math.sin(elapsed + i) * dt * 0.3;
        if (px > 17) px = -17;
        if (py < 0.2) py = 7.5;
        posAttr.setXY(i, px, py);
      }
      posAttr.needsUpdate = true;

      dustMat.opacity = THREE.MathUtils.damp(
        dustMat.opacity,
        isStorm ? 0.32 + stormIntensity * 0.45 : 0.1,
        3,
        dt
      );
      dustMat.size = isStorm ? 0.32 : 0.18;

      // Sky & Fog color interpolation between Martian Ochre, Storm Rust, and Terraformed Azure
      _currentSkyColor.copy(_clearSkyColor).lerp(_terraSkyColor, (curTerra / 100) * 0.65);
      if (isStorm) {
        _currentSkyColor.lerp(_stormSkyColor, 0.78);
      }
      (scene.background as THREE.Color).lerp(_currentSkyColor, dt * 3);
      fog.color.copy(scene.background as THREE.Color);
      fog.density = THREE.MathUtils.damp(
        fog.density,
        isStorm ? 0.028 + stormIntensity * 0.025 : 0.014,
        3,
        dt
      );

      sunLight.intensity = THREE.MathUtils.damp(
        sunLight.intensity,
        isStorm ? 0.85 : 2.2,
        3,
        dt
      );

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Synchronize 3D Terrain Tiles, Buildings, Selection Ring, and Valid Placement Highlights
  useEffect(() => {
    const {
      tileMeshes,
      validRingMeshes,
      buildingGroups,
      buildingsRoot,
      selectionRing,
      isSoftwareGl,
      maxAnisotropy,
    } = sceneObjectsRef.current;

    if (!buildingsRoot) return;

    const blueprintDef = selectedBlueprint ? BUILDINGS[selectedBlueprint] : null;
    const seenKeys = new Set<string>();

    for (let z = 0; z < grid.length; z++) {
      for (let x = 0; x < grid[z].length; x++) {
        const tile = grid[z][x];
        const key = `${x},${z}`;
        const wx = (x - (GRID_SIZE - 1) / 2) * TILE_SPACING;
        const wz = (z - (GRID_SIZE - 1) / 2) * TILE_SPACING;
        const tileHeight = 0.4 + tile.elevation * 0.28;
        const topY = tileHeight;

        const mesh = tileMeshes.get(key);
        if (mesh) {
          mesh.scale.y = tileHeight / 0.4;
          mesh.position.set(wx, tileHeight / 2, wz);

          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (tile.terrain === 'ICE_VEIN') {
            mat.color.set('#38BDF8');
            mat.roughness = 0.25;
            mat.metalness = 0.45;
          } else if (tile.terrain === 'ORE_DEPOSIT') {
            mat.color.set('#D97706');
            mat.roughness = 0.45;
            mat.metalness = 0.65;
          } else if (tile.terrain === 'CRATER_BASIN') {
            // Shifts toward liquid aquifer blue/green as terraforming rises
            const baseCol = new THREE.Color('#6E2E1B');
            if (terraformingIndex > 35) {
              baseCol.lerp(new THREE.Color('#0D9488'), Math.min(1, (terraformingIndex - 35) / 65) * 0.7);
            }
            mat.color.copy(baseCol);
            mat.roughness = 0.7;
          } else if (tile.terrain === 'RIDGE') {
            mat.color.set('#5C2616');
            mat.roughness = 0.85;
          } else {
            // Regolith shifts subtly toward mossy terracotta as Biosphere rises
            const regCol = new THREE.Color('#9A4429');
            if (terraformingIndex > 45) {
              regCol.lerp(new THREE.Color('#3F6212'), Math.min(1, (terraformingIndex - 45) / 55) * 0.45);
            }
            mat.color.copy(regCol);
            mat.roughness = 0.82;
          }
        }

        // Valid placement highlight ring
        const vRing = validRingMeshes.get(key);
        if (vRing) {
          const isValid =
            blueprintDef !== null &&
            tile.building === null &&
            blueprintDef.allowedTerrains.includes(tile.terrain);
          vRing.visible = isValid;
          if (isValid) {
            vRing.position.set(wx, topY + 0.025, wz);
          }
        }

        // Synchronize 3D Building Group on this tile
        if (tile.building) {
          seenKeys.add(key);
          const b = tile.building;
          const sig = `${b.id}_${b.type}_${b.level}_${b.powered}_${b.enabled}_${Math.floor(b.dustDamage / 20)}`;
          const existing = buildingGroups.get(key);

          if (!existing || existing.signature !== sig) {
            if (existing) {
              buildingsRoot.remove(existing.group);
            }
            const newGroup = createBuildingMeshGroup(b, isSoftwareGl, maxAnisotropy);
            newGroup.position.set(wx, topY, wz);
            newGroup.userData.level = b.level;
            const isNewSpawn = !existing;
            if (isNewSpawn) {
              newGroup.scale.set(0.01, 0.01, 0.01);
            }
            buildingsRoot.add(newGroup);
            buildingGroups.set(key, {
              signature: sig,
              group: newGroup,
              spawnScale: isNewSpawn ? 0.1 : 1,
            });
          } else {
            existing.group.position.set(wx, topY, wz);
          }
        }
      }
    }

    // Remove demolished buildings
    buildingGroups.forEach((val, key) => {
      if (!seenKeys.has(key)) {
        buildingsRoot.remove(val.group);
        buildingGroups.delete(key);
      }
    });

    // Update Selected Tile Ring
    if (selectionRing) {
      if (selectedTile) {
        const st = grid[selectedTile.z]?.[selectedTile.x];
        if (st) {
          const wx = (selectedTile.x - (GRID_SIZE - 1) / 2) * TILE_SPACING;
          const wz = (selectedTile.z - (GRID_SIZE - 1) / 2) * TILE_SPACING;
          const topY = 0.4 + st.elevation * 0.28;
          selectionRing.position.set(wx, topY + 0.035, wz);
          selectionRing.visible = true;
        }
      } else {
        selectionRing.visible = false;
      }
    }
  }, [grid, selectedTile, selectedBlueprint, terraformingIndex]);

  // Handle Camera Angle Presets & 90-degree Orbit Rotation smoothly
  useEffect(() => {
    const angle = sceneObjectsRef.current.orbitAngleOffset + (rotateTrigger * Math.PI) / 2;
    if (cameraPreset === 'ISOMETRIC') {
      _targetCameraPos.set(Math.cos(angle) * 23, 16.5, Math.sin(angle) * 23);
      _targetLookAt.set(0, 0.4, 0);
    } else if (cameraPreset === 'TOP_DOWN') {
      _targetCameraPos.set(Math.cos(angle) * 3, 27, Math.sin(angle) * 3);
      _targetLookAt.set(0, 0, 0);
    } else if (cameraPreset === 'SURFACE') {
      _targetCameraPos.set(Math.cos(angle) * 16, 6.2, Math.sin(angle) * 16);
      _targetLookAt.set(0, 1.2, 0);
    }
    sceneObjectsRef.current.cameraTransitionActive = true;
  }, [cameraPreset, rotateTrigger]);

  // Spawn 3D Orbital Cargo Rockets on Trade Fulfillment
  useEffect(() => {
    const { rocketsGroup, activeRockets } = sceneObjectsRef.current;
    if (!rocketsGroup) return;

    rocketEvents.forEach((ev) => {
      if (!activeRockets.has(ev.id)) {
        const rocketMesh = createOrbitalCargoRocket();
        const wx = (ev.tileX - (GRID_SIZE - 1) / 2) * TILE_SPACING;
        const wz = (ev.tileZ - (GRID_SIZE - 1) / 2) * TILE_SPACING;
        rocketMesh.position.set(wx, ev.type === 'EXPORT' ? 0.6 : 18, wz);
        rocketsGroup.add(rocketMesh);
        activeRockets.set(ev.id, {
          mesh: rocketMesh,
          startTime: performance.now(),
          baseX: wx,
          baseZ: wz,
          type: ev.type,
        });
      }
    });
  }, [rocketEvents]);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full overflow-hidden select-none"
      aria-label="Interactive 3D Martian Colony Viewport"
    />
  );
};
