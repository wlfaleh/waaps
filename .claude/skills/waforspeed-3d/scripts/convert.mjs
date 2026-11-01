// Convertit un modèle (glb, gltf, ou glb en base64 .b64.txt) en glTF JSON autonome pour WaForSpeed.
// usage : node convert.mjs entree sortie.json [triangles=110000] [texture=1024]
//   variables : SERR=0.003 (erreur de simplification), NOLOCK=1 (bords non verrouillés)
// dépendances : npm i @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0 sharp@0.33.5
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsTransmission, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, dequantize, flatten, join } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const [,, inp, out, target = '110000', maxTex = '1024'] = process.argv;
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let doc;
if (inp.endsWith('.b64.txt')) doc = await io.readBinary(new Uint8Array(Buffer.from(fs.readFileSync(inp, 'utf8'), 'base64')));
else doc = await io.read(inp);
const root = doc.getRoot();
// glass: transmission -> simple transparency (three r128 + composer)
for (const m of root.listMaterials()) {
  const t = m.getExtension('KHR_materials_transmission');
  if (t && t.getTransmissionFactor() > 0.1) { m.setAlphaMode('BLEND'); const c = m.getBaseColorFactor(); m.setBaseColorFactor([c[0], c[1], c[2], Math.min(c[3], 0.35)]); }
  m.setExtension('KHR_materials_transmission', null);
}
for (const e of root.listExtensionsUsed()) if (['KHR_materials_transmission', 'EXT_meshopt_compression', 'KHR_materials_volume', 'KHR_draco_mesh_compression'].includes(e.extensionName)) e.dispose();
for (const me of root.listMeshes()) for (const p of me.listPrimitives()) if (p.getMode() !== 4) p.dispose();
const tris = () => { let n = 0; for (const me of root.listMeshes()) for (const p of me.listPrimitives()) { const i = p.getIndices(); n += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } return n; };
const before = tris();
await doc.transform(dequantize(), dedup(), weld());
const ratio = Math.min(1, +target / tris());
if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: +(process.env.SERR||0.0008), lockBorder: !process.env.NOLOCK }));
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+maxTex, +maxTex], quality: 82 }), prune(), dedup());
console.log(inp, 'tris', before, '->', tris());
// write JSON with embedded data URIs
const { json, resources } = await io.writeJSON(doc, { format: 'gltf', basename: 'm' });
const uri = (name, mime) => `data:${mime};base64,` + Buffer.from(resources[name]).toString('base64');
for (const b of json.buffers || []) if (b.uri) b.uri = uri(b.uri, 'application/octet-stream');
for (const im of json.images || []) if (im.uri) { im.uri = uri(im.uri, im.mimeType || 'image/webp'); }
fs.writeFileSync(out, JSON.stringify(json));
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
