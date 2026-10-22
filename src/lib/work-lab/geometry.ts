import type { WorkLabConfig } from "../../../supabase/functions/_shared/work-lab-config.ts";
import * as T from "three";
import type { LabItem } from "./state";
export function makeObject(
  item: LabItem,
  low = false,
  textureReady: (ok: boolean) => void = () => {},
) {
  const object = new T.Group(),
    pieces = Array.from({ length: 6 }, () => new T.Group());
  const metal = new T.MeshStandardMaterial({
    color: 0xe1dcd1,
    metalness: 0.7,
    roughness: 0.23,
  });
  const substrate = new T.MeshStandardMaterial({
    color: 0xc4beb2,
    metalness: 0.28,
    roughness: 0.36,
  });
  const accent = new T.MeshStandardMaterial({
    color: 0x8b8d88,
    emissive: 0x51544d,
    emissiveIntensity: 0.2,
    metalness: 0.35,
    roughness: 0.22,
  });
  const reveal = { value: 1 };
  const glass = new T.MeshPhysicalMaterial({
    color: 0xfffdf5,
    transmission: low ? 0 : 0.97,
    transparent: low,
    opacity: low ? 0.12 : 1,
    roughness: 0.045,
    thickness: 0.018,
    ior: 1.16,
    clearcoat: 0.2,
    envMapIntensity: 0.22,
  });
  glass.onBeforeCompile = (shader) => {
    shader.uniforms.odReveal = reveal;
    shader.vertexShader = "varying float odHeight;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nodHeight = position.y / 2.8 + 0.5;",
    );
    shader.fragmentShader =
      "uniform float odReveal; varying float odHeight;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nfloat odClear = smoothstep(0.0, 0.18, odReveal * 1.18 - (1.0 - odHeight)); roughnessFactor = mix(0.6, 0.045, odClear);",
    );
  };
  glass.customProgramCacheKey = () => "outdesign-height-reveal-v1";
  const add = (
    part: number,
    geometry: T.BufferGeometry,
    material: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = part !== 1 && part !== 2;
    mesh.receiveShadow = true;
    pieces[part].add(mesh);
    return mesh;
  };
  // A slim, original cassette. The artwork is always a single coplanar print.
  for (const x of [-1.13, 1.13])
    add(0, new T.BoxGeometry(0.035, 2.94, 0.22), metal, x);
  for (const y of [-1.45, 1.45])
    add(0, new T.BoxGeometry(2.29, 0.035, 0.22), metal, 0, y);
  add(1, new T.BoxGeometry(2.24, 2.88, 0.055), glass, 0, 0, 0.2);
  const pictureCanvas = document.createElement("canvas");
  pictureCanvas.width = 1536;
  pictureCanvas.height = 1313;
  const ctx = pictureCanvas.getContext("2d")!;
  const placeholder = () => {
    ctx.fillStyle = "#dfe6e0";
    ctx.fillRect(0, 0, 1536, 1313);
    ctx.strokeStyle = "#76948d";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(90 + i * 65, 100);
      ctx.lineTo(90 + i * 65, 1180);
      ctx.stroke();
    }
    ctx.fillStyle = "#263d3c";
    ctx.font = "48px monospace";
    ctx.fillText("YOUR NEXT WORK", 90, 640);
    ctx.font = "24px monospace";
    ctx.fillText(item.code, 90, 710);
  };
  placeholder();
  const texture = new T.CanvasTexture(pictureCanvas);
  texture.colorSpace = T.SRGBColorSpace;
  const printMaterial = new T.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: .01,
    toneMapped: false,
    side: T.DoubleSide,
  });
  // A coplanar print on the inner cassette face avoids refracting the cover art twice.
  // Its own feathered blur uses the same reveal progress as the physical lid.
  printMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.odPrintReveal = reveal;
    shader.vertexShader = "varying float odPrintY;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nodPrintY = position.y / 2.94 + 0.5;",
    );
    shader.fragmentShader =
      "uniform float odPrintReveal; varying float odPrintY;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
