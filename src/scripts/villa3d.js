// Viaggio 3D nella villa della foto aerea della home.
// La casa è ricostruita in proporzione dalla pianta della foto (1 px della foto 2000×1060 = 3 cm):
// volume principale a due piani, ala bassa con terrazza sul tetto, ala d'ingresso, piscina,
// vialetto, tettoia, muretti, rocce e alberi. Materiali fotografici PBR, cielo HDRI, arredi reali
// (asset CC0 Poly Haven in public/3d). Lo scroll porta la camera dalla vista dall'alto (identica
// alla foto) dentro le stanze: ogni stanza è una sezione della landing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const S = 0.03; // metri per pixel della foto
const P = (px, py) => [(px - 1108) * S, (py - 645) * S];
const BASE = '/3d/';
let seme = 7;
const rnd = (a, b) => { seme = (seme * 16807) % 2147483647; return a + ((seme - 1) / 2147483646) * (b - a); };

// UV in metri sulle facce di un box: la texture mantiene la sua scala reale su ogni superficie
function uvMondo(geo, w, h, d, tile) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + w / 2, y = pos.getY(i) + h / 2, z = pos.getZ(i) + d / 2;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x / tile, z / tile); else if (nx > 0.5) uv.setXY(i, z / tile, y / tile); else uv.setXY(i, x / tile, y / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

export function avviaVilla({ canvas, fotoSrc, onPronto }) {
  const mobile = window.matchMedia('(max-width: 750px)').matches || navigator.hardwareConcurrency <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b9cfe0');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.08, 600);
  const manager = new THREE.LoadingManager();
  const tl = new THREE.TextureLoader(manager);
  const gltf = new GLTFLoader(manager); gltf.setMeshoptDecoder(MeshoptDecoder);

  // cielo HDRI: sfondo e illuminazione d'ambiente/riflessi
  new RGBELoader(manager).load(BASE + 'hdri/cielo.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = hdr; scene.environment = hdr;
    scene.environmentIntensity = 0.75; scene.backgroundIntensity = 1;
  });

  // sole da nord-est come nella foto (ombre verso sud-ovest)
  const sole = new THREE.DirectionalLight('#fff1dc', 3.2);
  sole.position.set(30, 44, -24); sole.castShadow = true;
  sole.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
  Object.assign(sole.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
  sole.shadow.bias = -0.00025; sole.shadow.normalBias = 0.02; sole.shadow.radius = 3;
  scene.add(sole);
  scene.add(new THREE.HemisphereLight('#dbe7f5', '#4d5a33', 0.25));

  // ---------------------------------------------------------------- materiali PBR fotografici
  const pbr = (nome, opz = {}) => {
    const t = (k, srgb) => { const x = tl.load(`${BASE}texture/${nome}_${k}.webp`); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
    const arm = t('arm');
    const m = new THREE.MeshStandardMaterial({ normalMap: t('nor'), aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1, ...opz });
    if (opz.map !== null) m.map = t('diff', true);
    return m;
  };
  const M = {
    erba: pbr('erba', { vertexColors: true }),
    ghiaia: pbr('ghiaia'),
    piastre: pbr('piastre', { color: '#f7f6f2' }),
    intonaco: pbr('intonaco', { map: null, aoMap: null, color: '#f3f2ee', normalScale: new THREE.Vector2(0.25, 0.25) }),
    parquet: pbr('parquet'),
    roccia: pbr('roccia', { color: '#d8d6cf' }),
    marmo: pbr('marmo'),
    lino: pbr('tessuto', { map: null, color: '#e7e1d6' }),
    tessutoScuro: pbr('tessuto', { map: null, color: '#5d6655' }),
    bianco: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.7 }),
    infisso: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.35, metalness: 0.8 }),
    scuro: new THREE.MeshStandardMaterial({ color: '#2f2d2b', roughness: 0.45 }),
    ottone: new THREE.MeshStandardMaterial({ color: '#c09a5b', roughness: 0.25, metalness: 1 }),
    tronco: new THREE.MeshStandardMaterial({ color: '#4f3d2c', roughness: 0.95 }),
    vetro: new THREE.MeshPhysicalMaterial({ color: '#e4eef0', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6, specularIntensity: 1, clearcoat: 1 }),
    vasca: new THREE.MeshStandardMaterial({ color: '#6fbcc4', roughness: 0.3 }),
    luce: new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#ffe9c8', emissiveIntensity: 3 }),
  };
  // acqua: normali procedurali animate sopra un materiale fisico
  const ondeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#8080ff'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${110 + rnd(-20, 30)},${110 + rnd(-20, 30)},255,.35)`; g.lineWidth = rnd(1, 3); g.beginPath(); g.arc(rnd(0, 256), rnd(0, 256), rnd(5, 28), 0, 7); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
  })();
  M.acqua = new THREE.MeshPhysicalMaterial({ color: '#2a8f9c', roughness: 0.06, metalness: 0, normalMap: ondeTex, normalScale: new THREE.Vector2(0.2, 0.2), clearcoat: 0.25, clearcoatRoughness: 0.05, envMapIntensity: 0.35, transparent: true, opacity: 0.93 });

  const box = (w, h, d, mat, x, y, z, { ombra = true, ricevi = true, parent = scene, tile = 2 } = {}) => {
    const g = new THREE.BoxGeometry(w, h, d); if (mat.map || mat.normalMap) uvMondo(g, w, h, d, tile);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y + h / 2, z); m.castShadow = ombra; m.receiveShadow = ricevi; parent.add(m); return m;
  };
  const cil = (r1, r2, h, mat, x, y, z, seg = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };
  const rect = (x1, y1, x2, y2, h, mat, y = 0, opz) => { const [a, b] = P(x1, y1), [c, d] = P(x2, y2); return box(c - a, h, d - b, mat, (a + c) / 2, y, (b + d) / 2, opz); };

  // modelli reali: caricati una volta, clonati dove servono
  const modelli = {};
  const piazza = (id, x, y, z, rotY = 0, scala = 1) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(scala); scene.add(g);
    const metti = (src) => {
      const o = src.clone(true);
      o.traverse((n) => { if (!n.isMesh) return; n.castShadow = true; n.receiveShadow = true;
        // foglie ritagliate: copertura alfa con MSAA, così le chiome non spariscono da lontano
        if (n.material.alphaTest > 0 && !n.material.userData.ok) { n.material.alphaTest = 0.3; n.material.alphaToCoverage = !mobile; n.material.userData.ok = true; } });
      g.add(o);
    };
    if (modelli[id]?.scene) metti(modelli[id].scene);
    else { (modelli[id] ??= { attese: [] }).attese.push(metti); if (!modelli[id].avviato) { modelli[id].avviato = true; gltf.load(`${BASE}modelli/${id}.glb`, (r) => { modelli[id].scene = r.scene; modelli[id].attese.forEach((f) => f(r.scene)); }); } }
    return g;
  };

  // ---------------------------------------------------------------- terreno
  // la foto aerea stessa è il terreno (stessa pianta, 3 cm per pixel): prato, ombre e vialetto
  // identici alla foto; tutt'intorno un prato di raccordo e una sfumatura sui bordi della foto
  const fotoTex = tl.load(fotoSrc); fotoTex.colorSpace = THREE.SRGBColorSpace; fotoTex.anisotropy = 16;
  {
    const g = new THREE.PlaneGeometry(320, 320, 160, 160); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = [], uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = 0.5 + 0.25 * Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) + 0.2 * Math.sin(z * 0.11 - x * 0.05) + rnd(-0.05, 0.05);
      col.push(0.36 + n * 0.08, 0.47 + n * 0.08, 0.18 + n * 0.05);
      uv.setXY(i, x / 3, z / 3);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const prato = new THREE.MeshStandardMaterial({ vertexColors: true, normalMap: M.erba.normalMap, roughnessMap: M.erba.roughnessMap, roughness: 1 });
    const t = new THREE.Mesh(g, prato); t.position.y = -0.01; t.receiveShadow = true; scene.add(t);
    const bordi = document.createElement('canvas'); bordi.width = 512; bordi.height = 272;
    const b = bordi.getContext('2d'); b.fillStyle = '#000'; b.fillRect(0, 0, 512, 272);
    b.filter = 'blur(18px)'; b.fillStyle = '#fff'; b.fillRect(30, 30, 452, 212);
    const [a0, b0] = P(0, 0), [a1, b1] = P(2000, 1060);
    const foto = new THREE.Mesh(new THREE.PlaneGeometry(a1 - a0, b1 - b0), new THREE.MeshStandardMaterial({ map: fotoTex, alphaMap: new THREE.CanvasTexture(bordi), transparent: true, roughness: 0.95, depthWrite: false }));
    foto.rotation.x = -Math.PI / 2; foto.position.set((a0 + a1) / 2, 0.005, (b0 + b1) / 2); foto.receiveShadow = true; scene.add(foto);
  }
  // pavimentazione in pietra, piscina
  for (const r of [[940, 432, 1595, 918], [882, 393, 1263, 432], [905, 500, 940, 735]]) rect(...r, 0.15, M.piastre, 0, { ombra: false, tile: 2.4 });
  {
    const [a, b] = P(1265, 732), [c, d] = P(1525, 858);
    box(c - a, 0.03, d - b, M.vasca, (a + c) / 2, 0.14, (b + d) / 2, { ombra: false });
    const acqua = new THREE.Mesh(new THREE.PlaneGeometry(c - a - 0.25, d - b - 0.25), M.acqua);
    acqua.rotation.x = -Math.PI / 2; acqua.position.set((a + c) / 2, 0.165, (b + d) / 2); acqua.receiveShadow = true; scene.add(acqua);
  }
  for (const y of [495, 730]) rect(640, y - 5, 905, y + 5, 0.55, M.roccia, 0, { tile: 1 });
  // rocce: icosfere deformate con texture di roccia
  for (const [x, y, s] of [[812, 523, 1.1], [790, 548, 0.4], [722, 665, 0.95], [748, 682, 0.35]]) {
    const g = new THREE.IcosahedronGeometry(s, 3); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + 0.18 * Math.sin(p.getX(i) * 5.1 + p.getZ(i) * 3.3) + rnd(-0.05, 0.05); p.setXYZ(i, p.getX(i) * k * 1.3, p.getY(i) * k * 0.7, p.getZ(i) * k); }
    g.computeVertexNormals();
    const r = new THREE.Mesh(g, M.roccia); const [a, b] = P(x, y); r.position.set(a, s * 0.3, b); r.rotation.y = rnd(0, 3);
    r.castShadow = r.receiveShadow = true; scene.add(r);
  }
  // tettoia
  {
    const g = new THREE.Group(); const [a, b] = P(247, 182); g.position.set(a, 0, b); g.rotation.y = 0.62; scene.add(g);
    box(7.6, 0.25, 3.8, M.intonaco, 0, 2.6, 0, { parent: g }); box(7.4, 0.04, 3.6, M.ghiaia, 0, 0.01, 0, { parent: g, ombra: false });
    for (const [x, z] of [[-3.6, -1.7], [3.6, -1.7], [-3.6, 1.7], [3.6, 1.7]]) box(0.16, 2.6, 0.16, M.infisso, x, 0, z, { parent: g });
  }
  // alberi: chioma da cespugli fotogrammetrici su tronco
  const chiome = [];
  const albero = (px, py, r) => {
    const [x, z] = P(px, py);
    cil(0.1 * r, 0.16 * r, r * 0.8, M.tronco, x, 0, z, 10);
    piazza('shrub_02', x, r * 0.55, z, rnd(0, 6), r * 0.32);
    chiome.push([x, z, r]);
  };
  // chiome piene: carte di foglie con la texture fotografica del cespuglio, distribuite in un volume tondeggiante
  const fogliame = () => {
    let mat; modelli.shrub_02?.scene?.traverse((n) => { if (n.isMesh && !mat) mat = n.material; });
    if (!mat) return;
    const m = mat.clone(); m.side = THREE.DoubleSide; m.alphaTest = 0.35; m.alphaToCoverage = !mobile; m.color.set('#a9cf6a');
    const per = mobile ? 150 : 280, o = new THREE.Object3D();
    const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m, chiome.length * per); let k = 0;
    for (const [x, z, r] of chiome) for (let i = 0; i < per; i++) {
      const u = Math.pow(rnd(0, 1), 0.3), th = rnd(0, Math.PI * 2), ph = Math.acos(rnd(-1, 1));
      o.position.set(x + Math.sin(ph) * Math.cos(th) * r * u, r * 1.4 + Math.cos(ph) * r * 0.8 * u, z + Math.sin(ph) * Math.sin(th) * r * u);
      o.rotation.set(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3)); o.scale.setScalar(r * rnd(0.32, 0.55)); o.updateMatrix(); inst.setMatrixAt(k++, o.matrix);
    }
    inst.castShadow = inst.receiveShadow = true; scene.add(inst);
  };
  for (const [x, y, r] of [[530, 195, 2.1], [700, 190, 2.4], [1035, 180, 2.0], [1150, 125, 2.2], [1250, 205, 2.0], [1420, 110, 2.3], [1560, 290, 1.9], [1650, 405, 2.1],
    [345, 430, 2.2], [490, 440, 1.9], [255, 860, 2.4], [595, 850, 2.0], [720, 920, 2.3], [480, 935, 2.0], [1640, 905, 2.0], [1800, 880, 2.2], [1960, 300, 2.0], [80, 700, 2.2]]) albero(x, y, r);
  for (const [x, y, rot] of [[700, 515, 0], [700, 715, 0.4], [1560, 470, 1.6], [960, 420, 0.2]]) { const [a, b] = P(x, y); piazza('shrub_02', a, 0, b, rot, 0.45); }

  // ---------------------------------------------------------------- edifici
  const vetrata = (x1, z1, x2, z2, y0, y1, passo = 1.6) => {
    const L = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
    const g = new THREE.Group(); g.position.set(x1, 0, z1); g.rotation.y = -ang; scene.add(g);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(L, y1 - y0), M.vetro); v.position.set(L / 2, (y0 + y1) / 2, 0); g.add(v);
    const n = Math.max(1, Math.round(L / passo));
    for (let i = 0; i <= n; i++) box(0.045, y1 - y0, 0.07, M.infisso, (L / n) * i, y0, 0, { parent: g, ricevi: false });
    box(L, 0.05, 0.08, M.infisso, L / 2, y0, 0, { parent: g }); box(L, 0.05, 0.08, M.infisso, L / 2, y1 - 0.05, 0, { parent: g });
  };
  const parete = (x1, z1, x2, z2, y0, y1, aperture = [], sp = 0.3, mat = M.intonaco) => {
    const L = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
    const g = new THREE.Group(); g.position.set(x1, 0, z1); g.rotation.y = -ang; scene.add(g);
    let u = 0;
    for (const [a, b, ya, yb] of [...aperture].sort((p, q) => p[0] - q[0])) {
      if (a > u) box(a - u, y1 - y0, sp, mat, (u + a) / 2, y0, 0, { parent: g });
      if (ya > y0) box(b - a, ya - y0, sp, mat, (a + b) / 2, y0, 0, { parent: g });
      if (yb < y1) box(b - a, y1 - yb, sp, mat, (a + b) / 2, yb, 0, { parent: g });
      u = b;
    }
    if (u < L) box(L - u, y1 - y0, sp, mat, (u + L) / 2, y0, 0, { parent: g });
  };
  const solaio = (x1, z1, x2, z2, y, h, mat, buco) => {
    if (!buco) return box(x2 - x1, h, z2 - z1, mat, (x1 + x2) / 2, y, (z1 + z2) / 2);
    const [bx1, bz1, bx2, bz2] = buco;
    box(bx1 - x1, h, z2 - z1, mat, (x1 + bx1) / 2, y, (z1 + z2) / 2); box(x2 - bx2, h, z2 - z1, mat, (bx2 + x2) / 2, y, (z1 + z2) / 2);
    box(bx2 - bx1, h, bz1 - z1, mat, (bx1 + bx2) / 2, y, (z1 + bz1) / 2); box(bx2 - bx1, h, z2 - bz2, mat, (bx1 + bx2) / 2, y, (bz2 + z2) / 2);
  };
  const cornice = (x1, z1, x2, z2, y, h, sp = 0.2, mat = M.bianco) => {
    box(x2 - x1, h, sp, mat, (x1 + x2) / 2, y, z1 + sp / 2); box(x2 - x1, h, sp, mat, (x1 + x2) / 2, y, z2 - sp / 2);
    box(sp, h, z2 - z1, mat, x1 + sp / 2, y, (z1 + z2) / 2); box(sp, h, z2 - z1, mat, x2 - sp / 2, y, (z1 + z2) / 2);
  };
  const faretti = (x1, z1, x2, z2, y, passo = 1.8) => { // incassi luminosi nel soffitto
    for (let x = x1 + passo / 2; x < x2; x += passo) for (let z = z1 + passo / 2; z < z2; z += passo) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), M.luce); d.rotation.x = Math.PI / 2; d.position.set(x, y - 0.005, z); scene.add(d);
    }
  };
  const luce = (x, y, z, int = 5, dist = 8, col = '#ffd8a8') => { const l = new THREE.PointLight(col, int, dist, 2); l.position.set(x, y, z); scene.add(l); return l; };

  // materiali degli interni, dai progetti dello studio: resina grigio chiaro, laccato bianco,
  // noce, marmo Calacatta, pietra nera, tessuti tortora, velluto, laccati colorati, vetro ramato
  Object.assign(M, {
    resina: pbr('resina', { color: '#ebe9e4', normalScale: new THREE.Vector2(0.4, 0.4) }),
    laccato: new THREE.MeshPhysicalMaterial({ color: '#f4f3ef', roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    noce: pbr('parquet', { color: '#8c6448' }),
    pietraNera: new THREE.MeshStandardMaterial({ color: '#2a2a29', roughness: 0.6, normalMap: M.marmo.normalMap, normalScale: new THREE.Vector2(1.4, 1.4) }),
    tortora: new THREE.MeshPhysicalMaterial({ color: '#8d7f70', roughness: 0.95, sheen: 0.7, sheenColor: '#d9cdbd', sheenRoughness: 0.6, normalMap: M.lino.normalMap }),
    biancoTessile: new THREE.MeshPhysicalMaterial({ color: '#ecebe6', roughness: 0.95, sheen: 0.5, sheenColor: '#ffffff', normalMap: M.lino.normalMap }),
    grigioTessile: new THREE.MeshPhysicalMaterial({ color: '#b9b8b3', roughness: 0.95, sheen: 0.5, sheenColor: '#efefef', normalMap: M.lino.normalMap }),
    velluto: new THREE.MeshPhysicalMaterial({ color: '#5e3f27', roughness: 0.85, sheen: 1, sheenColor: '#d0a072', sheenRoughness: 0.45 }),
    verdeLacca: new THREE.MeshPhysicalMaterial({ color: '#2d5a27', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
    grigioLacca: new THREE.MeshPhysicalMaterial({ color: '#8f8a84', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
    cemento: pbr('resina', { color: '#a9a7a2' }),
    nero: new THREE.MeshStandardMaterial({ color: '#1e1e1e', roughness: 0.35, metalness: 0.7 }),
    rame: new THREE.MeshPhysicalMaterial({ color: '#c88a5d', metalness: 0.35, roughness: 0.08, transmission: mobile ? 0 : 0.55, thickness: 0.3, transparent: mobile, opacity: mobile ? 0.75 : 1 }),
    opalino: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, transmission: mobile ? 0 : 0.35, thickness: 0.4, emissive: '#fff0d8', emissiveIntensity: 0.9 }),
  });

  const Y0 = 0.15, H1 = 3.45, Y1 = 3.6, H2 = 6.9, YT = 7.2;
  const [mx1, mz1] = P(998, 425), [mx2, mz2] = P(1218, 865);
  box(mx2 - mx1, 0.04, mz2 - mz1, M.resina, 0, Y0, 0, { ombra: false, tile: 3 });
  solaio(mx1, mz1, mx2, mz2, H1, Y1 - H1, M.bianco, [1.3, 1.5, 3.1, 5.1]);
  box(mx2 - mx1, 0.04, 0.8 - mz1, M.parquet, 0, Y1, (mz1 + 0.8) / 2, { ombra: false, tile: 2.2 });
  solaio(mx1, 0.8, mx2, mz2, Y1, 0.04, M.resina, [1.3, 1.5, 3.1, 5.1]);
  solaio(mx1, mz1, mx2, mz2, H2, YT - H2, M.bianco);
  box(mx2 - mx1 - 0.4, 0.04, mz2 - mz1 - 0.4, new THREE.MeshStandardMaterial({ color: '#c8c7c2', roughness: 0.9, normalMap: M.piastre.normalMap }), 0, YT, 0, { ombra: false, tile: 2.4 });
  cornice(mx1, mz1, mx2, mz2, YT, 0.22, 0.24);
  for (const [a, b] of [[525, 578], [645, 690]]) { const [x1, z1] = P(1037, a), [x2, z2] = P(1050, b); box(x2 - x1, 0.1, z2 - z1, M.vetro, (x1 + x2) / 2, YT, (z1 + z2) / 2, { ombra: false }); }
  parete(mx1, mz1, mx2, mz1, Y0, YT);
  vetrata(mx1, mz2, mx2, mz2, Y0, H1); vetrata(mx1, mz2, mx2, mz2, Y1, H2);
  box(mx2 - mx1, 0.15, 0.3, M.intonaco, 0, H1, mz2 - 0.15);
  parete(mx1, mz1, mx1, mz2, Y0, YT, [[1.6, 7.4, Y0, 3.0], [8.2, 12.6, 0.9, H1 - 0.25], [1.2, 12.0, 4.3, 6.4]]);
  vetrata(mx1, mz1 + 8.2, mx1, mz1 + 12.6, 0.9, H1 - 0.25); vetrata(mx1, mz1 + 1.2, mx1, mz1 + 12.0, 4.3, 6.4);
  parete(mx2, mz1, mx2, mz2, Y0, YT, [[5.1, 7.6, Y0, 2.7], [9.6, 13.0, Y0, H1 - 0.2], [4.0, 6.2, Y1, 6.1], [7.0, 12.8, 4.3, 6.4]]);
  vetrata(mx2, mz1 + 9.6, mx2, mz1 + 13.0, Y0, H1 - 0.2); vetrata(mx2, mz1 + 7.0, mx2, mz1 + 12.8, 4.3, 6.4);
  parete(mx1, 0.8, mx2, 0.8, Y1, H2, [[1.6, 4.0, Y1, 6.0]], 0.15);
  faretti(mx1 + 0.4, mz1 + 0.4, mx2 - 0.4, mz2 - 0.4, H1); faretti(mx1 + 0.4, mz1 + 0.4, mx2 - 0.4, mz2 - 0.4, H2);
  // scala bianca a sbalzo con parapetto in vetro, come nei progetti dello studio
  for (let i = 0; i < 17; i++) box(1.5, 0.06, 0.3, M.laccato, 2.25, Y0 + 0.14 + i * 0.205, 5.0 - i * 0.215, { tile: 1 });
  box(0.02, 1.0, 3.6, M.vetro, 1.35, Y1, 3.3, { ombra: false }); box(1.8, 1.0, 0.02, M.vetro, 2.2, Y1, 1.45, { ombra: false });

  const [ex1, ez1] = P(1218, 492), [ex2, ez2] = P(1480, 735);
  box(ex2 - ex1, 0.04, ez2 - ez1, M.resina, (ex1 + ex2) / 2, Y0, (ez1 + ez2) / 2, { ombra: false, tile: 3 });
  box(ex2 - ex1, 0.25, ez2 - ez1, M.bianco, (ex1 + ex2) / 2, H1, (ez1 + ez2) / 2);
  box(ex2 - ex1, 0.04, ez2 - ez1, M.piastre, (ex1 + ex2) / 2, H1 + 0.25, (ez1 + ez2) / 2, { ombra: false, tile: 2.4 });
  cornice(ex1 - 0.2, ez1, ex2, ez2, H1 + 0.25, 1.0, 0.16);
  parete(ex1, ez1, ex2, ez1, Y0, H1);
  vetrata(ex2, ez1, ex2, ez2, Y0, H1); vetrata(ex1, ez2, ex2, ez2, Y0, H1);
  faretti(ex1 + 0.4, ez1 + 0.4, ex2 - 0.4, ez2 - 0.4, H1);

  const [wx1, wz1] = P(943, 492), [, wz2] = P(998, 742);
  box(mx1 - wx1, 0.04, wz2 - wz1, M.resina, (wx1 + mx1) / 2, Y0, (wz1 + wz2) / 2, { ombra: false, tile: 3 });
  box(mx1 - wx1 + 0.3, 0.3, wz2 - wz1, M.bianco, (wx1 + mx1) / 2, 3.3, (wz1 + wz2) / 2);
  cornice(wx1, wz1, mx1, wz2, 3.6, 0.15, 0.15);
  parete(wx1, wz1, mx1, wz1, Y0, 3.3); parete(wx1, wz2, mx1, wz2, Y0, 3.3);
  parete(wx1, wz1, wx1, wz2, Y0, 3.3, [[0.4, 7.1, Y0, 2.9]], 0.25);
  vetrata(wx1, wz1 + 0.4, wx1, wz1 + 7.1, Y0, 2.9, 1.2);

  // ---------------------------------------------------------------- arredi (stile e prodotti dello studio)
  const add = (geo, mat, x, y, z, { rx = 0, ry = 0, rz = 0, parent = scene } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const rb = (w, h, d, r, mat, x, y, z, opz) => add(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat, x, y + h / 2, z, opz);
  const gruppo = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; };

  // divano componibile basso (Fargo Soft / Kepler): moduli con cuscini separati su zoccolo
  const divano = (x, z, ry, moduli, mat, chaise = false) => {
    const g = gruppo(x, Y0, z, ry), w = 1.0, L = moduli * w;
    add(new THREE.BoxGeometry(L + 0.05, 0.1, 1.0), M.noce, 0, 0.05, 0, { parent: g });
    for (let i = 0; i < moduli; i++) {
      const cx = -L / 2 + w / 2 + i * w;
      add(new RoundedBoxGeometry(w - 0.02, 0.3, 0.98, 4, 0.06), mat, cx, 0.25, 0, { parent: g });
      add(new RoundedBoxGeometry(w - 0.04, 0.42, 0.24, 4, 0.08), mat, cx, 0.57, -0.36, { parent: g });
    }
    for (const s of [-1, 1]) add(new RoundedBoxGeometry(0.18, 0.5, 0.98, 4, 0.06), mat, s * (L / 2 + 0.06), 0.35, 0, { parent: g });
    if (chaise) { add(new THREE.BoxGeometry(w, 0.1, 0.9), M.noce, L / 2 - w / 2, 0.05, 0.95, { parent: g }); add(new RoundedBoxGeometry(w - 0.02, 0.3, 0.9, 4, 0.06), mat, L / 2 - w / 2, 0.25, 0.95, { parent: g }); }
    return g;
  };
  // tavolino tondo nero su base cilindrica (PTYX) e tavolino in cemento
  const ptyx = (x, y, z, r = 0.6) => { add(new THREE.CylinderGeometry(r, r, 0.035, 64), M.pietraNera, x, y + 0.33, z); add(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.31, 48), M.nero, x, y + 0.155, z); add(new THREE.CylinderGeometry(r * 0.32, r * 0.2, 0.05, 48), M.cemento, x, y + 0.37, z); };
  // pouf a ciottolo laccati (Plumpstones)
  const ciottolo = (x, y, z, s, mat, ry = 0) => { const m = add(new THREE.SphereGeometry(0.42, 48, 24), mat, x, y + 0.2 * s, z, { ry }); m.scale.set(1.25 * s, 0.5 * s, 0.85 * s); return m; };
  // lampada ad arco a stelo sottile
  const arco = (x, z, ry, h = 2.2) => {
    const g = gruppo(x, Y0, z, ry);
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 1.25, 0), new THREE.Vector3(1.6, h, 0));
    add(new THREE.TubeGeometry(c, 64, 0.011, 8), M.nero, 0, 0, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 48), M.nero, 0, 0.01, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 32), M.luce, 1.6, h - 0.02, 0, { parent: g });
    const l = new THREE.PointLight('#ffdcb0', 3, 5, 2); l.position.set(1.6, h - 0.15, 0); g.add(l);
  };
  // lampada a sfera opalina (BB 26/46)
  const sfera = (x, y, z, r = 0.16, int = 2.5) => { add(new THREE.SphereGeometry(r, 48, 32), M.opalino, x, y + r, z); add(new THREE.CylinderGeometry(r * 0.5, r * 0.6, 0.03, 32), M.nero, x, y + 0.015, z); const l = new THREE.PointLight('#ffe2b8', int, 4, 2); l.position.set(x, y + r, z); scene.add(l); };
  // pendente a sfera in vetro ramato
  const pendente = (x, y, z, r = 0.22) => { add(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 6), M.nero, x, y + r + 0.6, z); add(new THREE.SphereGeometry(r, 48, 32), M.rame, x, y, z); add(new THREE.SphereGeometry(0.04, 16, 12), M.luce, x, y, z); const l = new THREE.PointLight('#ffcf9a', 3, 5, 2); l.position.set(x, y - 0.05, z); scene.add(l); };
  // tavolo Moon Phase: piano in pietra nera, gambe cilindriche accoppiate
  const moonPhase = (x, z, ry, L = 2.4, P0 = 1.05) => {
    const g = gruppo(x, Y0, z, ry);
    add(new RoundedBoxGeometry(L, 0.05, P0, 4, 0.02), M.pietraNera, 0, 0.725, 0, { parent: g });
    for (const s of [-1, 1]) for (const t of [-1, 1]) add(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 40), M.pietraNera, s * (L / 2 - 0.35) + t * 0.11, 0.35, 0, { parent: g });
    return g;
  };
  // tavolo Organic: piano ovale in pietra nera su gambe sottili inclinate
  const organic = (x, y, z, ry, a = 1.2, b = 0.55) => {
    const g = gruppo(x, y, z, ry); const sh = new THREE.Shape(); sh.absellipse(0, 0, a, b, 0, Math.PI * 2);
    const top = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3, curveSegments: 64 }); top.rotateX(Math.PI / 2);
    add(top, M.pietraNera, 0, 0.76, 0, { parent: g });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.CylinderGeometry(0.012, 0.022, 0.75, 12), M.nero, sx * a * 0.62, 0.37, sz * b * 0.45, { rz: sx * 0.08, rx: -sz * 0.08, parent: g });
    return g;
  };
  // sedia Body: telaio metallico sottile, seduta e schienale imbottiti
  const sediaBody = (x, z, ry, mat = M.grigioTessile) => {
    const g = gruppo(x, Y0, z, ry);
    for (const sx of [-0.21, 0.21]) { add(new THREE.BoxGeometry(0.018, 0.9, 0.018), M.grigioLacca, sx, 0.45, -0.2, { parent: g }); add(new THREE.BoxGeometry(0.018, 0.45, 0.018), M.grigioLacca, sx, 0.225, 0.2, { parent: g }); add(new THREE.BoxGeometry(0.018, 0.018, 0.42), M.grigioLacca, sx, 0.44, 0, { parent: g }); }
    add(new RoundedBoxGeometry(0.44, 0.06, 0.44, 3, 0.02), mat, 0, 0.48, 0, { parent: g });
    add(new RoundedBoxGeometry(0.44, 0.4, 0.05, 3, 0.02), mat, 0, 0.72, -0.21, { parent: g });
    return g;
  };
  // poltrona a conchiglia in velluto (Labimba)
  const conchiglia = (x, y, z, ry, mat = M.velluto) => {
    const g = gruppo(x, y, z, ry);
    const prof = [[0, 0.22], [0.3, 0.2], [0.42, 0.28], [0.46, 0.42], [0.44, 0.58], [0.38, 0.68], [0.3, 0.62], [0.33, 0.45], [0.2, 0.36], [0, 0.34]].map(([r, h]) => new THREE.Vector2(r, h));
    add(new THREE.LatheGeometry(prof, 64), mat, 0, 0, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 24), M.nero, 0, 0.11, 0, { parent: g });
    return g;
  };
  // poltrona Soft Pill in cemento
  const pillola = (x, y, z, ry) => { const m = add(new THREE.CapsuleGeometry(0.36, 0.5, 12, 32), M.cemento, x, y + 0.36, z, { rz: Math.PI / 2, ry }); m.scale.set(1, 1, 1.15); add(new THREE.CapsuleGeometry(0.2, 0.45, 8, 24), M.cemento, x, y + 0.72, z - 0.18, { rz: Math.PI / 2, ry }); };
  // dipinti espressivi di grande formato, come nei progetti
  const tela = (w, h, toni) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.round((512 * h) / w); const g = c.getContext('2d');
    g.fillStyle = toni[0]; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 260; i++) { g.strokeStyle = toni[1 + (i % (toni.length - 1))] + Math.round(rnd(40, 200)).toString(16).padStart(2, '0'); g.lineWidth = rnd(4, 38); g.lineCap = 'round'; const x0 = c.width * (0.25 + rnd(0, 0.5)) + rnd(-140, 140), y0 = c.height * rnd(0.05, 0.95); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + rnd(-90, 90), y0 + rnd(-90, 90), x0 + rnd(-160, 160), y0 + rnd(-60, 60)); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  };
  const quadro = (x, y, z, w, h, ry, mat) => { const g = gruppo(x, y, z, ry); add(new THREE.BoxGeometry(w, h, 0.04), mat, 0, 0, 0, { parent: g }); return g; };
  const madia = (x, z, ry, L = 2.4, y = Y0) => { const g = gruppo(x, y, z, ry); add(new RoundedBoxGeometry(L, 0.55, 0.5, 2, 0.01), M.noce, 0, 0.47, 0, { parent: g }); for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.2, 0.42), M.nero, s * (L / 2 - 0.1), 0.1, 0, { parent: g }); for (let i = 1; i < 4; i++) add(new THREE.BoxGeometry(0.004, 0.5, 0.005), M.scuro, -L / 2 + (L / 4) * i, 0.47, 0.25, { parent: g }); return g; };

  // SOGGIORNO — angolo divano tortora su tappeto, tavolini neri, pouf laccati, madia in noce, ritratto
  box(4.2, 0.012, 3.0, M.grigioTessile, -0.6, Y0 + 0.04, 3.7, { ombra: false, tile: 1 });
  divano(-0.6, 5.1, Math.PI, 3, M.tortora, true);
  ptyx(-0.9, Y0, 3.6, 0.6); ptyx(0.3, Y0, 3.3, 0.35);
  ciottolo(-2.4, Y0, 3.2, 1, M.verdeLacca, 0.4); ciottolo(-2.0, Y0, 2.4, 0.75, M.grigioLacca, 1.2);
  arco(-2.8, 5.4, -0.5);
  madia(-3.05, -1.0, Math.PI / 2, 2.8);
  quadro(-3.13, 2.15, -1.0, 2.0, 1.4, Math.PI / 2, tela(2.0, 1.4, ['#e9e6e0', '#1d1d1d', '#d24a1c', '#6b6b6b']));
  sfera(-3.05, Y0 + 1.02, 0.1, 0.13, 1.5);
  piazza('potted_plant_02', -2.7, Y0, 1.2, 0, 1.45);
  // CUCINA — colonne laccate bianche, isola in Calacatta con pendenti a sfera ramati
  box(5.6, 2.6, 0.62, M.laccato, 0, Y0, -6.15);
  box(2.9, 0.88, 1.05, M.laccato, 0, Y0, -4.2); box(3.0, 0.05, 1.1, M.marmo, 0, Y0 + 0.88, -4.2, { tile: 2 });
  for (const s of [-1, 1]) box(0.05, 0.9, 1.1, M.marmo, s * 1.48, Y0, -4.2, { tile: 2 });
  for (const x of [-0.9, 0, 0.9]) { const g = gruppo(x, Y0, -3.45, Math.PI); add(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 32), M.tortora, 0, 0.72, 0, { parent: g }); add(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8), M.nero, 0, 0.35, 0, { parent: g }); add(new THREE.CylinderGeometry(0.18, 0.18, 0.01, 32), M.nero, 0, 0.005, 0, { parent: g }); }
  for (const x of [-0.75, 0.75]) pendente(x, 2.2, -4.2, 0.24);
  luce(-0.6, 2.9, 3.6, 4, 8);

  // STUDIO — tavolo Moon Phase con sedie Body e plastico, scrivania in noce, la pianta della villa
  box(3.3, 1.8, 0.05, M.nero, 7.2, 0.95, ez1 + 0.18); box(3.2, 1.7, 0.02, new THREE.MeshStandardMaterial({ map: fotoTex, roughness: 0.5 }), 7.2, 1.0, ez1 + 0.215);
  moonPhase(6.6, 0.6, 0);
  for (const [dx, dz, r] of [[-0.6, -0.75, 0], [0.6, -0.75, 0], [-0.6, 0.75, Math.PI], [0.6, 0.75, Math.PI]]) sediaBody(6.6 + dx, 0.6 + dz, r);
  { const s = 0.05, y = Y0 + 0.775, cx = 6.6, cz = 0.6; // plastico in scala della villa
    box(6.6 * s, 7 * s, 13.2 * s, M.bianco, cx, y, cz); box(7.9 * s, 3.5 * s, 7.3 * s, M.bianco, cx + 7.2 * s, y, cz - 0.9 * s); box(1.6 * s, 3.3 * s, 7.5 * s, M.bianco, cx - 4.1 * s, y, cz - 0.8 * s); }
  box(2.2, 0.05, 0.85, M.noce, 9.4, Y0 + 0.72, -3.5, { tile: 1 }); for (const x of [8.4, 10.4]) box(0.04, 0.72, 0.8, M.nero, x, Y0, -3.5);
  piazza('desk_lamp_arm_01', 10.0, Y0 + 0.77, -3.7, -0.6); sediaBody(9.4, -2.75, Math.PI, M.tortora);
  madia(10.85, 0.3, -Math.PI / 2, 2.4); sfera(10.85, Y0 + 1.02, -0.4, 0.13, 1.5);
  piazza('potted_plant_02', 4.2, Y0, -3.9, 0.5, 1.5);
  luce(9.4, 2.6, -3.0, 3, 6); luce(6.6, 2.7, 0.6, 4, 7);

  // ZONA NOTTE — letto con testata imbottita tortora, poltrona in velluto, sfere sui comodini, ritratto
  rb(2.0, 0.28, 2.15, 0.02, M.noce, -0.6, Y1, -5.2);
  rb(1.85, 0.22, 2.0, 0.08, M.biancoTessile, -0.6, Y1 + 0.28, -5.15);
  rb(1.9, 0.05, 1.2, 0.02, M.tortora, -0.6, Y1 + 0.5, -4.65);
  for (const x of [-1.05, -0.15]) rb(0.75, 0.16, 0.42, 0.07, M.biancoTessile, x, Y1 + 0.5, -5.95);
  rb(2.6, 1.15, 0.14, 0.05, M.tortora, -0.6, Y1, -6.38);
  for (const x of [-2.15, 0.95]) { box(0.5, 0.42, 0.42, M.noce, x, Y1, -5.95); sfera(x, Y1 + 0.42, -5.95, 0.12, 2); }
  conchiglia(2.0, Y1, -2.7, -2.3); ciottolo(1.2, Y1, -3.3, 0.6, M.verdeLacca);
  box(3.8, 0.012, 2.8, M.grigioTessile, -0.6, Y1 + 0.04, -4.6, { ombra: false, tile: 1 });
  box(0.62, 2.7, 4.0, M.laccato, -3.0, Y1, -2.4);
  quadro(2.98, Y1 + 1.6, -4.4, 1.6, 1.15, -Math.PI / 2, tela(1.6, 1.15, ['#f0eee9', '#2a2a2a', '#7d8a95', '#c28a62']));
  luce(-0.6, 6.0, -4.2, 3, 7);

  // SHOWROOM — i prodotti dello studio su pedane illuminate
  const pedana = (x, z, w = 1.3) => box(w, 0.3, w, M.laccato, x, Y1, z);
  pedana(-2.0, 3.0, 1.5); organic(-2.0, Y1 + 0.3, 3.0, 0.3, 0.62, 0.32);
  pedana(-0.1, 2.3, 1.1); conchiglia(-0.1, Y1 + 0.3, 2.3, 0.5);
  pedana(-1.8, 5.5, 1.4); pillola(-1.8, Y1 + 0.3, 5.5, 0.4);
  pedana(0.5, 5.6, 1.1); ciottolo(0.35, Y1 + 0.3, 5.5, 0.9, M.verdeLacca, 0.3); ciottolo(0.75, Y1 + 0.3, 5.85, 0.6, M.grigioLacca, 1.1);
  sfera(-2.75, Y1 + 0.3, 3.55, 0.2, 2); sfera(-1.25, Y1 + 0.3, 2.45, 0.12, 1.5);
  arco(0.9, 3.8, 2.4, 2.0);
  quadro(-3.13, Y1 + 1.7, 4.0, 1.7, 1.2, Math.PI / 2, tela(1.7, 1.2, ['#efede8', '#151515', '#b8b2a8', '#8a2f1d']));
  for (const [x, z] of [[-2.0, 3.0], [-0.1, 2.3], [-1.8, 5.5], [0.5, 5.6]]) {
    const sp = new THREE.SpotLight('#fff3dc', 22, 6, 0.42, 0.55, 1.6); sp.position.set(x, H2 - 0.1, z); sp.target.position.set(x, Y1, z); scene.add(sp, sp.target);
  }

  // TERRAZZA — chaise longue a telaio sottile (Lost Island), tavolo da esterno, fioriere
  for (const z of [-3.4, -2.1]) {
    const g = gruppo(9.6, H1 + 0.29, z, -Math.PI / 2);
    for (const s of [-0.33, 0.33]) add(new THREE.BoxGeometry(0.02, 0.02, 1.9), M.grigioLacca, s, 0.28, 0, { parent: g });
    for (const s of [-0.9, 0.9]) for (const t of [-0.33, 0.33]) add(new THREE.BoxGeometry(0.02, 0.28, 0.02), M.grigioLacca, t, 0.14, s, { parent: g });
    add(new RoundedBoxGeometry(0.66, 0.1, 1.25, 3, 0.04), M.biancoTessile, 0, 0.34, 0.3, { parent: g });
    add(new RoundedBoxGeometry(0.66, 0.1, 0.65, 3, 0.04), M.biancoTessile, 0, 0.5, -0.62, { rx: -0.6, parent: g });
  }
  piazza('outdoor_table_chair_set_01', 6.2, H1 + 0.29, 0.6, Math.PI / 2);
  for (const x of [5.0, 10.4]) { box(0.8, 0.55, 0.8, M.cemento, x, H1 + 0.29, 1.95); piazza('potted_plant_02', x, H1 + 0.84, 1.95, x, 1.1); }

  // ---------------------------------------------------------------- percorso della camera
  // [posizione, punto guardato, fov, tappa?] — le tappe sono le stanze/sezioni della landing
  const fotoC = P(1000, 530);
  const K = [
    [[fotoC[0], 50.4, fotoC[1] + 0.001], [fotoC[0], 0, fotoC[1]], 35, true], // vista dall'alto = la foto
    [[-12, 30, 8], [-4, 0, 0], 42],
    [[-19, 6.5, -0.6], [-4, 1.6, -0.6], 52],
    [[-8.5, 1.7, -0.6], [-3, 1.6, -0.6], 58],
    [[-3.9, 1.65, -0.4], [0, 1.4, 2], 60],
    [[-2.3, 1.65, -1.6], [0.4, 1.0, 4.6], 62, true], // soggiorno
    [[1.6, 1.65, -0.9], [6, 1.5, -0.9], 62],
    [[4.3, 1.65, -0.4], [9, 1.4, -2], 62],
    [[4.9, 1.65, 1.9], [9.6, 1.2, -2.6], 62, true], // studio
    [[3.6, 1.65, 1.6], [2.2, 1.7, 5], 62],
    [[2.2, 1.9, 5.3], [2.2, 3.8, 2], 64],
    [[2.2, 3.6, 3.4], [2.0, 5.2, 0], 64],
    [[1.9, 5.15, 1.6], [0, 5.0, -1], 64],
    [[-0.4, 5.15, 0.2], [-0.8, 4.3, -5.6], 62, true], // zona notte
    [[1.5, 5.15, -1.2], [6, 5.0, -1.2], 62],
    [[4.4, 5.2, -1.2], [9, 5.0, -2.5], 62],
    [[12.6, 5.7, 0.4], [6, 3.5, 3], 60],
    [[14.2, 4.6, 5.2], [2.6, 2.6, 2.6], 56, true], // terrazza: l'architettura, la piscina e le facciate vetrate
    [[12.6, 5.7, 0.4], [6, 4.5, -1], 60],
    [[4.4, 5.2, -1.0], [0, 5.1, 0.5], 62],
    [[0.6, 5.15, -0.2], [-0.6, 5.0, 3], 62],
    [[-2.7, 5.2, 0.9], [0.4, 4.3, 5.8], 62, true], // showroom
    [[-0.8, 5.3, 5.6], [0.5, 5, 12], 60],
    [[0.5, 7.5, 11], [1, 2, 0], 52],
    [[12, 17, 25], [3, 1, 0], 42, true], // giardino / uscita
  ];
  const posC = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k[0])), false, 'centripetal');
  const lookC = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');
  const n = K.length - 1;
  const tappe = K.map((k, i) => (k[3] ? i / n : null)).filter((v) => v !== null);
  const fovAt = (t) => { const f = t * n, i = Math.min(n - 1, Math.floor(f)); return THREE.MathUtils.lerp(K[i][2], K[i + 1][2], f - i); };

  // ---------------------------------------------------------------- rendering (con occlusione ambientale)
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (!mobile) {
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 12 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());

  let tAtt = 0, tTarget = 0;
  const dir = new THREE.Vector3(), look = new THREE.Vector3();
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize); resize();

  const colloca = (t) => {
    posC.getPoint(t, camera.position); lookC.getPoint(t, look);
    dir.subVectors(look, camera.position).normalize();
    const k = THREE.MathUtils.smoothstep(-dir.y, 0.85, 0.995); // in verticale l'alto dell'immagine è il nord, come nella foto
    camera.up.set(0, 1 - k, -k).normalize();
    camera.lookAt(look);
    camera.fov = fovAt(t) * (camera.aspect < 1 && fovAt(t) > 45 ? 1.3 : 1); camera.updateProjectionMatrix();
  };
  const orologio = new THREE.Clock();
  let attivo = true, pronto = false;
  const ciclo = () => {
    if (!attivo) return;
    const dt = Math.min(0.05, orologio.getDelta());
    tAtt += (tTarget - tAtt) * Math.min(1, dt * 4.5);
    colloca(tAtt);
    ondeTex.offset.x += dt * 0.015; ondeTex.offset.y += dt * 0.01;
    composer.render();
    requestAnimationFrame(ciclo);
  };
  if (import.meta.env?.DEV) window.__villa3d = { scene, camera, modelli };
  manager.onLoad = () => { if (pronto) return; pronto = true; fogliame(); renderer.compile(scene, camera); onPronto?.(); };
  colloca(0); requestAnimationFrame(ciclo);

  return {
    tappe,
    vai(t) { tTarget = THREE.MathUtils.clamp(t, 0, 1); },
    salta(t) { tAtt = tTarget = t; },
    stop() { attivo = false; renderer.dispose(); },
  };
}
