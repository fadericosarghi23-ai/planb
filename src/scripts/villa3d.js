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

export function avviaVilla({ canvas, fotoSrc, stanze = [], onPronto }) {
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
    roccia: pbr('roccia', { color: '#d8d6cf' }),
    bianco: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.7 }),
    infisso: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.35, metalness: 0.8 }),
    scuro: new THREE.MeshStandardMaterial({ color: '#2f2d2b', roughness: 0.45 }),
    ottone: new THREE.MeshStandardMaterial({ color: '#c09a5b', roughness: 0.25, metalness: 1 }),
    tronco: new THREE.MeshStandardMaterial({ color: '#4f3d2c', roughness: 0.95 }),
    vetro: new THREE.MeshPhysicalMaterial({ color: '#dfe9ec', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6, specularIntensity: 1, clearcoat: 1 }),
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
      col.push(0.27 + n * 0.05, 0.38 + n * 0.06, 0.13 + n * 0.03);
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
  // prato in 3D: ciuffi d'erba mossi dal vento, colorati con il pixel della foto aerea sottostante
  // (dall'alto il prato resta identico alla foto, da vicino ha volume). Niente erba su ghiaia e pietra.
  const vento = { value: 0 };
  const prato = () => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = fotoSrc;
    img.decode().then(() => {
      const W = 500, H = 265, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
      const px = g.getImageData(0, 0, W, H).data;
      const [a0, b0] = P(0, 0), [a1, b1] = P(2000, 1060);
      const colore = (x, z) => {
        const u = Math.floor(((x - a0) / (a1 - a0)) * W), v = Math.floor(((z - b0) / (b1 - b0)) * H);
        if (u < 0 || v < 0 || u >= W || v >= H) return null;
        const i = (v * W + u) * 4; return [px[i], px[i + 1], px[i + 2]];
      };
      // ciuffo: 3 fili incrociati, rastremati verso la punta
      const filo = (rot) => {
        const b = new THREE.PlaneGeometry(0.035, 1, 1, 2); b.translate(0, 0.5, 0);
        const p = b.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * 0.92) + y * y * 0.06); }
        b.rotateY(rot); return b;
      };
      const parti = [filo(0), filo(Math.PI / 3), filo((2 * Math.PI) / 3)];
      const pos = [], uv = [], idx = []; let off = 0;
      for (const b of parti) { pos.push(...b.attributes.position.array); uv.push(...b.attributes.uv.array); idx.push(...b.index.array.map((x) => x + off)); off += b.attributes.position.count; }
      const ciuffo = new THREE.BufferGeometry();
      ciuffo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ciuffo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ciuffo.setIndex(idx); ciuffo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1, metalness: 0, envMapIntensity: 0.4 });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.vento = vento;
        sh.vertexShader = 'uniform float vento;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float pieg = uv.y * uv.y;
          transformed.x += pieg * (0.08 * sin(vento * 1.7 + ip.x * 0.35 + ip.z * 0.21) + 0.04 * sin(vento * 3.1 + ip.z * 0.9));
          transformed.z += pieg * 0.05 * cos(vento * 1.3 + ip.x * 0.27);`);
        // base più scura (ombra tra i fili), punta più chiara
        sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.7, 0.98, vUv.y);');
        sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vUv = uv;');
        sh.vertexShader = 'varying vec2 vUv;\n' + sh.vertexShader; sh.fragmentShader = 'varying vec2 vUv;\n' + sh.fragmentShader;
      };
      const N = mobile ? 90000 : 360000, R = 30, cx = 0, cz = 2;
      const erba = new THREE.InstancedMesh(ciuffo, mat, N); const o = new THREE.Object3D(); const col = new THREE.Color();
      let k = 0, tent = 0;
      while (k < N && tent < N * 4) {
        tent++;
        const r = R * Math.sqrt(rnd(0, 1)), an = rnd(0, Math.PI * 2), x = cx + Math.cos(an) * r, z = cz + Math.sin(an) * r;
        if (x > -6.9 && x < 14.7 && z > -7.7 && z < 8.3) continue; // pavimentazione e casa
        const cc = colore(x, z) || [rnd(70, 92), rnd(98, 122), rnd(34, 48)]; // oltre la foto: prato di raccordo
        const [rr, gg, bb] = cc;
        if (!(gg > rr * 0.95 && gg > bb * 1.05)) continue; // solo dove la foto è prato
        o.position.set(x, 0, z); o.rotation.set(0, rnd(0, 6.3), 0);
        const h = rnd(0.07, 0.15); o.scale.set(rnd(1.2, 1.8), h, 1); o.updateMatrix();
        erba.setMatrixAt(k, o.matrix);
        col.setRGB(rr / 255, gg / 255, bb / 255, THREE.SRGBColorSpace).multiplyScalar(rnd(0.9, 1.15)); erba.setColorAt(k, col);
        k++;
      }
      erba.count = k; erba.receiveShadow = true; erba.frustumCulled = false; scene.add(erba);
    });
  };
  const fogliame = () => {
    let mat; modelli.shrub_02?.scene?.traverse((n) => { if (n.isMesh && !mat && (n.material.alphaTest > 0 || n.material.transparent || n.material.alphaMap)) mat = n.material; });
    if (!mat) return;
    const m = mat.clone(); m.side = THREE.DoubleSide; m.alphaTest = 0.45; m.alphaToCoverage = !mobile; m.color.set('#b4d47a');
    // maschera tonda e frastagliata: ogni carta diventa un ciuffo di foglie invece di un quadrato
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let i = 0; i < 70; i++) { const r = rnd(6, 20), an = rnd(0, 6.3), d = rnd(0, 40); g.fillStyle = '#fff'; g.beginPath(); g.arc(64 + Math.cos(an) * d, 64 + Math.sin(an) * d, r, 0, 7); g.fill(); }
    m.alphaMap = new THREE.CanvasTexture(c);
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

  Object.assign(M, {
    resina: pbr('resina', { color: '#ebe9e4', normalScale: new THREE.Vector2(0.4, 0.4) }),
    laccato: new THREE.MeshPhysicalMaterial({ color: '#f4f3ef', roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
  });


  const Y0 = 0.15, H1 = 3.45, Y1 = 3.6, H2 = 6.9, YT = 7.2;
  const [mx1, mz1] = P(998, 425), [mx2, mz2] = P(1218, 865);
  box(mx2 - mx1, 0.04, mz2 - mz1, M.resina, 0, Y0, 0, { ombra: false, tile: 3 });
  solaio(mx1, mz1, mx2, mz2, H1, Y1 - H1, M.bianco, [1.3, 1.5, 3.1, 5.1]);
  box(mx2 - mx1, 0.04, 0.8 - mz1, M.resina, 0, Y1, (mz1 + 0.8) / 2, { ombra: false, tile: 3 });
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

  const [ex1, ez1] = P(1218, 492), [ex2, ez2] = P(1480, 735);
  box(ex2 - ex1, 0.04, ez2 - ez1, M.resina, (ex1 + ex2) / 2, Y0, (ez1 + ez2) / 2, { ombra: false, tile: 3 });
  box(ex2 - ex1, 0.25, ez2 - ez1, M.bianco, (ex1 + ex2) / 2, H1, (ez1 + ez2) / 2);
  box(ex2 - ex1, 0.04, ez2 - ez1, M.piastre, (ex1 + ex2) / 2, H1 + 0.25, (ez1 + ez2) / 2, { ombra: false, tile: 2.4 });
  cornice(ex1 - 0.2, ez1, ex2, ez2, H1 + 0.25, 1.0, 0.16);
  parete(ex1, ez1, ex2, ez1, Y0, H1);
  vetrata(ex2, ez1, ex2, ez2, Y0, H1); vetrata(ex1, ez2, ex2, ez2, Y0, H1);

  const [wx1, wz1] = P(943, 492), [, wz2] = P(998, 742);
  box(mx1 - wx1, 0.04, wz2 - wz1, M.resina, (wx1 + mx1) / 2, Y0, (wz1 + wz2) / 2, { ombra: false, tile: 3 });
  box(mx1 - wx1 + 0.3, 0.3, wz2 - wz1, M.bianco, (wx1 + mx1) / 2, 3.3, (wz1 + wz2) / 2);
  cornice(wx1, wz1, mx1, wz2, 3.6, 0.15, 0.15);
  parete(wx1, wz1, mx1, wz1, Y0, 3.3); parete(wx1, wz2, mx1, wz2, Y0, 3.3);
  parete(wx1, wz1, wx1, wz2, Y0, 3.3, [[0.4, 7.1, Y0, 2.9]], 0.25);
  vetrata(wx1, wz1 + 0.4, wx1, wz1 + 7.1, Y0, 2.9, 1.2);

  // ---------------------------------------------------------------- stanze fotografiche
  // Ogni stanza è un volume 3D dentro la villa su cui è proiettato un render dello studio dal punto in
  // cui è stato inquadrato: quando la camera arriva in quel punto la stanza è identica alla foto,
  // avvicinandosi e allontanandosi ha profondità. Il lato verso la vetrata è aperto: si entra in volo.
  const vsProiezione = `varying vec4 vP; uniform mat4 projVP;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = projVP * w; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const fsProiezione = `varying vec4 vP; uniform sampler2D map;
    void main() { vec2 uv = vP.w > 0.0 ? clamp(vP.xy / vP.w * 0.5 + 0.5, 0.002, 0.998) : vec2(0.5);
      gl_FragColor = texture2D(map, uv);
      #include <colorspace_fragment>
    }`;
  const LATI = { 'x+': 0, 'x-': 1, 'y+': 2, 'y-': 3, 'z+': 4, 'z-': 5 }; // ordine dei gruppi di BoxGeometry
  const stanzeFoto = [];
  for (const s of stanze) {
    const [x1, x2, y1, y2, z1, z2] = s.box;
    const tex = tl.load(s.src); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    const proj = new THREE.PerspectiveCamera(s.fov, s.w / s.h, 0.05, 100);
    proj.position.set(...s.pos); proj.lookAt(...s.guarda); proj.updateMatrixWorld(); proj.updateProjectionMatrix();
    const projVP = new THREE.Matrix4().multiplyMatrices(proj.projectionMatrix, proj.matrixWorldInverse);
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, projVP: { value: projVP } }, vertexShader: vsProiezione, fragmentShader: fsProiezione, side: THREE.BackSide });
    const vuoto = new THREE.MeshBasicMaterial({ visible: false });
    const mats = Array(6).fill(mat); mats[LATI[s.aperta]] = vuoto;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1), mats);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); scene.add(m);
    stanzeFoto.push(new THREE.Box3(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)));
  }
  const dentroStanza = (p) => stanzeFoto.some((b) => b.containsPoint(p));

  // ingresso: lampade a parete accanto alla porta vetrata nella facciata ovest
  for (const z of [-2.2, 0.9]) { box(0.06, 0.32, 0.12, M.infisso, wx1 - 0.08, 2.1, z); const l = new THREE.PointLight('#ffd9a8', 2, 4, 2); l.position.set(wx1 - 0.3, 2.2, z); scene.add(l); }
  // terrazza: chaise longue a telaio sottile, tavolo da esterno, fioriere
  const lacca = new THREE.MeshPhysicalMaterial({ color: '#8f8a84', roughness: 0.25, clearcoat: 1 });
  const cuscino = new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.95 });
  for (const z of [-3.4, -2.1]) {
    const g = new THREE.Group(); g.position.set(9.6, H1 + 0.29, z); g.rotation.y = -Math.PI / 2; scene.add(g);
    for (const s of [-0.33, 0.33]) box(0.02, 0.02, 1.9, lacca, s, 0.27, 0, { parent: g });
    for (const s of [-0.9, 0.9]) for (const t of [-0.33, 0.33]) box(0.02, 0.28, 0.02, lacca, t, 0, s, { parent: g });
    const c1 = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.1, 1.25, 3, 0.04), cuscino); c1.position.set(0, 0.34, 0.3); c1.castShadow = true; g.add(c1);
    const c2 = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.1, 0.65, 3, 0.04), cuscino); c2.position.set(0, 0.5, -0.62); c2.rotation.x = -0.6; c2.castShadow = true; g.add(c2);
  }
  piazza('outdoor_table_chair_set_01', 6.2, H1 + 0.29, 0.6, Math.PI / 2);
  for (const x of [5.0, 10.4]) { box(0.8, 0.55, 0.8, M.scuro, x, H1 + 0.29, 1.95); piazza('potted_plant_02', x, H1 + 0.84, 1.95, x, 1.1); }
  // bordo piscina: lettini
  for (const x of [6.0, 8.2, 10.4]) {
    const g = new THREE.Group(); g.position.set(x, Y0, 7.25); scene.add(g);
    for (const s of [-0.3, 0.3]) box(0.02, 0.02, 1.9, lacca, s, 0.27, 0, { parent: g });
    const c = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.09, 1.85, 3, 0.04), cuscino); c.position.set(0, 0.33, 0); c.castShadow = true; g.add(c);
    for (const s of [-0.85, 0.85]) for (const t of [-0.3, 0.3]) box(0.02, 0.28, 0.02, lacca, t, 0, s, { parent: g });
  }

  // ---------------------------------------------------------------- percorso della camera
  // [posizione, punto guardato, fov, tappa?]: vista dall'alto identica alla foto → giro della villa
  // (tappa Architettura) → in volo dentro ogni stanza dalla sua vetrata, e fuori verso la successiva.
  // Nelle tappe delle stanze posizione, direzione e fov coincidono con quelli della proiezione.
  const fotoC = P(1000, 530);
  const st = (k) => { const s = stanze[k]; return s ? [s.pos, s.guarda, s.fov, true] : null; };
  const K = [
    [[fotoC[0], 50.4, fotoC[1] + 0.001], [fotoC[0], 0, fotoC[1]], 35, true],
    [[16, 12, 26], [3, 2, 1], 44],
    [[13.2, 1.9, 16.5], [4.0, 2.6, 2.0], 50, true],
    [[5, 1.75, 13], [0, 1.6, 4], 46],
    [[0, 1.55, 8.8], [0, 1.5, 0], 41],
    st(0),
    [[0.4, 1.7, 9.8], [4, 1.6, 4], 44],
    [[9.5, 1.8, 9.2], [12, 1.6, 2], 46],
    [[15.6, 1.6, -0.95], [10, 1.5, -0.95], 41],
    st(1),
    [[15.4, 2.6, -1.4], [10, 3, -3], 44],
    [[9, 6.5, -11.5], [0, 5, -4], 46],
    [[-8.5, 6, -11], [-4, 5, -3], 46],
    [[-9.5, 5.1, -2.9], [-3, 5, -2.9], 41],
    st(2),
    [[-9.5, 5.6, -1.2], [-3, 5, 3], 44],
    [[-6.5, 5.4, 10.5], [0, 5, 5], 44],
    [[0, 5.05, 9.2], [0, 4.95, 0], 42],
    st(3),
    [[0, 6.2, 11.5], [0, 4, 3], 46],
    [[-4, 3.2, 17], [2, 2, 4], 50],
    [[-7.5, 1.5, 17.5], [4.5, 1.9, 3.5], 50, true],
  ].filter(Boolean);


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
    // nelle stanze il render deve restare identico alla foto: niente tone mapping né occlusione
    const dentro = dentroStanza(camera.position);
    renderer.toneMapping = dentro ? THREE.NoToneMapping : THREE.AgXToneMapping;
    if (gtao) gtao.enabled = !dentro;
    vento.value += dt;
    ondeTex.offset.x += dt * 0.015; ondeTex.offset.y += dt * 0.01;
    composer.render();
    requestAnimationFrame(ciclo);
  };
  if (import.meta.env?.DEV) window.__villa3d = { scene, camera, modelli };
  manager.onLoad = () => { if (pronto) return; pronto = true; fogliame(); prato(); renderer.compile(scene, camera); onPronto?.(); };
  colloca(0); requestAnimationFrame(ciclo);

  return {
    tappe,
    vai(t) { tTarget = THREE.MathUtils.clamp(t, 0, 1); },
    salta(t) { tAtt = tTarget = t; },
    stop() { attivo = false; renderer.dispose(); },
  };
}