#ifdef USE_MAP
float odVisible = smoothstep(0.0, 0.18, odPrintReveal * 1.18 - (1.0 - odPrintY));
vec2 odSpread = vec2(0.018, 0.014) * (1.0 - odVisible);
vec4 odSharp = texture2D(map, vMapUv);
vec4 odSoft = (texture2D(map, vMapUv + odSpread) + texture2D(map, vMapUv - odSpread) + texture2D(map, vMapUv + vec2(odSpread.x, -odSpread.y)) + texture2D(map, vMapUv + vec2(-odSpread.x, odSpread.y))) * 0.25;
diffuseColor *= mix(odSoft, odSharp, odVisible);
#endif`,
    );
  };
  printMaterial.customProgramCacheKey = () =>
    "outdesign-coplanar-print-reveal-v1";

  const picture = add(
    2,
    new T.PlaneGeometry(3.44 / 1.5, 2.94),
    printMaterial,
    0,
    -0.04,
    0.234,
  );
  picture.name = "outdesign-flat-artwork";
  picture.scale.set(.64, .64, 1);
  if (item.image) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (object.userData.disposed) return;
      try {
        ctx.clearRect(0, 0, 1536, 1313);
        const scale = Math.min(
            1536 / image.naturalWidth,
            1313 / image.naturalHeight,
          ),
          w = image.naturalWidth * scale,
          h = image.naturalHeight * scale;
        ctx.drawImage(image, (1536 - w) / 2, (1313 - h) / 2, w, h);
        ctx.getImageData(0, 0, 1, 1);
        texture.needsUpdate = true;
        textureReady(true);
      } catch {
        placeholder();
        texture.needsUpdate = true;
        textureReady(false);
      }
    };
    image.onerror = () => {
      if (!object.userData.disposed) textureReady(false);
    };
    image.src = item.image;
  }
  const liner = add(
    3,
    new T.BoxGeometry(2.13, 2.73, 0.035),
    new T.MeshStandardMaterial({ color: 0xe1dcd1, roughness: 0.6 }),
    0,
    0,
    0.1,
  );
  add(4, new T.BoxGeometry(2.2, 2.84, 0.065), substrate, 0, 0, -0.14);
  for (const x of [-1.04, 1.04])
    for (const y of [-1.36, 1.36]) {
      const pin = add(
        5,
        new T.CylinderGeometry(0.035, 0.035, 0.12, 12),
        accent,
        x,
        y,
        0.25,
      );
      pin.rotation.x = Math.PI / 2;
    }
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 768;
  labelCanvas.height = 96;
  const labelCtx = labelCanvas.getContext("2d")!;
  labelCtx.clearRect(0, 0, 768, 96);
  labelCtx.fillStyle = "#41453f";
  labelCtx.font = "28px monospace";
  labelCtx.fillText(`OUTDESIGN / ${item.code}`, 24, 58);
  const label = new T.CanvasTexture(labelCanvas);
  label.colorSpace = T.SRGBColorSpace;
  add(
    5,
    new T.PlaneGeometry(1.2, 0.15),
    new T.MeshBasicMaterial({ map: label, transparent: true, alphaTest: .01, toneMapped: false }),
    -0.39,
    1.31,
    0.25,
  );
  pieces.forEach((piece, i) => {
    piece.userData.part = i;
    object.add(piece);
  });
  return { object, pieces, reveal, glass, accent, picture, metal, substrate, liner: liner.material as T.MeshStandardMaterial, labelCanvas, labelCtx, label, code: item.code };
}
export function disposeObject(root: T.Object3D) {
  root.userData.disposed = true;
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  root.traverse((node) => {
    if (!(node instanceof T.Mesh) && !(node instanceof T.LineSegments)) return;
    geometries.add(node.geometry);
    for (const material of [node.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof T.Texture) textures.add(value);
    }
    if (node instanceof T.InstancedMesh) node.dispose();
  });
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
  root.clear();
}

export function configureObject(model: ReturnType<typeof makeObject>, config: WorkLabConfig) {
  model.picture.scale.set(config.parameters.coverScale, config.parameters.coverScale, 1);
  model.metal.color.set(config.palette.frame);
  model.substrate.color.set(config.palette.back);
  model.liner.color.set(config.palette.liner);
  model.glass.color.set(config.palette.glass);
  model.accent.color.set(config.palette.accent);
  const darkKeys = ["darkFrame", "darkBack", "darkLiner", "darkGlass", "darkAccent"] as const;
  [model.metal, model.substrate, model.liner, model.glass, model.accent].forEach((material, i) => {
    material.userData.labBaseColor = material.color.clone();
    material.userData.labDarkColor = new T.Color(config.palette[darkKeys[i]]);
  });
}

export function applyObjectTheme(model: ReturnType<typeof makeObject>, amount: number) {
  [model.metal, model.substrate, model.liner, model.glass, model.accent].forEach((material) => {
    const base = material.userData.labBaseColor as T.Color | undefined;
    const dark = material.userData.labDarkColor as T.Color | undefined;
    if (base && dark) material.color.lerpColors(base, dark, amount);
  });
  const dark = amount > .5;
  if (model.object.userData.labelDark !== dark) {
    model.object.userData.labelDark = dark;
    model.labelCtx.clearRect(0, 0, 768, 96);
    model.labelCtx.fillStyle = dark ? "#d0d6db" : "#41453f";
    model.labelCtx.font = "28px monospace";
    model.labelCtx.fillText(`OUTDESIGN / ${model.code}`, 24, 58);
    model.label.needsUpdate = true;
  }
}
