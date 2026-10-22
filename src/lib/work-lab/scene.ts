import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { makeObject, disposeObject } from "./geometry";
import {
  relax,
  pulse,
  wrap,
  itemAt,
  type LabItem,
  type LabMode,
  type LabPreferences,
} from "./state";
export type SceneState = {
  items: LabItem[];
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
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(8, 11, 13);
  const pmrem = new T.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.add(new T.HemisphereLight(0xd8f6ff, 0x20262d, 2));
  const light = new T.DirectionalLight(0xf1f5ff, 4);
  light.position.set(-4, 9, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -15;
  light.shadow.camera.right = 15;
  light.shadow.camera.top = 15;
  light.shadow.camera.bottom = -15;
  light.shadow.normalBias = 0.03;
  scene.add(light);
  const fill = new T.DirectionalLight(0x85cfc5, 2);
  fill.position.set(5, 3, -3);
  scene.add(fill);
  const floor = new T.Mesh(
    new T.PlaneGeometry(150, 150),
    new T.ShadowMaterial({ opacity: 0.16 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.85;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new T.GridHelper(100, 80, 0x3f555d, 0x25353c);
  grid.position.y = -1.84;
  grid.visible = false;
  scene.add(grid);
  const count = 65,
    dummy = new T.Object3D();
  const bodyMaterial = new T.MeshStandardMaterial({
    color: 0x8fa9b8,
    metalness: 0.65,
    roughness: 0.32,
  });
  const body = new T.InstancedMesh(
    new T.BoxGeometry(1.42, 0.13, 1.92),
    bodyMaterial,
    count,
  );
  body.castShadow = true;
  body.receiveShadow = true;
  body.instanceMatrix.setUsage(T.DynamicDrawUsage);
  body.frustumCulled = false;
  scene.add(body);
  const atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = 2048;
  atlasCanvas.height = 3072;
  const atlasContext = atlasCanvas.getContext("2d")!;
  const atlas = new T.CanvasTexture(atlasCanvas);
  atlas.colorSpace = T.SRGBColorSpace;
  const atlasCell = (item: LabItem, image?: HTMLImageElement) => {
    if (!alive) return;
    const x = (item.id % 4) * 512,
      y = (5 - Math.floor(item.id / 4)) * 512;
    atlasContext.fillStyle = "#d9e4dc";
    atlasContext.fillRect(x, y, 512, 512);
    if (image) {
      const scale = Math.min(
          1.25 / image.naturalWidth,
          1.58 / image.naturalHeight,
        ),
        w = ((image.naturalWidth * scale) / 1.25) * 492,
        h = ((image.naturalHeight * scale) / 1.58) * 492;
      atlasContext.drawImage(image, x + (512 - w) / 2, y + (512 - h) / 2, w, h);
    } else {
      atlasContext.strokeStyle = "#7d9a93";
      atlasContext.strokeRect(x + 50, y + 50, 412, 412);
      atlasContext.fillStyle = "#28483f";
      atlasContext.font = "45px monospace";
      atlasContext.fillText(item.code, x + 70, y + 280);
    }
    atlas.needsUpdate = true;
    invalidate();
  };
  const artGeometry = new T.PlaneGeometry(1.25, 1.58);
  const atlasIndices = new Float32Array(count);
  artGeometry.setAttribute(
    "odImage",
    new T.InstancedBufferAttribute(atlasIndices, 1),
  );
  const artMaterial = new T.MeshBasicMaterial({ map: atlas });
  artMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute float odImage; varying float odImageIndex;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nodImageIndex=odImage;",
    );
    shader.fragmentShader =
      "varying float odImageIndex;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#ifdef USE_MAP\nvec2 odUV=vec2((vMapUv.x+mod(odImageIndex,4.0))/4.0,(vMapUv.y+floor(odImageIndex/4.0))/6.0);diffuseColor*=texture2D(map,odUV);\n#endif",
    );
  };
  const cores = new T.InstancedMesh(artGeometry, artMaterial, count);
  cores.instanceMatrix.setUsage(T.DynamicDrawUsage);
  cores.frustumCulled = false;
  scene.add(cores);
  let model = makeObject(itemAt(state.items, 0), false, (ok) => {
      host.dataset.imageState = ok ? "loaded" : "failed";
      invalidate();
    }),
    active = itemAt(state.items, 0).key;
  scene.add(model.object);
  model.object.visible = false;
  let alive = true,
    visible = true,
    contextLost = false,
    last = performance.now(),
    lastDraw = 0,
    elapsed = 0,
    lane = 0,
    row = 0,
    detail = 0,
    explode = 0,
    reveal = 0,
    turnX = 0,
    turnY = 0,
    zoom = 1;
  let quality = "",
    theme = "",
    composer: EffectComposer | null = null;
  const target = new T.Vector3(),
    aim = new T.Vector3(),
    cellMap: { lane: number; row: number }[] = [];
  const ray = new T.Raycaster(),
    pointer = new T.Vector2();
  const abort = new AbortController();
  function configure() {
    if (quality !== state.preferences.quality) {
      quality = state.preferences.quality;
      if (composer) {
        composer.passes.forEach((p) => p.dispose());
        composer.dispose();
        composer = null;
      }
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
        ao.kernelRadius = 3;
        ao.minDistance = 0.002;
        ao.maxDistance = 0.14;
        composer.addPass(ao);
        const dof = new BokehPass(scene, camera, {
          focus: 16,
          aperture: 0.000025,
          maxblur: 0.003,
        });
        composer.addPass(dof);
        composer.addPass(new OutputPass());
      }
      resize();
    }
    if (theme !== state.preferences.theme) {
      theme = state.preferences.theme;

      scene.background = new T.Color(theme === "light" ? 0xe7ebe7 : 0x121b23);
      bodyMaterial.color.set(theme === "light" ? 0xc3cdca : 0x8fa9b8);
    }
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    camera.aspect = Math.max(0.1, rect.width / Math.max(1, rect.height));
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    composer?.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
    invalidate();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    invalidate();
  });
  intersection.observe(host);
  function draw(now: number) {
    if (!alive || contextLost || document.hidden || !visible) {
      renderer.setAnimationLoop(null);
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (state.preferences.quality === "low" && now - lastDraw < 32) return;
    lastDraw = now;
    elapsed += dt;
    configure();
    const motion = state.preferences.motion,
      speed = motion ? 9 : 1000;
    lane = relax(lane, state.lane + state.offset.x, dt, speed);
    row = relax(row, state.row + state.offset.y, dt, speed);
    detail = relax(detail, state.mode === "browse" ? 0 : 1, dt, speed);
    explode = relax(explode, Number(state.exploded), dt, motion ? 6 : 1000);
    turnX = relax(turnX, state.rotation.x, dt, speed);
    turnY = relax(turnY, state.rotation.y, dt, speed);
    zoom = relax(zoom, state.zoom, dt, speed);
    const next = itemAt(state.items, state.row + state.lane).key;
    if (active !== next) {
      scene.remove(model.object);
      disposeObject(model.object);
      host.dataset.imageState = itemAt(state.items, state.row + state.lane)
        .image
        ? "loading"
        : "empty";
      model = makeObject(
        itemAt(state.items, state.row + state.lane),
        quality === "low",
        (ok) => {
          host.dataset.imageState = ok ? "loaded" : "failed";
          invalidate();
        },
      );
      scene.add(model.object);
      active = next;
      reveal = 0;
    }
    reveal =
      state.mode === "browse"
        ? 0
        : Math.min(1, reveal + dt / (motion ? 1.65 : 0.01));
    model.reveal.value = state.frosted ? 0 : reveal;
    progress(reveal);
    model.object.visible = detail > 0.002;
    body.visible = detail < 0.95;
    cores.visible = detail < 0.95;
    model.object.position.set(
      state.pan.x * detail,
      -1.1 + detail * 1.35 + state.pan.y,
      0,
    );
    model.object.rotation.set(
      (-Math.PI / 2) * (1 - detail) + turnX * detail,
      turnY * detail,
      0.12 * (1 - detail),
    );
    model.object.scale.setScalar(
      Math.max(0.01, detail) *
        (1 + itemAt(state.items, state.row + state.lane).variant * 0.025),
    );
    const depths = [-0.65, 1.65, 0.55, 0.1, -1.15, 2.2];
    model.pieces.forEach((part, i) => {
      part.position.z = depths[i] * explode;
      part.position.x = (i === 5 ? 0.3 : 0) * explode;
      part.scale.setScalar(state.highlight === i ? 1.045 : 1);
    });
    model.accent.emissiveIntensity = state.highlight === 2 ? 0.9 : 0.3;
    let index = 0;
    for (let x = -2; x <= 2; x++)
      for (let z = -6; z <= 6; z++) {
        const l = Math.round(lane) + x,
          r = Math.round(row) + z;
        cellMap[index] = { lane: l, row: r };
        const selected = l === state.lane && r === state.row;
        const wave = motion
          ? pulse(
              Math.hypot(l - state.lane, (r - state.row) * 0.65),
              (now - state.wave) / 1000,
            )
          : 0;
        const idle = motion
          ? Math.sin(elapsed * 0.65 + l + r * 0.7) * 0.025
          : 0;
        const lift = selected ? 0.28 : 0;
        dummy.position.set(
          (l - lane) * 1.85,
          -1.1 + wave + idle + lift - detail * 5,
          (r - row) * 0.68,
        );
        dummy.rotation.set(0, -0.22, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(index, dummy.matrix);
        dummy.position.y += 0.073;
        dummy.scale.setScalar(1);
        dummy.rotation.set(-Math.PI / 2, 0, -0.22);
        atlasIndices[index] = itemAt(state.items, r + l).id;
        dummy.updateMatrix();
        cores.setMatrixAt(index, dummy.matrix);
        body.setColorAt(
          index,
          new T.Color(
            selected
              ? 0xd8ebe8
              : wrap(l, 5) === wrap(state.lane, 5)
                ? 0x92aeb9
                : 0x53616d,
          ),
        );
        index++;
      }
    body.instanceMatrix.needsUpdate = true;
    cores.instanceMatrix.needsUpdate = true;
    artGeometry.attributes.odImage.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    const narrow = camera.aspect < 0.9;
    target.set(
      8 * (1 - detail) + 2.8 * detail,
      11 * (1 - detail) + 1.6 * detail,
      (13 * (1 - detail) + (narrow ? 7.8 : 5.8) * detail) / zoom,
    );
    camera.position.lerp(target, motion ? 1 - Math.exp(-dt * 9) : 1);
    aim.set(state.pan.x * detail, state.pan.y * detail, 0);
    camera.lookAt(aim);
    if (composer) {
      const bokeh = composer.passes.find((p) => p instanceof BokehPass) as
        BokehPass | undefined;
      if (bokeh)
        (bokeh.uniforms as Record<string, { value: number }>).focus.value =
          camera.position.distanceTo(aim);
      composer.render(dt);
    } else renderer.render(scene, camera);
    host.dataset.flatImage = String(
      model.picture.geometry.type === "PlaneGeometry",
    );
    host.dataset.explode = explode.toFixed(3);
    host.dataset.rotation = `${turnX.toFixed(3)},${turnY.toFixed(3)}`;
    host.dataset.frames = String(Number(host.dataset.frames || 0) + 1);
    if (
      !motion &&
      Math.abs(detail - Number(state.mode !== "browse")) < 0.0001 &&
      Math.abs(explode - Number(state.exploded)) < 0.0001 &&
      Math.abs(lane - state.lane) < 0.0001 &&
      Math.abs(row - state.row) < 0.0001 &&
      Math.abs(turnX - state.rotation.x) < 0.0001 &&
      Math.abs(turnY - state.rotation.y) < 0.0001 &&
      Math.abs(zoom - state.zoom) < 0.0001 &&
      camera.position.distanceTo(target) < 0.0001 &&
      reveal === (state.mode === "browse" ? 0 : 1)
    )
      renderer.setAnimationLoop(null);
  }
  function invalidate() {
    if (alive && !contextLost && visible && !document.hidden) {
      last = performance.now();
      renderer.setAnimationLoop(draw);
    }
  }
  document.addEventListener("visibilitychange", invalidate, {
    signal: abort.signal,
  });
  canvas.addEventListener(
    "webglcontextlost",
    (e) => {
      e.preventDefault();
      contextLost = true;
      renderer.setAnimationLoop(null);
      host.dataset.ready = "lost";
    },
    { signal: abort.signal },
  );
  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      contextLost = false;
      host.dataset.ready = "true";
      invalidate();
    },
    { signal: abort.signal },
  );
  function pick(x: number, y: number, open = false) {
    if (state.mode !== "browse") return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      (-(y - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(body)[0];
    const cell =
      hit?.instanceId !== undefined ? cellMap[hit.instanceId] : undefined;
    if (cell) onPick(cell.lane, cell.row, open);
  }
  for (const item of state.items) {
    atlasCell(item);
    if (item.image) {
      const image = new Image();
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
  host.dataset.imageState = itemAt(state.items, state.row + state.lane).image
    ? "loading"
    : "empty";
  configure();
  resize();
  host.dataset.ready = "true";
  invalidate();
  return {
    invalidate,
    pick,
    dispose() {
      if (!alive) return;
      alive = false;
      renderer.setAnimationLoop(null);
      abort.abort();
      observer.disconnect();
      intersection.disconnect();
      composer?.passes.forEach((p) => p.dispose());
      composer?.dispose();
      light.shadow.map?.dispose();
      environment.dispose();
      disposeObject(scene);
      (grid.geometry as T.BufferGeometry).dispose();
      [grid.material].flat().forEach((m) => m.dispose());
      renderer.dispose();
      host.dataset.ready = "false";
    },
  };
}
