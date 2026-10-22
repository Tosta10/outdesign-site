import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ViewerCameraMotion } from "./viewer-camera";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { makeObject, disposeObject } from "./geometry";
import {
  relax,
  motionAllowed,
  itemAtCell,
  archiveColumns,
  wrap,
  ARCHIVE_LAYOUT as layout,
  type LabItem,
  type LabMode,
  type LabPreferences,
} from "./state";
import {
  damp,
  baselineSelectionWave,
  idleWave,
  settlingWave,
  columnStrength,
  smooth,
} from "./motion";
export type SceneState = {
  items: LabItem[];
  track: { lane: number; row: number } | null;
  pointer: { x: number; y: number };
  lane: number;
  row: number;
  mode: LabMode;
  exploded: boolean;
  frosted: boolean;
  rotation: { x: number; y: number };
  pan: { x: number; y: number };
  offset: { x: number; y: number };
  zoom: number;
  highlight: number;
  wave: number;
  preferences: LabPreferences;
};
export function createLabScene(
  host: HTMLElement,
  state: SceneState,
  onPick: (lane: number, row: number, open: boolean) => void,
  progress: (value: number) => void,
) {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(25, 1, 0.1, 160);
  const controlCamera = camera.clone();
  const controls = new OrbitControls(controlCamera, canvas);
  controls.enabled = false;
  controls.enableDamping = false;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.panSpeed = 0.7;
  controls.minDistance = 5;
  controls.maxDistance = 28;
  controls.maxTargetRadius = 5;
  controls.screenSpacePanning = true;
  controls.touches.ONE = T.TOUCH.ROTATE;
  controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  const viewerMotion = new ViewerCameraMotion(camera);
  let inspecting = false;
  controls.addEventListener("start", () =>
    viewerMotion.interruptReset(controlCamera, controls.target),
  );
  controls.addEventListener("change", () => invalidate());
  const pmrem = new T.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.add(new T.HemisphereLight(0xfffcf2, 0x8d8171, 2.4));
  const light = new T.DirectionalLight(0xfff8ea, 3.5);
  light.position.set(-12, 20, 8);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {
    left: -23,
    right: 23,
    top: 23,
    bottom: -23,
    near: 0.1,
    far: 70,
  });
  light.shadow.normalBias = 0.04;
  light.shadow.bias = -0.0002;
  scene.add(light);
  const fill = new T.DirectionalLight(0xffffff, 1.2);
  fill.position.set(8, 5, -8);
  scene.add(fill);
  const floor = new T.Mesh(
    new T.PlaneGeometry(160, 160),
    new T.ShadowMaterial({ opacity: 0.13 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  floor.receiveShadow = true;
  scene.add(floor);
  const count = layout.lanes * layout.rows,
    dummy = new T.Object3D();
  const shell = new T.MeshStandardMaterial({
    color: 0xe1dcd1,
    metalness: 0.04,
    roughness: 0.39,
  });
  shell.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying float panelHeight;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\npanelHeight=position.y/2.94+0.5;",
    );
    shader.fragmentShader =
      "varying float panelHeight;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(0.68,0.64,0.56),vec3(1.0),smoothstep(0.0,1.0,panelHeight));",
    );
  };
  const body = new T.InstancedMesh(
    new T.BoxGeometry(layout.width, layout.height, layout.depth),
    shell,
    count,
  );
  const edges = new T.InstancedMesh(
    new T.BoxGeometry(layout.width + 0.02, 0.035, layout.depth + 0.025),
    new T.MeshStandardMaterial({
      color: 0xfffdf5,
      roughness: 0.2,
      metalness: 0.1,
    }),
    count,
  );
  const pins = new T.InstancedMesh(
    new T.CylinderGeometry(0.028, 0.028, 0.025, 8),
    new T.MeshStandardMaterial({
      color: 0x8b8d88,
      roughness: 0.32,
      metalness: 0.65,
    }),
    count * 2,
  );
  const atlasCanvas = document.createElement("canvas");
  const atlasRows = Math.max(
    1,
    Math.ceil(state.items.reduce((n, item) => Math.max(n, item.id + 1), 1) / 4),
  );
  atlasCanvas.width = 2048;
  atlasCanvas.height = atlasRows * 512;
  const ctx = atlasCanvas.getContext("2d")!,
    atlas = new T.CanvasTexture(atlasCanvas);
  atlas.colorSpace = T.SRGBColorSpace;
  atlas.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const indices = new Float32Array(count),
    artGeometry = new T.PlaneGeometry(3.18, 2.62);
  artGeometry.setAttribute(
    "odImage",
    new T.InstancedBufferAttribute(indices, 1),
  );
  const artMaterial = new T.MeshBasicMaterial({
    map: atlas,
    side: T.DoubleSide,
    color: 0xf1eee6,
  });
  artMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute float odImage; varying float imageIndex;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nimageIndex=odImage;",
    );
    shader.fragmentShader =
      "varying float imageIndex;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP\nvec2 cellUv=clamp(vMapUv,vec2(.003),vec2(.997));vec2 imageUv=vec2((cellUv.x+mod(imageIndex,4.0))/4.0,(cellUv.y+${atlasRows - 1}.0-floor(imageIndex/4.0))/${atlasRows}.0);diffuseColor*=texture2D(map,imageUv);\n#endif`,
    );
  };
  const artwork = new T.InstancedMesh(artGeometry, artMaterial, count);
  for (const mesh of [body, edges, pins, artwork]) {
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  body.castShadow = true;
  body.receiveShadow = true;
  let alive = true,
    visible = true,
    lost = false,
    last = performance.now(),
    lastDraw = 0;
  let lane = state.lane,
    row = state.row,
    detail = 0,
    explode = 0,
    reveal = 0,
    turnX = 0,
    turnY = 0,
    zoom = 1;
  const laneSpring = { value: state.lane, velocity: 0 },
    rowSpring = { value: state.row, velocity: 0 };
  const shoulder = { value: state.row, velocity: 0 },
    laneFocus = { value: state.lane, velocity: 0 },
    lift = { value: 0.4, velocity: 0 };
  let activeCell = { lane: state.lane, row: state.row };
  let active = `${itemAtCell(state.items, state.lane, state.row).key}:${state.lane}:${state.row}`;
  let model = makeObject(
    itemAtCell(state.items, state.lane, state.row),
    false,
    (ready) => {
      if (alive) {
        host.dataset.imageState = ready ? "loaded" : "failed";
        invalidate();
      }
    },
  );
  scene.add(model.object);
  type Returning = {
    model: ReturnType<typeof makeObject>;
    lane: number;
    row: number;
    lift: { value: number; velocity: number };
    rotation: { x: number; y: number };
  };
  const outgoing: Returning[] = [];
  let pulses: { lane: number; row: number; time: number }[] = [],
    idleGain = 0,
    lastInteraction = performance.now(),
    hoverCell: { lane: number; row: number } | null = null;
  const hoverLifts = new Map<string, number>();
  let themeAmount = state.preferences.theme === "dark" ? 1 : 0;
  let pendingPulse: { lane: number; row: number } | null = null;
  const paperColor = new T.Color(0xe8e5df),
    nightColor = new T.Color(0x152027),
    shellPaper = new T.Color(0xe1dcd1),
    shellNight = new T.Color(0x7a8f94);
  let quality = "",
    theme = "",
    composer: EffectComposer | null = null;
  const target = new T.Vector3(),
    aim = new T.Vector3(),
    ray = new T.Raycaster(),
    pointer = new T.Vector2();
  const cells: { lane: number; row: number }[] = [],
    abort = new AbortController();
  const images: HTMLImageElement[] = [];
  function atlasCell(item: LabItem, image?: HTMLImageElement) {
    if (!alive) return;
    const x = (item.id % 4) * 512,
      y = Math.floor(item.id / 4) * 512;
    ctx.fillStyle = "#e5e1d7";
    ctx.fillRect(x, y, 512, 512);
    if (image) {
      const fit = Math.min(488 / image.naturalWidth, 425 / image.naturalHeight);
      const w = image.naturalWidth * fit,
        h = image.naturalHeight * fit;
      ctx.drawImage(image, x + (512 - w) / 2, y + 65 + (425 - h) / 2, w, h);
    }
    ctx.fillStyle = "#3e4743";
    ctx.font = "18px monospace";
    ctx.fillText(`OUTDESIGN / ${item.code}`, x + 24, y + 34);
    atlas.needsUpdate = true;
    invalidate();
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    camera.aspect = Math.max(0.1, rect.width / Math.max(1, rect.height));
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    composer?.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
    invalidate();
  }
  function configure() {
    if (quality !== state.preferences.quality) {
      quality = state.preferences.quality;
      composer?.passes.forEach((pass) => pass.dispose());
      composer?.dispose();
      composer = null;
      renderer.setPixelRatio(
        Math.min(
          devicePixelRatio,
          quality === "high" ? 1.75 : quality === "low" ? 1 : 1.35,
        ),
      );
      renderer.shadowMap.enabled = quality !== "low";
      renderer.transmissionResolutionScale = quality === "high" ? 1 : 0.5;
      model.glass.transmission = quality === "low" ? 0 : 0.97;
      model.glass.transparent = quality === "low";
      model.glass.opacity = quality === "low" ? 0.16 : 1;
      model.glass.needsUpdate = true;
      if (quality === "high") {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const ao = new SSAOPass(scene, camera, 1, 1, 12);
        ao.kernelRadius = 1.5;
        ao.minDistance = 0.002;
        ao.maxDistance = 0.12;
        composer.addPass(ao);
        composer.addPass(
          new BokehPass(scene, camera, {
            focus: 40,
            aperture: 0.000015,
            maxblur: 0.002,
          }),
        );
        composer.addPass(new OutputPass());
      }
      resize();
    }
    if (theme !== state.preferences.theme) {
      theme = state.preferences.theme;
      const color = theme === "light" ? 0xe8e5df : 0x152027;
      scene.background = new T.Color(color);
      scene.fog = new T.Fog(color, 38, 70);
      shell.color.set(theme === "light" ? 0xe1dcd1 : 0x7a8f94);
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    invalidate();
  });
  intersection.observe(host);
  function draw(now: number) {
    if (!alive || lost || document.hidden || !visible) {
      renderer.setAnimationLoop(null);
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (state.preferences.quality === "low" && now - lastDraw < 32) return;
    lastDraw = now;
    configure();
    const motion =
      state.preferences.motion &&
      Object.values(state.preferences.effects).some(Boolean);
    themeAmount = relax(
      themeAmount,
      state.preferences.theme === "dark" ? 1 : 0,
      dt,
      motionAllowed(state.preferences, "surfaceTransitions") ? 5 : 1000,
    );
    (scene.background as T.Color).lerpColors(
      paperColor,
      nightColor,
      themeAmount,
    );
    if (scene.fog instanceof T.Fog)
      scene.fog.color.copy(scene.background as T.Color);
    shell.color.lerpColors(shellPaper, shellNight, themeAmount);
    renderer.toneMappingExposure = 1.16 - 0.13 * themeAmount;
    const trackMotion = motionAllowed(state.preferences, "selectionTransition"),
      detailMotion = motionAllowed(state.preferences, "detailTransition"),
      viewerNavigation = motionAllowed(state.preferences, "viewerNavigation");
    if (state.track) {
      laneSpring.value = state.track.lane;
      rowSpring.value = state.track.row;
      laneSpring.velocity = rowSpring.velocity = 0;
      lastInteraction = now;
    } else {
      damp(laneSpring, state.lane, trackMotion ? 3.7 : 1000, dt);
      damp(rowSpring, state.row, trackMotion ? 3.7 : 1000, dt);
    }
    lane = laneSpring.value;
    row = rowSpring.value;
    damp(shoulder, state.row, trackMotion ? 5 : 1000, dt);
    damp(laneFocus, state.lane, trackMotion ? 4 : 1000, dt);
    explode = relax(
      explode,
      Number(state.exploded),
      dt,
      motionAllowed(state.preferences, "viewerModelTransition") ? 6 : 1000,
    );
    turnX = relax(
      turnX,
      state.mode === "browse" ? 0 : state.rotation.x,
      dt,
      viewerNavigation ? 7 : 1000,
    );
    turnY = relax(
      turnY,
      state.mode === "browse" ? 0 : state.rotation.y,
      dt,
      viewerNavigation ? 7 : 1000,
    );
    zoom = relax(zoom, state.zoom, dt, viewerNavigation ? 5 : 1000);
    const aligning =
      state.mode === "browse" && Math.hypot(turnX, turnY) > 0.005;
    damp(
      lift,
      state.mode !== "browse" ? 4.05 : aligning ? lift.value : 0.4,
      detailMotion ? 4.2 : 1000,
      dt,
    );
    const cameraTarget =
      state.mode !== "browse"
        ? smooth((lift.value - 0.8) / 2.4)
        : aligning
          ? detail
          : smooth((lift.value - 0.4) / 3.65);
    detail = relax(detail, cameraTarget, dt, detailMotion ? 2.8 : 1000);
    const selected = itemAtCell(state.items, state.lane, state.row);
    const selectionKey = `${selected.key}:${state.lane}:${state.row}`;
    if (active !== selectionKey) {
      model.pieces.forEach((part) => {
        part.position.set(0, 0, 0);
        part.scale.setScalar(1);
      });
      outgoing.push({
        model,
        ...activeCell,
        lift: { value: lift.value, velocity: lift.velocity },
        rotation: { x: model.object.rotation.x, y: model.object.rotation.y },
      });
      while (outgoing.length > 8) {
        const old = outgoing.shift()!;
        scene.remove(old.model.object);
        disposeObject(old.model.object);
      }
      active = selectionKey;
      activeCell = { lane: state.lane, row: state.row };
      lastInteraction = now;
      pendingPulse = { ...activeCell };
      lift.value = 0;
      lift.velocity = 0;
      host.dataset.imageState = selected.image ? "loading" : "empty";
      model = makeObject(selected, quality === "low", (ready) => {
        if (alive && active === selectionKey) {
          host.dataset.imageState = ready ? "loaded" : "failed";
          invalidate();
        }
      });
      scene.add(model.object);
      reveal = 0;
    }
    pulses = pulses.slice(-16).filter((pulse) => now - pulse.time < 3200);
    idleGain = relax(
      idleGain,
      state.mode === "browse" && now - lastInteraction > 2500 ? 1 : 0,
      dt,
      0.8,
    );
    const field = (r: number, l: number) => {
      const shoulderHeight =
        settlingWave(r - shoulder.value, 26.56) *
          columnStrength(l, laneFocus.value) -
        0.65;
      if (!motion) return shoulderHeight;
      let ripple = 0;
      for (const pulse of motionAllowed(state.preferences, "selectionWave")
        ? pulses
        : [])
        ripple += baselineSelectionWave(
          Math.hypot(r - pulse.row, (l - pulse.lane) * 2.2),
          (now - pulse.time) / 1000,
        );
      return (
        shoulderHeight +
        (motionAllowed(state.preferences, "idleWave")
          ? idleWave(r, l, now / 1000) * idleGain
          : 0) +
        Math.max(-0.6, Math.min(0.6, ripple)) * (1 - detail)
      );
    };
    const hoverKey = hoverCell ? `${hoverCell.lane}:${hoverCell.row}` : "";
    if (hoverKey && !hoverLifts.has(hoverKey)) hoverLifts.set(hoverKey, 0);
    for (const [key, value] of hoverLifts) {
      const next = relax(
        value,
        key === hoverKey && state.mode === "browse" ? 0.28 : 0,
        dt,
        trackMotion ? 14 : 1000,
      );
      if (next < 0.0001 && key !== hoverKey) hoverLifts.delete(key);
      else hoverLifts.set(key, next);
    }
    const hoverLift = (l: number, r: number) =>
      hoverLifts.get(`${l}:${r}`) || 0;
    reveal =
      state.mode === "browse"
        ? 0
        : detail > 0.78 && lift.value > 3.3
          ? Math.min(1, reveal + dt / (motion ? 1.65 : 0.01))
          : reveal;
    model.reveal.value =
      !motionAllowed(state.preferences, "modelDecryption") && !state.frosted
        ? 1
        : state.frosted
          ? 0
          : state.mode === "browse"
            ? 0.3
            : reveal;
    progress(reveal);
    const narrow = host.clientWidth < 700,
      blend = detail;
    model.object.position.set(
      (state.lane - lane) * layout.columnGap + state.pan.x * blend,
      field(state.row, state.lane) +
        lift.value +
        hoverLift(state.lane, state.row) +
        state.pan.y * blend,
      (state.row - row) * layout.rowGap,
    );
    if (state.mode === "inspect") model.object.position.set(0, 0, 0);
    model.object.rotation.set(turnX * blend, turnY * blend, 0);
    for (let i = outgoing.length - 1; i >= 0; i--) {
      const old = outgoing[i];
      old.model.object.visible = state.mode !== "inspect";
      old.rotation.x = relax(
        old.rotation.x,
        0,
        dt,
        viewerNavigation ? 7 : 1000,
      );
      old.rotation.y = relax(
        old.rotation.y,
        0,
        dt,
        viewerNavigation ? 7 : 1000,
      );
      if (Math.hypot(old.rotation.x, old.rotation.y) < 0.005)
        damp(old.lift, 0, motion ? 4.5 : 1000, dt);
      old.model.object.position.set(
        (old.lane - lane) * layout.columnGap,
        field(old.row, old.lane) + old.lift.value,
        (old.row - row) * layout.rowGap,
      );
      old.model.object.rotation.set(old.rotation.x, old.rotation.y, 0);
      old.model.object.scale.set(1.5, 1, 1);
      old.model.reveal.value = Math.max(0, old.model.reveal.value - dt * 3);
      if (
        old.lift.value < 0.0001 &&
        Math.hypot(old.rotation.x, old.rotation.y) < 0.005
      ) {
        scene.remove(old.model.object);
        disposeObject(old.model.object);
        outgoing.splice(i, 1);
      }
    }
    if (
      pendingPulse &&
      lift.value >= 0.35 &&
      outgoing.every(
        (old) =>
          old.lane !== state.lane ||
          Math.abs(old.row - state.row) > 4 ||
          old.lift.value < lift.value,
      )
    ) {
      pulses.push({ ...pendingPulse, time: now });
      pendingPulse = null;
    }
    model.object.scale.set(1.5, 1, 1);
    const depths = [-0.65, 1.65, 0.55, 0.1, -1.15, 2.2];
    model.pieces.forEach((part, i) => {
      part.position.z = state.mode === "inspect" ? depths[i] * explode : 0;
      part.position.x =
        state.mode === "inspect" ? (i === 5 ? 0.3 : 0) * explode : 0;
      part.scale.setScalar(state.highlight === i ? 1.045 : 1);
    });
    model.accent.emissiveIntensity = state.highlight === 2 ? 0.7 : 0.08;
    const arrayVisible = detail < 0.995 && state.mode !== "inspect";
    [body, edges, pins, artwork].forEach(
      (mesh) => (mesh.visible = arrayVisible),
    );
    const columns = archiveColumns(state.items);
    let index = 0;
    for (let x = -4; x <= 4; x++)
      for (let z = -32; z <= 32; z++) {
        const l = Math.floor(lane) + x,
          r = Math.floor(row) + z;
        cells[index] = { lane: l, row: r };
        const isSelected =
          (l === state.lane && r === state.row) ||
          outgoing.some((old) => old.lane === l && old.row === r);
        const px = (l - lane) * layout.columnGap,
          py = field(r, l) + hoverLift(l, r),
          pz = (r - row) * layout.rowGap;
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(isSelected ? 0 : 1);
        dummy.updateMatrix();
        body.setMatrixAt(index, dummy.matrix);
        dummy.position.y += layout.height / 2;
        dummy.updateMatrix();
        edges.setMatrixAt(index, dummy.matrix);
        dummy.position.set(px, py, pz + layout.depth / 2 + 0.006);
        dummy.updateMatrix();
        artwork.setMatrixAt(index, dummy.matrix);
        const columnItems = columns[wrap(l, columns.length)].items;
        indices[index] = columnItems[wrap(r, columnItems.length)].id;
        for (let pin = 0; pin < 2; pin++) {
          dummy.position.set(px + (pin ? 1.57 : -1.57), py + 1.33, pz + 0.135);
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          pins.setMatrixAt(index * 2 + pin, dummy.matrix);
        }
        index++;
      }
    for (const mesh of [body, edges, pins, artwork])
      mesh.instanceMatrix.needsUpdate = true;
    artGeometry.attributes.odImage.needsUpdate = true;
    body.computeBoundingSphere();
    const browseDistance = narrow ? 0.68 : 0.72;
    aim.set(
      model.object.position.x * blend,
      1.0 * (1 - blend) + model.object.position.y * blend,
      model.object.position.z * blend,
    );
    target.set(
      aim.x + -25 * browseDistance * (1 - blend) + 1.1 * blend,
      aim.y + 17 * browseDistance * (1 - blend) + 0.4 * blend,
      aim.z +
        26 * browseDistance * (1 - blend) +
        (Math.max(7.8, narrow ? Math.max(13.8, 5.7 / camera.aspect) : 7.8) /
          zoom) *
          blend,
    );
    if (motionAllowed(state.preferences, "pointerParallax")) {
      target.x += state.pointer.x * 0.12 * (1 - blend);
      target.y -= state.pointer.y * 0.12 * (1 - blend);
    }
    camera.position.lerp(
      target,
      motion && detail > 0.001 ? 1 - Math.exp(-dt * 5) : 1,
    );
    camera.lookAt(aim);
    camera.fov = 25 * (1 - blend) + 36 * blend;
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    camera.setViewOffset(
      width,
      height,
      narrow ? 0 : width * 0.235 * blend,
      narrow ? height * 0.2 * blend : 0,
      width,
      height,
    );
    if (state.mode === "inspect") {
      if (!inspecting) {
        inspecting = true;
        controls.enabled = true;
        controls.target.set(0, 0, 0);
        controlCamera.position.set(3.5, 2, Math.max(8.5, 5.7 / camera.aspect));
        controlCamera.fov = 36;
        controls.update();
        controls.saveState();
        viewerMotion.snap(controlCamera, controls.target);
      }
      camera.clearViewOffset();
      camera.fov = 36;
      viewerMotion.update(
        controlCamera,
        controls.target,
        dt,
        !viewerNavigation,
      );
    } else if (inspecting) {
      inspecting = false;
      controls.enabled = false;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (composer) {
      const bokeh = composer.passes.find(
        (pass) => pass instanceof BokehPass,
      ) as BokehPass | undefined;
      if (bokeh)
        (bokeh.uniforms as Record<string, { value: number }>).focus.value =
          camera.position.distanceTo(aim);
      composer.render(dt);
    } else renderer.render(scene, camera);
    const projected = model.object.position.clone().project(camera);
    host.dataset.selectedScreen = `${(((projected.x + 1) * width) / 2).toFixed(1)},${(((1 - projected.y) * height) / 2).toFixed(1)}`;
    host.dataset.cameraPosition = camera.position
      .toArray()
      .map((value) => value.toFixed(3))
      .join(",");
    host.dataset.flatImage = String(
      model.picture.geometry.type === "PlaneGeometry",
    );
    host.dataset.explode = explode.toFixed(3);
    host.dataset.rotation = `${turnX.toFixed(3)},${turnY.toFixed(3)}`;
    host.dataset.arrayCells = String(count);
    host.dataset.returning = String(outgoing.length);
    host.dataset.lift = lift.value.toFixed(3);
    host.dataset.wave = field(state.row, state.lane + 1).toFixed(4);
    host.dataset.arrayOverlap = String(layout.rowGap < layout.depth);
    host.dataset.arrayPosition = `${lane.toFixed(3)},${row.toFixed(3)}`;
    host.dataset.frames = String(Number(host.dataset.frames || 0) + 1);
    if (
      !motion &&
      Math.abs(detail - Number(state.mode !== "browse")) < 0.0001 &&
      outgoing.length === 0 &&
      Math.abs(explode - Number(state.exploded)) < 0.0001 &&
      Math.abs(lane - (state.track?.lane ?? state.lane)) < 0.0001 &&
      Math.abs(row - (state.track?.row ?? state.row)) < 0.0001 &&
      Math.abs(turnX - (state.mode === "browse" ? 0 : state.rotation.x)) <
        0.0001 &&
      Math.abs(turnY - (state.mode === "browse" ? 0 : state.rotation.y)) <
        0.0001 &&
      Math.abs(zoom - state.zoom) < 0.0001 &&
      reveal === (state.mode === "browse" ? 0 : 1)
    )
      renderer.setAnimationLoop(null);
  }
  function invalidate() {
    if (alive && !lost && visible && !document.hidden) {
      last = performance.now();
      renderer.setAnimationLoop(draw);
    }
  }
  function hitCell(x: number, y: number) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      (-(y - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(
      [body, model.object, ...outgoing.map((old) => old.model.object)],
      true,
    )[0];
    if (!hit) return null;
    if (hit.instanceId !== undefined) return cells[hit.instanceId];
    for (const old of outgoing) {
      let node: T.Object3D | null = hit.object;
      while (node) {
        if (node === old.model.object) return { lane: old.lane, row: old.row };
        node = node.parent;
      }
    }
    return { ...activeCell };
  }
  function pick(x: number, y: number, open = false) {
    if (state.mode !== "browse") return;
    const cell = hitCell(x, y);
    if (cell) onPick(cell.lane, cell.row, open);
  }
  function projection() {
    const rect = host.getBoundingClientRect(),
      center = model.object.position.clone();
    camera.updateMatrixWorld();
    const project = (vector: T.Vector3) => {
      const from = center.clone().addScaledVector(vector, -0.5).project(camera),
        to = center.clone().addScaledVector(vector, 0.5).project(camera);
      return {
        x: ((to.x - from.x) * rect.width) / 2,
        y: (-(to.y - from.y) * rect.height) / 2,
      };
    };
    return {
      lane: project(new T.Vector3(-layout.columnGap, 0, 0)),
      row: project(new T.Vector3(0, 0, -layout.rowGap)),
    };
  }
  function hover(x: number, y: number) {
    if (state.mode !== "browse") return null;
    hoverCell = hitCell(x, y);
    const rect = host.getBoundingClientRect();
    state.pointer = {
      x: (x - rect.left) / rect.width - 0.5,
      y: (y - rect.top) / rect.height - 0.5,
    };
    invalidate();
    return hoverCell
      ? itemAtCell(state.items, hoverCell.lane, hoverCell.row)
      : null;
  }
  document.addEventListener("visibilitychange", invalidate, {
    signal: abort.signal,
  });
  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      lost = true;
      renderer.setAnimationLoop(null);
      host.dataset.ready = "lost";
    },
    { signal: abort.signal },
  );
  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      lost = false;
      host.dataset.ready = "true";
      invalidate();
    },
    { signal: abort.signal },
  );
  for (const item of state.items) {
    atlasCell(item);
    if (item.image) {
      const image = new Image();
      images.push(image);
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (alive) {
          try {
            atlasCell(item, image);
          } catch {
            atlasCell(item);
          }
        }
      };
      image.src = item.image;
    }
  }
  host.dataset.imageState = state.items[0].image ? "loading" : "empty";
  configure();
  resize();
  host.dataset.ready = "true";
  invalidate();
  return {
    invalidate,
    pick,
    projection,
    resetViewer() {
      if (inspecting) {
        controls.reset();
        viewerMotion.reset();
        invalidate();
      }
    },
    viewerKey(key: string) {
      if (!inspecting) return;
      if (key.toLowerCase() === "r" || key === "Home") {
        controls.reset();
        viewerMotion.reset();
      } else if (key === "+" || key === "=" || key === "-") {
        const offset = controlCamera.position.clone().sub(controls.target);
        offset.multiplyScalar(key === "-" ? 1.12 : 0.89);
        controlCamera.position.copy(controls.target).add(offset);
      } else {
        const side = new T.Vector3().setFromMatrixColumn(
            controlCamera.matrix,
            0,
          ),
          up = new T.Vector3().setFromMatrixColumn(controlCamera.matrix, 1);
        const vector = new T.Vector3();
        if (key === "ArrowLeft") vector.addScaledVector(side, -0.18);
        if (key === "ArrowRight") vector.addScaledVector(side, 0.18);
        if (key === "ArrowUp") vector.addScaledVector(up, 0.18);
        if (key === "ArrowDown") vector.addScaledVector(up, -0.18);
        controlCamera.position.add(vector);
        controls.target.add(vector);
      }
      controls.update();
      invalidate();
    },
    hover,
    clearHover() {
      hoverCell = null;
      state.pointer = { x: 0, y: 0 };
      invalidate();
    },
    position() {
      return { lane: laneSpring.value, row: rowSpring.value };
    },
    dispose() {
      if (!alive) return;
      alive = false;
      abort.abort();
      controls.dispose();
      renderer.setAnimationLoop(null);
      observer.disconnect();
      intersection.disconnect();
      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
      composer?.passes.forEach((pass) => pass.dispose());
      composer?.dispose();
      light.shadow.map?.dispose();
      environment.dispose();
      disposeObject(scene);
      renderer.dispose();
      host.dataset.ready = "false";
    },
  };
}
