import * as THREE from 'three';
import { BuildingInstance } from '../types/game';

export interface AnimatedPart {
  object: THREE.Object3D;
  type: 'ROTATE_Y' | 'ROTATE_Z' | 'BOB_Y' | 'SOLAR_TILT' | 'PULSE_SCALE';
  speed: number;
  baseY?: number;
  amplitude?: number;
}

// Create a reusable soft radial contact shadow texture in memory (Zero external 404s)
let cachedShadowTexture: THREE.CanvasTexture | null = null;
export function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTexture) return cachedShadowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 5, 3, 0.65)');
  grad.addColorStop(0.6, 'rgba(10, 5, 3, 0.28)');
  grad.addColorStop(1, 'rgba(10, 5, 3, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedShadowTexture = tex;
  return tex;
}

// Procedural solar cell grid texture
let cachedSolarTexture: THREE.CanvasTexture | null = null;
export function getSolarGridTexture(maxAnisotropy: number = 4): THREE.CanvasTexture {
  if (cachedSolarTexture) return cachedSolarTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0F294A';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 250);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  cachedSolarTexture = tex;
  return tex;
}

export function createBuildingMeshGroup(
  building: BuildingInstance,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();
  const animParts: AnimatedPart[] = [];

  // Shared materials with varied roughness/metalness per Three.js skill directive
  const dustFactor = Math.min(1, building.dustDamage / 100);
  const baseMetalColor = new THREE.Color('#D8E2EE').lerp(new THREE.Color('#9A5B3E'), dustFactor * 0.65);
  const darkStructColor = new THREE.Color('#273244').lerp(new THREE.Color('#6E3B26'), dustFactor * 0.5);

  const matHull = new THREE.MeshStandardMaterial({
    color: baseMetalColor,
    roughness: 0.35 + dustFactor * 0.4,
    metalness: 0.65,
  });

  const matDarkFrame = new THREE.MeshStandardMaterial({
    color: darkStructColor,
    roughness: 0.72,
    metalness: 0.4,
  });

  const matBrushedGold = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F59E0B'),
    roughness: 0.2,
    metalness: 0.9,
    clearcoat: isSoftwareGl ? 0 : 0.6,
  });

  const isOnline = building.powered && building.enabled;

  // 1. Contact Shadow Plane (Grounded at y = 0.015 to avoid coplanar Z-fighting)
  const shadowGeo = new THREE.PlaneGeometry(1.75, 1.75);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.015;
  group.add(shadowMesh);

  // 2. Octagonal Foundation Plinth (Primary base)
  const plinthGeo = new THREE.CylinderGeometry(0.72, 0.8, 0.12, 8);
  const plinthMesh = new THREE.Mesh(plinthGeo, matDarkFrame);
  plinthMesh.position.y = 0.06;
  plinthMesh.castShadow = !isSoftwareGl;
  plinthMesh.receiveShadow = !isSoftwareGl;
  group.add(plinthMesh);

  switch (building.type) {
    case 'SOLAR_ARRAY': {
      // Central Mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.55, 8), matHull);
      mast.position.y = 0.35;
      mast.castShadow = !isSoftwareGl;
      group.add(mast);

      // Rotating Yoke
      const yokeGroup = new THREE.Group();
      yokeGroup.position.y = 0.62;
      group.add(yokeGroup);

      const crossBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.08), matBrushedGold);
      yokeGroup.add(crossBar);

      const solarMat = new THREE.MeshStandardMaterial({
        map: getSolarGridTexture(maxAnisotropy),
        roughness: 0.18 + dustFactor * 0.5,
        metalness: 0.8,
      });

      // Left & Right Photovoltaic Wings + Center Panel
      [-0.46, 0.46].forEach((xOffset) => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.92), solarMat);
        wing.position.set(xOffset, 0.04, 0);
        wing.rotation.x = 0.35;
        wing.castShadow = !isSoftwareGl;
        yokeGroup.add(wing);
      });

      // Power junction box + status beacon
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.26), matHull);
      box.position.set(0, 0.2, 0.35);
      group.add(box);

      if (isOnline) {
        animParts.push({ object: yokeGroup, type: 'SOLAR_TILT', speed: 0.8 });
      }
      break;
    }

    case 'RTG_REACTOR': {
      // Heavy containment cylinder
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.85, 12), matHull);
      core.position.y = 0.52;
      core.castShadow = !isSoftwareGl;
      group.add(core);

      // Glowing Cherenkov / Thermal ring
      const glowMat = new THREE.MeshStandardMaterial({
        color: isOnline ? '#FB923C' : '#475569',
        emissive: isOnline ? new THREE.Color('#EA580C') : new THREE.Color('#000000'),
        emissiveIntensity: isOnline ? 1.8 : 0,
        roughness: 0.2,
      });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.16, 12), glowMat);
      ring.position.y = 0.55;
      group.add(ring);

      // Dome cap
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), matBrushedGold);
      cap.position.y = 0.94;
      group.add(cap);

      // 4 Radial Thermal Radiator Fins
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.62, 0.05), matDarkFrame);
        fin.position.set(Math.cos(angle) * 0.45, 0.48, Math.sin(angle) * 0.45);
        fin.rotation.y = -angle;
        fin.castShadow = !isSoftwareGl;
        group.add(fin);
      }

      if (isOnline) {
        animParts.push({ object: ring, type: 'PULSE_SCALE', speed: 2.5 });
      }
      break;
    }

    case 'BATTERY_HUB': {
      // 4 Superconducting Cryo Cells + Busbars
      const cellMat = new THREE.MeshStandardMaterial({
        color: '#1E293B',
        roughness: 0.25,
        metalness: 0.75,
      });
      const chargeMat = new THREE.MeshStandardMaterial({
        color: isOnline ? '#FBBF24' : '#475569',
        emissive: isOnline ? new THREE.Color('#F59E0B') : new THREE.Color('#000000'),
        emissiveIntensity: isOnline ? 1.3 : 0,
      });

      const offsets = [
        [-0.28, -0.28],
        [0.28, -0.28],
        [-0.28, 0.28],
        [0.28, 0.28],
      ];
      offsets.forEach(([ox, oz]) => {
        const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.68, 10), cellMat);
        cell.position.set(ox, 0.44, oz);
        cell.castShadow = !isSoftwareGl;
        group.add(cell);

        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 10), chargeMat);
        band.position.set(ox, 0.52, oz);
        group.add(band);
      });

      const busbar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.85), matHull);
      busbar.position.y = 0.8;
      group.add(busbar);
      break;
    }

    case 'WATER_EXTRACTOR': {
      // Tripod Derrick Frame + Reciprocating Bore Head + Water Tank
      const tankMat = new THREE.MeshStandardMaterial({
        color: '#38BDF8',
        roughness: 0.22,
        metalness: 0.5,
      });
      const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.58, 12), tankMat);
      waterTank.position.set(-0.32, 0.38, 0.22);
      waterTank.castShadow = !isSoftwareGl;
      group.add(waterTank);

      // Derrick legs
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.05, 6), matDarkFrame);
        leg.position.set(0.12 + Math.cos(a) * 0.26, 0.58, -0.1 + Math.sin(a) * 0.26);
        leg.rotation.z = -Math.cos(a) * 0.18;
        leg.rotation.x = Math.sin(a) * 0.18;
        group.add(leg);
      }

      // Top crown block
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.32), matBrushedGold);
      crown.position.set(0.12, 1.08, -0.1);
      group.add(crown);

      // Reciprocating Drill Assembly
      const drillAssembly = new THREE.Group();
      drillAssembly.position.set(0.12, 0.55, -0.1);
      const drillShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 0.75, 8), matHull);
      const drillCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 8), matBrushedGold);
      drillCollar.position.y = 0.12;
      drillAssembly.add(drillShaft, drillCollar);
      group.add(drillAssembly);

      if (isOnline) {
        animParts.push({
          object: drillAssembly,
          type: 'BOB_Y',
          speed: 3.6,
          baseY: 0.55,
          amplitude: 0.14,
        });
      }
      break;
    }

    case 'OXYGEN_PLANT': {
      // Twin Spherical O2 Pressure Tanks + Central Scrubber Tower + Spinning Turbine
      const o2Mat = new THREE.MeshStandardMaterial({
        color: '#0284C7',
        roughness: 0.2,
        metalness: 0.6,
      });

      [-0.32, 0.32].forEach((xPos) => {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), o2Mat);
        sphere.position.set(xPos, 0.42, 0.18);
        sphere.castShadow = !isSoftwareGl;
        group.add(sphere);
      });

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 10), matHull);
      tower.position.set(0, 0.54, -0.18);
      tower.castShadow = !isSoftwareGl;
      group.add(tower);

      // Cyan glowing O2 ionization band
      const ionBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.14, 10),
        new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          emissive: isOnline ? new THREE.Color('#0EA5E9') : new THREE.Color('#000000'),
          emissiveIntensity: isOnline ? 1.6 : 0,
        })
      );
      ionBand.position.set(0, 0.78, -0.18);
      group.add(ionBand);

      // Intake rotor on top
      const rotor = new THREE.Group();
      rotor.position.set(0, 1.02, -0.18);
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.08), matBrushedGold);
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.45), matBrushedGold);
      rotor.add(blade1, blade2);
      group.add(rotor);

      if (isOnline) {
        animParts.push({ object: rotor, type: 'ROTATE_Y', speed: 3.2 });
      }
      break;
    }

    case 'HAB_DOME': {
      // Pressurized Geodesic Hab Dome + Airlock Tunnel + Interior Warm Lights
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.22, 16), matHull);
      rim.position.y = 0.22;
      rim.castShadow = !isSoftwareGl;
      group.add(rim);

      const domeMat = new THREE.MeshPhysicalMaterial({
        color: '#E2E8F0',
        roughness: 0.15 + dustFactor * 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: 0.78,
        clearcoat: isSoftwareGl ? 0 : 0.8,
        depthWrite: false,
      });
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        domeMat
      );
      dome.position.y = 0.32;
      dome.renderOrder = 2;
      group.add(dome);

      // Interior Living Core (visible through dome)
      const coreMat = new THREE.MeshStandardMaterial({
        color: '#F8FAFC',
        emissive: isOnline ? new THREE.Color('#38BDF8') : new THREE.Color('#000000'),
        emissiveIntensity: isOnline ? 0.7 : 0,
      });
      const innerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.36, 8), coreMat);
      innerCore.position.y = 0.38;
      group.add(innerCore);

      // Airlock Entry Module
      const airlock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.36), matDarkFrame);
      airlock.position.set(0, 0.24, 0.62);
      group.add(airlock);
      break;
    }

    case 'BIODOME': {
      // Transparent Botanical Glass Dome + Lush Interior Trees & Canopy
      const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.18, 16), matHull);
      baseRing.position.y = 0.18;
      group.add(baseRing);

      // Soil bed inside
      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: '#14532D', roughness: 0.9 })
      );
      soil.position.y = 0.26;
      group.add(soil);

      // 3 Interior Martian Flora Clusters
      const foliageMat = new THREE.MeshStandardMaterial({
        color: '#10B981',
        emissive: isOnline ? new THREE.Color('#059669') : new THREE.Color('#000000'),
        emissiveIntensity: isOnline ? 0.35 : 0,
        roughness: 0.6,
      });
      const treePositions = [
        [0, 0.48, 0, 0.24],
        [-0.22, 0.4, 0.16, 0.16],
        [0.22, 0.42, -0.14, 0.18],
      ];
      treePositions.forEach(([tx, ty, tz, r]) => {
        const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(r), foliageMat);
        canopy.position.set(tx, ty, tz);
        group.add(canopy);
      });

      // Crystal Glass Geodesic Shell (depthWrite: false per Three.js skill)
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: '#A7F3D0',
        roughness: 0.1,
        metalness: 0.05,
        transparent: true,
        opacity: 0.46,
        clearcoat: isSoftwareGl ? 0 : 1.0,
        depthWrite: false,
      });
      const glassShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        glassMat
      );
      glassShell.position.y = 0.26;
      glassShell.renderOrder = 3;
      group.add(glassShell);
      break;
    }

    case 'ORE_DRILL': {
      // Heavy Industrial Excavator + Rotating Auger Wheel + Ore Hopper
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.45, 0.56), matBrushedGold);
      body.position.set(-0.08, 0.34, 0);
      body.castShadow = !isSoftwareGl;
      group.add(body);

      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.35, 6), matDarkFrame);
      hopper.position.set(-0.22, 0.68, 0);
      group.add(hopper);

      // Boom arm + rotating cutter head
      const boom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.16), matHull);
      boom.position.set(0.28, 0.36, 0);
      boom.rotation.z = -0.35;
      group.add(boom);

      const cutterWheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.06, 8, 12),
        matDarkFrame
      );
      cutterWheel.position.set(0.48, 0.26, 0);
      group.add(cutterWheel);

      if (isOnline) {
        animParts.push({ object: cutterWheel, type: 'ROTATE_Z', speed: 4.0 });
      }
      break;
    }

    case 'ATMO_PROCESSOR': {
      // Towering Terraforming Atmospheric Processor + Glowing Plasma Column + Rotating Rings
      const baseBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.64, 0.45, 8), matDarkFrame);
      baseBlock.position.y = 0.32;
      baseBlock.castShadow = !isSoftwareGl;
      group.add(baseBlock);

      const upperTower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.95, 8), matHull);
      upperTower.position.y = 0.95;
      upperTower.castShadow = !isSoftwareGl;
      group.add(upperTower);

      const emitterRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.05, 8, 16),
        new THREE.MeshStandardMaterial({
          color: '#06B6D4',
          emissive: isOnline ? new THREE.Color('#22D3EE') : new THREE.Color('#000000'),
          emissiveIntensity: isOnline ? 2.0 : 0,
        })
      );
      emitterRing.rotation.x = Math.PI / 2;
      emitterRing.position.y = 1.28;
      group.add(emitterRing);

      // Crown spire
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 8), matBrushedGold);
      spire.position.y = 1.58;
      group.add(spire);

      if (isOnline) {
        animParts.push({
          object: emitterRing,
          type: 'BOB_Y',
          speed: 2.2,
          baseY: 1.28,
          amplitude: 0.08,
        });
      }
      break;
    }

    case 'LAUNCHPAD': {
      // Blast Pad + Gantry Tower + Parked Reusable Cargo Lander
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.82, 0.16, 12), matDarkFrame);
      pad.position.y = 0.14;
      group.add(pad);

      // Landing target ring
      const targetRing = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.45, 16),
        new THREE.MeshBasicMaterial({ color: '#F59E0B', side: THREE.DoubleSide })
      );
      targetRing.rotation.x = -Math.PI / 2;
      targetRing.position.y = 0.23;
      group.add(targetRing);

      // Gantry umbilical tower
      const gantry = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), matBrushedGold);
      gantry.position.set(-0.48, 0.65, -0.25);
      gantry.castShadow = !isSoftwareGl;
      group.add(gantry);

      const gantryArm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.1), matHull);
      gantryArm.position.set(-0.26, 0.98, -0.25);
      group.add(gantryArm);

      // Mini Starship Cargo Lander on pad
      const rocketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.62, 12), matHull);
      rocketBody.position.set(0.05, 0.54, 0);
      rocketBody.castShadow = !isSoftwareGl;
      group.add(rocketBody);

      const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 12), matDarkFrame);
      noseCone.position.set(0.05, 0.99, 0);
      group.add(noseCone);
      break;
    }

    case 'MAINTENANCE_HUB': {
      // Drone Hangar + Rotating Radar Array
      const hangar = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.42, 6), matHull);
      hangar.position.y = 0.31;
      hangar.castShadow = !isSoftwareGl;
      group.add(hangar);

      const helipad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.04, 12),
        new THREE.MeshStandardMaterial({
          color: '#14B8A6',
          emissive: isOnline ? new THREE.Color('#0D9488') : new THREE.Color('#000000'),
          emissiveIntensity: isOnline ? 0.9 : 0,
        })
      );
      helipad.position.y = 0.53;
      group.add(helipad);

      // Spinning Radar Dish
      const radarGroup = new THREE.Group();
      radarGroup.position.set(0, 0.65, 0);
      const dish = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), matBrushedGold);
      dish.rotation.x = -0.35;
      radarGroup.add(dish);
      group.add(radarGroup);

      if (isOnline) {
        animParts.push({ object: radarGroup, type: 'ROTATE_Y', speed: 2.0 });
      }
      break;
    }
  }

  // Upgrade Level Scale & Gold Beacons for Level 2 and Level 3
  const levelScale = 1 + (building.level - 1) * 0.12;
  group.scale.set(levelScale, levelScale, levelScale);

  if (building.level >= 2) {
    for (let i = 1; i < building.level; i++) {
      const pip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), matBrushedGold);
      pip.position.set(-0.55 + (i - 1) * 0.22, 0.25, 0.58);
      group.add(pip);
    }
  }

  // Offline / Unpowered Warning Beacon above structure
  if (!isOnline) {
    const warnMat = new THREE.MeshBasicMaterial({ color: '#EF4444' });
    const warnCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), warnMat);
    warnCrystal.position.set(0, 1.38, 0);
    group.add(warnCrystal);
    animParts.push({ object: warnCrystal, type: 'ROTATE_Y', speed: 3.0 });
  }

  group.userData.animParts = animParts;
  return group;
}

// Create a 3D Orbital Cargo Pod / Rocket for Earth Trade animations
export function createOrbitalCargoRocket(): THREE.Group {
  const rocket = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: '#F8FAFC',
    roughness: 0.25,
    metalness: 0.8,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    roughness: 0.3,
    metalness: 0.6,
  });
  const plumeMat = new THREE.MeshBasicMaterial({
    color: '#38BDF8',
    transparent: true,
    opacity: 0.85,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.1, 12), hullMat);
  body.position.y = 0.65;
  rocket.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 12), trimMat);
  nose.position.y = 1.42;
  rocket.add(nose);

  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), plumeMat);
  plume.rotation.x = Math.PI;
  plume.position.y = -0.2;
  rocket.add(plume);

  return rocket;
}
