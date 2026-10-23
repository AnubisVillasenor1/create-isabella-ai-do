/**
 * Isabella Cinematic Intro — Main Component
 *
 * Secuencia de activación cognitiva territorial de 50 segundos.
 * Combina Three.js vanilla con React para control total del rendering.
 *
 * Fases: VOID → STELLAR_FIELD → COMET_PASSAGE → COGNITIVE_CORE
 *        → LOGO_REVEAL → HEARTBEAT → HUMMINGBIRD → INTERFACE
 */

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import {
  type IntroPhase,
  type IntroState,
  resolveIntroPhase,
  resolveCameraShot,
  getPhaseProgress,
  createInitialState,
  getPerformanceLimits,
  TOTAL_DURATION,
} from "./timeline";
import { COLORS_THREE, STAR_LAYERS } from "./colors";

interface CinematicIntroProps {
  onComplete: () => void;
  onPhaseChange?: (phase: IntroPhase) => void;
  skipOnReducedMotion?: boolean;
}

export function CinematicIntro({
  onComplete,
  onPhaseChange,
  skipOnReducedMotion = true,
}: CinematicIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<IntroState | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const frameRef = useRef<number>(0);
  const [currentPhase, setCurrentPhase] = useState<IntroPhase>("VOID");
  const [progress, setProgress] = useState(0);
  const skipRef = useRef(false);

  const cleanup = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    if (sceneRef.current) {
      sceneRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = createInitialState(reducedMotion);
    stateRef.current = state;

    if (skipOnReducedMotion && reducedMotion) {
      onComplete();
      return;
    }

    const limits = getPerformanceLimits(state.performanceProfile);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS_THREE.voidBlack);
    scene.fog = limits.fog
      ? new THREE.FogExp2(COLORS_THREE.deepSpace, 0.012)
      : undefined;
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      54,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    camera.position.set(0, 0, 48);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, limits.pixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x1a1a3e, 0.3);
    scene.add(ambientLight);

    const coreLight = new THREE.PointLight(COLORS_THREE.electricViolet, 0, 50);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const heartLight = new THREE.PointLight(COLORS_THREE.roseHeart, 0, 30);
    heartLight.position.set(0, 0, 0);
    scene.add(heartLight);

    // Create elements
    const starfield2D = createStarfield2D(limits.starfield2D);
    const starfield3D = createStarfield3D(limits.starfield3D);
    const comets = createComets(limits.cometParticles);
    const coreRings = createCoreRings();
    const logo = createLogoPlaceholder();
    const heart = createHeart();
    const hummingbird = createHummingbird(limits.hummingbirdDetail);
    const interfaceElements = createInterfaceElements();

    scene.add(starfield2D);
    scene.add(starfield3D);
    for (const comet of comets) scene.add(comet.group);
    scene.add(coreRings.group);
    scene.add(logo);
    scene.add(heart);
    scene.add(hummingbird.group);
    scene.add(interfaceElements.group);

    // Mouse tracking
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    // Resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Animation loop
    let lastPhase: IntroPhase = "VOID";

    const animate = () => {
      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();
      const time = Math.min(elapsed, TOTAL_DURATION);

      state.elapsed = time;
      state.phase = resolveIntroPhase(time);
      state.progress = getPhaseProgress(time);
      state.cameraShot = resolveCameraShot(time);

      if (state.phase !== lastPhase) {
        lastPhase = state.phase;
        setCurrentPhase(state.phase);
        onPhaseChange?.(state.phase);
      }

      setProgress(time / TOTAL_DURATION);

      // Camera
      const shot = state.cameraShot;
      const targetPos = new THREE.Vector3(shot.position.x, shot.position.y, shot.position.z);
      const targetLook = new THREE.Vector3(shot.lookAt.x, shot.lookAt.y, shot.lookAt.z);
      camera.position.lerp(targetPos, 1 - Math.exp(-4 * delta));
      camera.lookAt(targetLook);
      camera.fov = THREE.MathUtils.damp(camera.fov, shot.fov, 3, delta);
      camera.updateProjectionMatrix();

      // Mouse parallax (subtle)
      camera.position.x += mouse.x * 0.3 * delta;
      camera.position.y += mouse.y * 0.2 * delta;

      // Update elements based on phase
      updateStarfield2D(starfield2D, time, delta, state.phase);
      updateStarfield3D(starfield3D, time, delta, state.phase);
      updateComets(comets, time, delta, state.phase);
      updateCoreRings(coreRings, time, delta, state.phase);
      updateLogo(logo, time, delta, state.phase);
      updateHeart(heart, time, delta, state.phase, heartLight);
      updateHummingbird(hummingbird, time, delta, state.phase);
      updateInterface(interfaceElements, time, delta, state.phase);

      // Core light
      if (time >= 19 && time < 33) {
        const coreProgress = Math.min(1, (time - 19) / 7);
        coreLight.intensity = coreProgress * 2.5;
      } else {
        coreLight.intensity *= 0.95;
      }

      renderer.render(scene, camera);

      if (time >= TOTAL_DURATION && !skipRef.current) {
        skipRef.current = true;
        onComplete();
        return;
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      cleanup();
    };
  }, [cleanup, onComplete, onPhaseChange, skipOnReducedMotion]);

  return (
    <div className="fixed inset-0 z-50">
      <div ref={containerRef} className="h-full w-full" />
      {/* Phase indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
            {currentPhase.replace(/_/g, " ")}
          </span>
          <div className="h-px w-24 bg-white/10">
            <div
              className="h-px bg-electric transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute bottom-6 right-6 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30 transition-colors hover:text-white/60"
      >
        Saltar →
      </button>
    </div>
  );
}

// ============================================================================
// SCENE CREATION FUNCTIONS
// ============================================================================

function createStarfield2D(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 40 + Math.random() * 60;

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    sizes[i] = 0.5 + Math.random() * 1.5;
    opacities[i] = 0.2 + Math.random() * 0.6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function createStarfield3D(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 120;
    positions[i3 + 1] = (Math.random() - 0.5) * 120;
    positions[i3 + 2] = (Math.random() - 0.5) * 120;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xaaccff,
    size: 0.08,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function createComets(particleCount: number) {
  const cometDefs = [
    {
      start: new THREE.Vector3(-32, -14, -20),
      controlA: new THREE.Vector3(-15, -5, -8),
      controlB: new THREE.Vector3(-5, 2, -2),
      end: new THREE.Vector3(2, 1, 0),
      duration: 2.4,
      delay: 12.2,
      color: COLORS_THREE.cyanSignal,
    },
    {
      start: new THREE.Vector3(25, 18, -8),
      controlA: new THREE.Vector3(10, 8, -3),
      controlB: new THREE.Vector3(2, 0, 1),
      end: new THREE.Vector3(-4, -4, 2),
      duration: 2.8,
      delay: 14.0,
      color: COLORS_THREE.electricViolet,
    },
    {
      start: new THREE.Vector3(-20, 8, -12),
      controlA: new THREE.Vector3(-5, 3, -4),
      controlB: new THREE.Vector3(3, 1, 0),
      end: new THREE.Vector3(0, 0, 0),
      duration: 3.0,
      delay: 15.5,
      color: COLORS_THREE.goldAccent,
    },
  ];

  return cometDefs.map((def) => {
    const curve = new THREE.CatmullRomCurve3([
      def.start,
      def.controlA,
      def.controlB,
      def.end,
    ]);

    const trailPositions = new Float32Array(particleCount * 3);
    const trailSizes = new Float32Array(particleCount);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));

    const trailMaterial = new THREE.PointsMaterial({
      color: def.color,
      size: 0.15,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const trail = new THREE.Points(trailGeometry, trailMaterial);

    const coreGeometry = new THREE.SphereGeometry(0.12, 8, 8);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);

    const group = new THREE.Group();
    group.add(trail);
    group.add(core);

    return {
      group,
      curve,
      core,
      trail,
      trailGeometry,
      trailMaterial,
      coreMaterial,
      trailSizes,
      ...def,
    };
  });
}

function createCoreRings() {
  const rings = [
    { radius: 2.5, color: COLORS_THREE.electricViolet, speed: 0.3, opacity: 0.15 },
    { radius: 1.8, color: COLORS_THREE.cyanSignal, speed: -0.4, opacity: 0.2 },
    { radius: 1.0, color: COLORS_THREE.whiteLight, speed: 0.5, opacity: 0.25 },
  ];

  const meshes = rings.map((ring) => {
    const geometry = new THREE.TorusGeometry(ring.radius, 0.02, 16, 100);
    const material = new THREE.MeshBasicMaterial({
      color: ring.color,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    return { mesh, material, ...ring };
  });

  const group = new THREE.Group();
  meshes.forEach((m) => group.add(m.mesh));

  return { group, meshes };
}

function createLogoPlaceholder(): THREE.Group {
  const group = new THREE.Group();

  // Simple geometric logo representation
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.03, 16, 64),
    new THREE.MeshBasicMaterial({
      color: COLORS_THREE.whiteLight,
      transparent: true,
      opacity: 0,
    }),
  );

  const innerShape = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8, 0),
    new THREE.MeshBasicMaterial({
      color: COLORS_THREE.electricViolet,
      transparent: true,
      opacity: 0,
      wireframe: true,
    }),
  );

  group.add(outerRing);
  group.add(innerShape);

  return group;
}

function createHeart(): THREE.Group {
  const group = new THREE.Group();

  // Heart shape using curves
  const heartShape = new THREE.Shape();
  const x = 0, y = 0;
  heartShape.moveTo(x, y + 0.35);
  heartShape.bezierCurveTo(x, y + 0.35, x - 0.05, y + 0.5, x - 0.25, y + 0.5);
  heartShape.bezierCurveTo(x - 0.55, y + 0.5, x - 0.55, y + 0.175, x - 0.55, y + 0.175);
  heartShape.bezierCurveTo(x - 0.55, y, x - 0.35, y - 0.25, x, y - 0.5);
  heartShape.bezierCurveTo(x + 0.35, y - 0.25, x + 0.55, y, x + 0.55, y + 0.175);
  heartShape.bezierCurveTo(x + 0.55, y + 0.175, x + 0.55, y + 0.5, x + 0.25, y + 0.5);
  heartShape.bezierCurveTo(x + 0.1, y + 0.5, x, y + 0.35, x, y + 0.35);

  const geometry = new THREE.ExtrudeGeometry(heartShape, {
    depth: 0.15,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });

  const material = new THREE.MeshStandardMaterial({
    color: COLORS_THREE.roseHeart,
    emissive: COLORS_THREE.roseHeart,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(0.6, 0.6, 0.6);
  group.add(mesh);

  return group;
}

function createHummingbird(detail: "full" | "simplified" | "sprite"): THREE.Group {
  const group = new THREE.Group();

  if (detail === "sprite") {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#34D399";
      ctx.beginPath();
      ctx.ellipse(32, 32, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22D3EE";
      ctx.beginPath();
      ctx.ellipse(48, 32, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 1.5, 1);
    group.add(sprite);
    return group;
  }

  // Body
  const bodyGeometry = new THREE.ConeGeometry(0.15, 0.6, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: COLORS_THREE.emeraldLife,
    emissive: COLORS_THREE.emeraldLife,
    emissiveIntensity: 0.3,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.z = Math.PI / 2;
  group.add(body);

  // Beak
  const beakGeometry = new THREE.ConeGeometry(0.03, 0.25, 4);
  const beakMaterial = new THREE.MeshStandardMaterial({ color: COLORS_THREE.goldAccent });
  const beak = new THREE.Mesh(beakGeometry, beakMaterial);
  beak.rotation.z = -Math.PI / 2;
  beak.position.x = 0.4;
  group.add(beak);

  // Wings
  const wingGeometry = new THREE.PlaneGeometry(0.5, 0.15);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: COLORS_THREE.cyanSignal,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });

  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.set(-0.05, 0.1, 0.1);
  leftWing.rotation.x = 0.3;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial.clone());
  rightWing.position.set(-0.05, 0.1, -0.1);
  rightWing.rotation.x = -0.3;
  group.add(rightWing);

  // Tail
  const tailGeometry = new THREE.ConeGeometry(0.08, 0.3, 4);
  const tailMaterial = new THREE.MeshStandardMaterial({
    color: COLORS_THREE.emeraldLife,
    emissive: COLORS_THREE.emeraldLife,
    emissiveIntensity: 0.2,
  });
  const tail = new THREE.Mesh(tailGeometry, tailMaterial);
  tail.rotation.z = Math.PI / 3;
  tail.position.x = -0.35;
  group.add(tail);

  group.visible = false;

  return group;
}

function createInterfaceElements() {
  const group = new THREE.Group();

  // HUD lines
  const lineMaterial = new THREE.LineBasicMaterial({
    color: COLORS_THREE.cyanSignal,
    transparent: true,
    opacity: 0,
  });

  const hudPoints = [
    [new THREE.Vector3(-8, -5, -1), new THREE.Vector3(-4, -5, -1)],
    [new THREE.Vector3(4, -5, -1), new THREE.Vector3(8, -5, -1)],
    [new THREE.Vector3(-8, 5, -1), new THREE.Vector3(-4, 5, -1)],
    [new THREE.Vector3(4, 5, -1), new THREE.Vector3(8, 5, -1)],
  ];

  for (const [start, end] of hudPoints) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, lineMaterial.clone());
    group.add(line);
  }

  // Status dots
  const dotPositions = [
    new THREE.Vector3(-6, 4, -1),
    new THREE.Vector3(-5, 4, -1),
    new THREE.Vector3(-4, 4, -1),
  ];

  for (const pos of dotPositions) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({
        color: COLORS_THREE.emeraldLife,
        transparent: true,
        opacity: 0,
      }),
    );
    dot.position.copy(pos);
    group.add(dot);
  }

  return group;
}

// ============================================================================
// UPDATE FUNCTIONS
// ============================================================================

function updateStarfield2D(
  stars: THREE.Points,
  time: number,
  _delta: number,
  phase: IntroPhase,
) {
  const material = stars.material as THREE.PointsMaterial;

  if (phase === "VOID") {
    const voidProgress = Math.min(1, time / 5);
    material.opacity = voidProgress * 0.3;
  } else if (phase === "STELLAR_FIELD") {
    const starProgress = Math.min(1, (time - 5) / 7);
    material.opacity = 0.3 + starProgress * 0.5;
  } else {
    material.opacity = 0.8;
  }

  // Twinkle
  const positions = stars.geometry.attributes.position;
  if (positions) {
    const arr = positions.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += Math.sin(time * 0.5 + i) * 0.001;
    }
    positions.needsUpdate = true;
  }
}

function updateStarfield3D(
  stars: THREE.Points,
  time: number,
  _delta: number,
  phase: IntroPhase,
) {
  const material = stars.material as THREE.PointsMaterial;

  if (phase === "VOID") {
    material.opacity = 0;
  } else if (phase === "STELLAR_FIELD") {
    const starProgress = Math.min(1, (time - 5) / 7);
    material.opacity = starProgress * 0.6;
  } else {
    material.opacity = 0.6;
  }

  // Orbital drift
  stars.rotation.y += 0.0002;
  stars.rotation.x += 0.0001;
}

function updateComets(
  comets: ReturnType<typeof createComets>,
  time: number,
  _delta: number,
  phase: IntroPhase,
) {
  if (phase !== "COMET_PASSAGE") {
    for (const comet of comets) {
      comet.coreMaterial.opacity = 0;
      comet.trailMaterial.opacity = 0;
    }
    return;
  }

  for (const comet of comets) {
    const cometTime = time - comet.delay;
    if (cometTime < 0 || cometTime > comet.duration + 0.5) {
      comet.coreMaterial.opacity = 0;
      comet.trailMaterial.opacity = 0;
      continue;
    }

    const t = Math.min(1, cometTime / comet.duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const position = comet.curve.getPointAt(eased);
    comet.core.position.copy(position);
    comet.coreMaterial.opacity = Math.min(1, t * 3) * (1 - Math.max(0, (t - 0.7) / 0.3));

    // Trail
    const trailPositions = comet.trailGeometry.attributes.position;
    if (trailPositions) {
      const arr = trailPositions.array as Float32Array;
      for (let i = 0; i < comet.trailSizes.length; i++) {
        const trailT = Math.max(0, eased - (i / comet.trailSizes.length) * 0.15);
        const trailPoint = comet.curve.getPointAt(Math.min(1, trailT));
        arr[i * 3] = trailPoint.x + (Math.random() - 0.5) * 0.1;
        arr[i * 3 + 1] = trailPoint.y + (Math.random() - 0.5) * 0.1;
        arr[i * 3 + 2] = trailPoint.z + (Math.random() - 0.5) * 0.1;
      }
      trailPositions.needsUpdate = true;
    }
    comet.trailMaterial.opacity = Math.min(0.6, t * 2) * (1 - Math.max(0, (t - 0.6) / 0.4));
  }
}

function updateCoreRings(
  core: ReturnType<typeof createCoreRings>,
  time: number,
  _delta: number,
  phase: IntroPhase,
) {
  if (phase !== "COGNITIVE_CORE" && phase !== "LOGO_REVEAL") {
    for (const ring of core.meshes) {
      ring.material.opacity = 0;
    }
    return;
  }

  const coreProgress = Math.min(1, (time - 19) / 7);

  for (const ring of core.meshes) {
    ring.mesh.rotation.z += ring.speed * 0.02;
    ring.material.opacity = coreProgress * ring.opacity;

    // Pulse inner ring
    if (ring.radius === 1.0) {
      const pulse = Math.sin(time * 3) * 0.5 + 0.5;
      ring.material.opacity = coreProgress * (ring.opacity + pulse * 0.1);
    }
  }
}

function updateLogo(
  logo: THREE.Group,
  time: number,
  _delta: number,
  phase: IntroPhase,
) {
  if (phase !== "LOGO_REVEAL" && phase !== "HEARTBEAT" && phase !== "HUMMINGBIRD_ENTRY" && phase !== "HUMMINGBIRD_ASCENT" && phase !== "INTERFACE_REVEAL") {
    logo.visible = false;
    return;
  }

  logo.visible = true;
  const logoProgress = Math.min(1, (time - 26) / 7);

  const outerRing = logo.children[0] as THREE.Mesh;
  const innerShape = logo.children[1] as THREE.Mesh;

  if (outerRing?.material) {
    (outerRing.material as THREE.MeshBasicMaterial).opacity = logoProgress * 0.8;
  }
  if (innerShape?.material) {
    (innerShape.material as THREE.MeshBasicMaterial).opacity = logoProgress * 0.6;
    innerShape.rotation.y += 0.01;
    innerShape.rotation.z += 0.005;
  }

  // Scale animation
  const scale = 0.5 + logoProgress * 0.5;
  logo.scale.setScalar(scale);
}

function updateHeart(
  heart: THREE.Group,
  time: number,
  _delta: number,
  phase: IntroPhase,
  heartLight: THREE.PointLight,
) {
  if (phase !== "HEARTBEAT" && phase !== "HUMMINGBIRD_ENTRY" && phase !== "HUMMINGBIRD_ASCENT" && phase !== "INTERFACE_REVEAL") {
    heart.visible = false;
    heartLight.intensity = 0;
    return;
  }

  heart.visible = true;
  const heartProgress = Math.min(1, (time - 33) / 6);

  const mesh = heart.children[0] as THREE.Mesh;
  if (!mesh?.material) return;

  const material = mesh.material as THREE.MeshStandardMaterial;
  material.opacity = heartProgress;
  material.emissiveIntensity = heartProgress * 0.45;

  // Heartbeat: double pulse
  if (time >= 35.8 && time < 39) {
    const beatTime = time - 35.8;
    const beat1 = Math.max(0, Math.sin(beatTime * Math.PI * 2.15));
    const beat2 = Math.max(0, Math.sin((beatTime - 0.15) * Math.PI * 2.15)) * 0.6;
    const heartbeat = beat1 + beat2;

    heart.scale.setScalar(1 + heartbeat * 0.045);
    material.emissiveIntensity = 0.45 + heartbeat * 0.8;
    heartLight.intensity = heartbeat * 3;

    // Vertical displacement
    heart.position.y = heartbeat * 0.05;
  } else {
    heart.scale.setScalar(1);
    heartLight.intensity = heartProgress * 0.5;
  }
}

function updateHummingbird(
  bird: THREE.Group,
  time: number,
  _delta: number,
  phase: IntroPhase,
) {
  if (phase !== "HUMMINGBIRD_ENTRY" && phase !== "HUMMINGBIRD_ASCENT") {
    bird.visible = false;
    return;
  }

  bird.visible = true;

  const birdTime = time - 39;
  const totalFlight = 8; // 39-47s
  const t = Math.min(1, birdTime / totalFlight);

  // Catmull-Rom trajectory
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-16, -5, 6),
    new THREE.Vector3(-9, 1, 3),
    new THREE.Vector3(-4, 4, 1),
    new THREE.Vector3(2, 3, 0),
    new THREE.Vector3(7, 6, -2),
    new THREE.Vector3(13, 10, -8),
  ]);

  const position = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t);

  bird.position.copy(position);
  bird.lookAt(position.clone().add(tangent));

  // Wing beat
  const children = bird.children;
  const wingFrequency = 42 - t * 15; // Slow down towards end
  const wingAmplitude = 0.42;
  const wingBeat = Math.sin(time * wingFrequency) * wingAmplitude;

  if (children[2]) children[2].rotation.x = 0.3 + wingBeat;
  if (children[3]) children[3].rotation.x = -0.3 - wingBeat;

  // Fade out at end
  if (t > 0.8) {
    const fadeOut = (t - 0.8) / 0.2;
    bird.scale.setScalar(1 - fadeOut * 0.5);
  }
}

function updateInterface(
  iface: ReturnType<typeof createInterfaceElements>,
  time: number,
  _delta: number,
  phase: IntroPhase,
) {
  if (phase !== "INTERFACE_REVEAL") {
    iface.group.visible = false;
    return;
  }

  iface.group.visible = true;
  const interfaceProgress = Math.min(1, (time - 47) / 3);

  let dotIndex = 0;
  iface.group.traverse((obj) => {
    if (obj instanceof THREE.Line) {
      const mat = obj.material as THREE.LineBasicMaterial;
      mat.opacity = interfaceProgress * 0.5;
    }
    if (obj instanceof THREE.Mesh && obj.geometry.type === "SphereGeometry") {
      const delay = dotIndex * 0.15;
      const dotProgress = Math.max(0, Math.min(1, (interfaceProgress - delay) / 0.3));
      (obj.material as THREE.MeshBasicMaterial).opacity = dotProgress;
      dotIndex++;
    }
  });
}
