// Compress the raw zone GLBs from the Blender build (blender/out/*.glb) into
// the site's models (src/models/):
// - material extras from the build become glTF factors (tint, roughness),
// - textures are resized (sizes chosen per material in the build) and
//   become KTX2 (Basis ETC1S, mipmapped; normal maps in normal-map mode),
// - geometry is quantized and Meshopt-compressed,
// - each lightmap (out/<zone>_<group>_lm.png) becomes src/models/<zone>_<group>.ktx2.
//
//   cd blender && npm install && node pack.mjs [zone ...]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, reorder, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { encodeToKTX2 } from 'ktx2-encoder';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(HERE, 'out');
const OUT = path.join(HERE, '..', 'src', 'models');

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// the Basis encoder wants raw RGBA
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

// tint / rough / metal set in the build (material extras) → glTF factors
function factors(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    const x = m.getExtras() || {};
    if (x.tint) m.setBaseColorFactor([...x.tint, 1]);
    if (x.rough) m.setRoughnessFactor(x.rough);
    if (x.metal) m.setMetallicFactor(x.metal);
    m.setExtras({});
  }
}

// texture sizes come from the build (material extras `tex`): the colour map
// at that size, normals at half, roughness / metal / AO at a quarter
async function resize(doc) {
  const size = new Map();
  const want = (t, px) => { if (t) size.set(t, Math.max(size.get(t) || 0, px)); };
  for (const m of doc.getRoot().listMaterials()) {
    const tex = (m.getExtras() || {}).tex || 256;
    want(m.getBaseColorTexture(), tex);
    want(m.getEmissiveTexture(), tex);
    want(m.getNormalTexture(), tex / 2);
    want(m.getMetallicRoughnessTexture(), tex / 4);
    want(m.getOcclusionTexture(), tex / 4);
  }
  for (const t of doc.getRoot().listTextures()) {
    const max = Math.max(64, size.get(t) || 256);
    const img = t.getImage();
    const { width, height } = await sharp(img).metadata();
    // fit inside max, keep the aspect, and land on multiples of 4 (Basis blocks)
    const k = Math.min(1, max / Math.max(width, height));
    const w = Math.max(4, Math.round((width * k) / 4) * 4), h = Math.max(4, Math.round((height * k) / 4) * 4);
    if (w === width && h === height) continue;
    t.setImage(await sharp(img).resize(w, h, { fit: 'fill' }).png().toBuffer()).setMimeType('image/png');
  }
}

const etc1s = { isUASTC: false, qualityLevel: 128, compressionLevel: 2, generateMipmap: true, imageDecoder };

const zones = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(IN).filter((f) => f.endsWith('.glb')).map((f) => f.replace(/\.glb$/, ''));

fs.mkdirSync(OUT, { recursive: true });
for (const zone of zones) {
  const t0 = Date.now();
  const doc = await io.read(path.join(IN, `${zone}.glb`));
  await resize(doc);
  factors(doc);
  await doc.transform(
    dedup(),
    weld(),
    ktx2({ ...etc1s, slots: /baseColor|emissive/, isSetKTX2SRGBTransferFunc: true }),
    ktx2({ ...etc1s, slots: /normal/, isNormalMap: true, isSetKTX2SRGBTransferFunc: false }),
    ktx2({ ...etc1s, isSetKTX2SRGBTransferFunc: false }),
    prune({ keepExtras: true, keepAttributes: true }),
    reorder({ encoder: MeshoptEncoder }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const file = path.join(OUT, `${zone}.glb`);
  await io.write(file, doc);
  let total = fs.statSync(file).size;
  // lightmaps: smooth, so ETC1S at high quality holds up
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(`${zone}_`) && f.endsWith('.ktx2')) fs.rmSync(path.join(OUT, f));
  for (const f of fs.readdirSync(IN).filter((f) => f.startsWith(`${zone}_`) && f.endsWith('_lm.png'))) {
    const data = await encodeToKTX2(fs.readFileSync(path.join(IN, f)), { ...etc1s, qualityLevel: 255, isSetKTX2SRGBTransferFunc: true });
    const lm = path.join(OUT, f.replace(/_lm\.png$/, '.ktx2'));
    fs.writeFileSync(lm, data);
    total += data.byteLength;
  }
  console.log(`${zone}: ${(total / 1e6).toFixed(2)} MB (model + lightmaps) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
