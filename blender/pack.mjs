// Compress the raw zone GLBs from the Blender build (blender/out/*.glb) into
// the site's models (src/models/*.glb):
// - baked materials (baked_*) become KHR_materials_unlit and drop their normals,
// - textures become KTX2 (Basis ETC1S, with mipmaps),
// - geometry is quantized and Meshopt-compressed.
//
//   cd blender && npm install && node pack.mjs [zone ...]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { dedup, prune, reorder, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(HERE, 'out');
const OUT = path.join(HERE, '..', 'src', 'models');

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// Baked lighting is the whole look: unlit, no normals needed.
function unlitBaked(doc) {
  const unlit = doc.createExtension(KHRMaterialsUnlit);
  for (const material of doc.getRoot().listMaterials()) {
    if (!material.getName().startsWith('baked_')) continue;
    material.setExtension('KHR_materials_unlit', unlit.createUnlit());
    material.setRoughnessFactor(1).setMetallicFactor(0);
  }
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      if (m && m.getName().startsWith('baked_')) prim.setAttribute('NORMAL', null);
    }
  }
}

// the Basis encoder wants raw RGBA
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

const zones = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(IN).filter((f) => f.endsWith('.glb')).map((f) => f.replace(/\.glb$/, ''));

fs.mkdirSync(OUT, { recursive: true });
for (const zone of zones) {
  const t0 = Date.now();
  const doc = await io.read(path.join(IN, `${zone}.glb`));
  unlitBaked(doc);
  await doc.transform(
    dedup(),
    weld(),
    ktx2({ isUASTC: false, qualityLevel: 200, compressionLevel: 2, generateMipmap: true, isSetKTX2SRGBTransferFunc: true, imageDecoder }),
    prune({ keepExtras: true }),
    reorder({ encoder: MeshoptEncoder }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const file = path.join(OUT, `${zone}.glb`);
  await io.write(file, doc);
  console.log(`${zone}: ${(fs.statSync(file).size / 1e6).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
