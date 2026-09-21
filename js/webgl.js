/* ============================================================
   SKYMARK — webgl.js
   one renderer, four worlds:
     city     the Lahore block model (hero + finale)
     terrain  ridges with flowing light lines
     points   a slow constellation you fly through
     cubes    a breathing grid of blocks
   scroll drives the camera, the veil cuts between worlds.
   ============================================================ */

import * as THREE from "three";

(() => {
  "use strict";

  const COL = {
    bg: 0x020a18,
    ink: 0xd5e0ff,
    blue1: 0x6eb4ff,
    blue2: 0x006eff,
    block: 0x050e1e,
    water: 0x030b18,
  };

  /* ---------------------------------------------------------- utils */

  /* tiny deterministic hash noise — good enough for terrain */
  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function vnoise(x, y) {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi),
      b = hash(xi + 1, yi),
      c = hash(xi, yi + 1),
      d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    let f = 0,
      amp = 0.5,
      fr = 1;
    for (let i = 0; i < (oct || 4); i++) {
      f += amp * vnoise(x * fr, y * fr);
      fr *= 2.03;
      amp *= 0.5;
    }
    return f;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------------------------------------------------- engine */

  const stage = document.querySelector(".webgl-stage");
  if (!stage) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (e) {
    stage.classList.add("webgl-off"); /* css fallback keeps the mood */
    window.SKY && (window.SKY.webgl = null);
    document.dispatchEvent(new CustomEvent("webgl:failed"));
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(COL.bg, 1);
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COL.bg, 0.00115);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.5,
    4000,
  );

  const veil = stage.querySelector(".webgl-veil");

  /* the rig — home.js tweens these, we just obey */
  const rig = {
    px: 150,
    py: 170,
    pz: 240,
    tx: 0,
    ty: 10,
    tz: 0,
    theta: 0,
    phi: 0 /* drag offsets (radians) */,
    drift: 1 /* gentle idle motion weight */,
    cubePulse: 0,
  };

  /* ---------------------------------------------------------- sky dome */

  {
    const skyGeo = new THREE.SphereGeometry(1900, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main(){
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        varying vec3 vPos;
        void main(){
          float h = normalize(vPos).y;
          vec3 top = vec3(0.008, 0.039, 0.094);   /* #020a18 up top   */
          vec3 hor = vec3(0.043, 0.106, 0.224);   /* pale blue breath at the horizon */
          vec3 low = vec3(0.008, 0.039, 0.094);
          vec3 c = h > 0.0 ? mix(hor, top, pow(min(h*1.6,1.0), 0.7)) : mix(hor, low, pow(min(-h*2.2,1.0), 0.8));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  /* faint stars */
  {
    const N = 380;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.85); /* keep above horizon-ish */
      const r = 1750;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) + 60;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: COL.ink,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.35,
      fog: false,
    });
    scene.add(new THREE.Points(g, m));
  }

  /* ---------------------------------------------------------- shared chunk */

  const fresnelGLSL = `
    float fres(vec3 n, vec3 v){
      return pow(1.0 - abs(dot(normalize(n), normalize(v))), 3.0);
    }`;

  /* ---------------------------------------------------------- CITY world */

  const cityWorld = new THREE.Group();
  cityWorld.visible = false;
  scene.add(cityWorld);

  /* the river decides what is land */
  const RIVER = (x) =>
    70 * Math.sin(x * 0.0035) + 26 * Math.sin(x * 0.011 + 2.0);

  const DISTRICTS = [
    {
      name: "Walled City",
      cx: -60,
      cz: 95,
      rot: 0.12,
      hMin: 5,
      hMax: 15,
      spread: 95,
      step: 13,
    },
    {
      name: "Gulberg",
      cx: 120,
      cz: -30,
      rot: -0.28,
      hMin: 9,
      hMax: 34,
      spread: 120,
      step: 17,
    },
    {
      name: "Model Town",
      cx: -140,
      cz: -120,
      rot: 0.34,
      hMin: 4,
      hMax: 11,
      spread: 90,
      step: 15,
    },
    {
      name: "DHA",
      cx: 170,
      cz: 130,
      rot: -0.1,
      hMin: 7,
      hMax: 20,
      spread: 130,
      step: 16,
    },
  ];

  const markerAnchors = {};
  DISTRICTS.forEach((d) => {
    markerAnchors[d.name] = new THREE.Vector3(d.cx, 6, d.cz);
  });

  function inLand(x, z) {
    /* island blob + river carve */
    const ex = (x + 15) / 330,
      ez = (z - 10) / 300;
    const blob = ex * ex + ez * ez;
    if (blob > 1.05) return false;
    const dz = Math.abs(z - RIVER(x));
    const width = 26 + 10 * Math.sin(x * 0.006 + 1.0);
    if (dz < width) return false;
    /* raggy coastline */
    return fbm(x * 0.012, z * 0.012, 3) > 0.18;
  }

  {
    /* blocks */
    const items = [];
    DISTRICTS.forEach((d) => {
      const half = d.spread;
      for (let gx = -half; gx <= half; gx += d.step) {
        for (let gz = -half; gz <= half; gz += d.step) {
          const jitter = 0.55;
          const x =
            d.cx + gx + (hash(gx + 9, gz + d.cx) - 0.5) * d.step * jitter;
          const z =
            d.cz + gz + (hash(gz + 4, gx + d.cz) - 0.5) * d.step * jitter;
          if (!inLand(x, z)) continue;
          const cen = Math.hypot(gx, gz) / half;
          const luck = hash(gx * 3.1, gz * 2.7);
          if (luck < cen * 0.55) continue; /* thin out at the edges */
          const h =
            lerp(d.hMin, d.hMax, Math.pow(luck, 1.7)) * (1 - cen * 0.45);
          const w = d.step * (0.42 + luck * 0.3);
          const dep = d.step * (0.42 + hash(gz, gx * 1.3) * 0.3);
          items.push({ x, z, w, d: dep, h: Math.max(2.5, h), rot: d.rot });
        }
      }
    });
    /* a handful of landmarks */
    DISTRICTS.forEach((d, di) => {
      for (let i = 0; i < 3; i++) {
        const a = hash(di * 7, i * 13) * Math.PI * 2;
        const r = 18 + hash(i, di) * 34;
        const x = d.cx + Math.cos(a) * r;
        const z = d.cz + Math.sin(a) * r;
        if (!inLand(x, z)) continue;
        items.push({
          x,
          z,
          w: 7 + hash(i, di * 3) * 4,
          d: 7,
          h: 36 + hash(di, i * 5) * 34,
          rot: d.rot,
          tower: true,
        });
      }
    });

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); /* grow from the ground */
    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uInk: { value: new THREE.Color(COL.ink) },
          uBase: { value: new THREE.Color(COL.block) },
          uTime: { value: 0 },
        },
      ]),
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying float vY;
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main(){
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vViewDir = normalize(cameraPosition - wp.xyz);
          vY = position.y;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uInk;
        uniform vec3 uBase;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying float vY;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        ${fresnelGLSL}
        void main(){
          vec3 n = normalize(vNormalW);
          float rim = fres(n, vViewDir);
          float roof = smoothstep(0.35, 0.5, vY); /* box translated so top face sits at .5 */
          vec3 c = uBase;
          c += uInk * rim * 0.22;                 /* silhouette catch-light   */
          c += uInk * roof * 0.05;                /* faint rooftops           */
          c *= 0.9 + 0.1 * smoothstep(-200.0, 200.0, vWorld.x);
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const E = new THREE.Euler();
    const S = new THREE.Vector3();
    const P = new THREE.Vector3();
    items.forEach((it, i) => {
      E.set(0, it.rot, 0);
      Q.setFromEuler(E);
      P.set(it.x, 0, it.z);
      S.set(it.w, it.h, it.d);
      M.compose(P, Q, S);
      mesh.setMatrixAt(i, M);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    cityWorld.userData.blockMat = mat;
    cityWorld.add(mesh);
  }

  /* ground plate under the city */
  {
    const g = new THREE.PlaneGeometry(1000, 1000);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uBase: { value: new THREE.Color(0x030a17) } },
      ]),
      vertexShader: `
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uBase;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        void main(){
          vec2 g = abs(fract(vWorld.xz * 0.02) - 0.5);
          float grid = smoothstep(0.48, 0.5, max(g.x, g.y)) * 0.05;
          gl_FragColor = vec4(uBase + vec3(grid), 1.0);
          #include <fog_fragment>
        }`,
    });
    cityWorld.add(new THREE.Mesh(g, m));
  }

  /* the river */
  {
    const g = new THREE.PlaneGeometry(1000, 1000, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, -1.2, 0);
    const m = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uInk: { value: new THREE.Color(COL.ink) },
          uWater: { value: new THREE.Color(COL.water) },
        },
      ]),
      vertexShader: `
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uInk;
        uniform vec3 uWater;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        float w(vec2 p){
          return sin(p.x) * sin(p.y);
        }
        void main(){
          vec2 uv = vWorld.xz;
          float river = exp(-pow((uv.y - (70.0*sin(uv.x*0.0035) + 26.0*sin(uv.x*0.011+2.0)))/30.0, 2.0));
          float sparkle = w(uv*0.08 + vec2(uTime*0.35, uTime*0.22));
          sparkle += 0.6 * w(uv*0.16 - vec2(uTime*0.2, uTime*0.4));
          sparkle = smoothstep(0.55, 1.4, sparkle + river*0.2);
          vec3 c = mix(uWater, uWater + uInk*0.16, river * (0.35 + 0.65*sparkle));
          float shore = smoothstep(1.0, 0.4, river);
          gl_FragColor = vec4(c, shore * 0.92);
          #include <fog_fragment>
        }`,
    });
    cityWorld.userData.waterMat = m;
    const water = new THREE.Mesh(g, m);
    water.renderOrder = 1;
    cityWorld.add(water);
  }

  /* the hero cube — the mark itself, floating over the river bend */
  const heroCube = (() => {
    const geo = new THREE.BoxGeometry(26, 26, 26);
    const mat = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uPulse: { value: 0 },
          uInk: { value: new THREE.Color(COL.ink) },
          uB1: { value: new THREE.Color(COL.blue1) },
        },
      ]),
      vertexShader: `
        varying vec3 vPos;
        varying vec3 vN;
        varying vec3 vView;
        varying vec3 vLocal;
        #include <fog_pars_vertex>
        void main(){
          vLocal = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vPos = wp.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform float uReveal;
        uniform float uPulse;
        uniform vec3 uInk;
        uniform vec3 uB1;
        varying vec3 vPos;
        varying vec3 vN;
        varying vec3 vView;
        varying vec3 vLocal;
        #include <fog_pars_fragment>
        ${fresnelGLSL}
        void main(){
          vec3 a = abs(vLocal) / 13.0;          /* 0 centre → 1 face edge */
          float edge = max(max(a.x, a.y), a.z);
          float rim = fres(vN, vView);

          /* fine grid etched on each face */
          vec2 uv = a.x > 0.999 ? vLocal.zy : (a.y > 0.999 ? vLocal.xz : vLocal.xy);
          vec2 gr = abs(fract(uv * 0.2) - 0.5);
          float grid = smoothstep(0.46, 0.5, max(gr.x, gr.y));

          /* reveal sweep from the core outward */
          float sweep = smoothstep(uReveal, uReveal - 0.18, edge - 0.02);

          vec3 c = vec3(0.012, 0.045, 0.11);
          c += uInk * rim * (0.34 + uPulse * 0.5);
          c += uB1 * grid * 0.12 * sweep;
          c += uInk * smoothstep(0.82, 1.0, edge) * 0.5 * sweep;

          float alpha = (0.28 + rim * 0.6 + smoothstep(0.82,1.0,edge)*0.35) * sweep;
          gl_FragColor = vec4(c, clamp(alpha + uPulse*0.08, 0.0, 1.0));
          #include <fog_fragment>
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(8, 46, 34);
    cityWorld.add(m);
    cityWorld.userData.cubeMat = mat;
    cityWorld.userData.cube = m;
    return m;
  })();

  /* drifting motes */
  {
    const N = 320;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 640;
      pos[i * 3 + 1] = Math.random() * 160;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 640;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: COL.ink,
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
    });
    const pts = new THREE.Points(g, m);
    cityWorld.add(pts);
    cityWorld.userData.motes = pts;
  }

  /* ---------------------------------------------------------- TERRAIN world */

  const terrainWorld = new THREE.Group();
  terrainWorld.visible = false;
  scene.add(terrainWorld);

  const TERRAIN_W = 1500;
  const TERRAIN_D = 900;
  const TILES = 3;

  function buildTerrainTile() {
    const grp = new THREE.Group();

    const segX = 150,
      segZ = 90;
    const geo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const posA = geo.attributes.position;
    for (let i = 0; i < posA.count; i++) {
      const x = posA.getX(i),
        z = posA.getZ(i);
      let h = fbm(x * 0.004 + 40, z * 0.004 + 9, 5) * 90;
      h += fbm(x * 0.016, z * 0.016, 3) * 14;
      /* carve a valley so the lines have somewhere to run */
      const v = Math.abs(x * 0.6 + z * 0.25);
      h *= 0.55 + 0.45 * Math.tanh(v / 260);
      posA.setY(i, h);
    }
    geo.computeVertexNormals();

    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uBase: { value: new THREE.Color(0x040d1c) } },
      ]),
      vertexShader: `
        varying float vH;
        varying vec3 vN;
        #include <fog_pars_vertex>
        void main(){
          vH = position.y;
          vN = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uBase;
        varying float vH;
        varying vec3 vN;
        #include <fog_pars_fragment>
        void main(){
          float lambert = clamp(dot(vN, normalize(vec3(0.35, 0.8, 0.45))), 0.0, 1.0);
          vec3 c = uBase * (0.55 + 0.65 * lambert);
          c += vec3(0.10, 0.16, 0.30) * smoothstep(20.0, 85.0, vH);
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
    });
    grp.add(new THREE.Mesh(geo, mat));

    /* flowing light lines — the signature */
    const LINES = 26;
    const lineMat = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uB1: { value: new THREE.Color(COL.blue1) },
          uB2: { value: new THREE.Color(COL.blue2) },
          uInk: { value: new THREE.Color(COL.ink) },
        },
      ]),
      vertexShader: `
        attribute float aT;
        varying float vT;
        varying float vH;
        #include <fog_pars_vertex>
        void main(){
          vT = aT;
          vH = position.y;
          vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uB1;
        uniform vec3 uB2;
        uniform vec3 uInk;
        varying float vT;
        varying float vH;
        #include <fog_pars_fragment>
        void main(){
          vec3 grad = mix(uB1, uB2, vT);
          float flow = fract(vT * 1.6 - uTime * 0.22);
          float packet = smoothstep(0.0, 0.25, flow) * smoothstep(0.55, 0.3, flow);
          float base = 0.16;
          float alpha = base + packet * 0.85;
          alpha *= smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
          gl_FragColor = vec4(grad * alpha + uInk * packet * 0.25, alpha);
          #include <fog_fragment>
        }`,
    });
    grp.userData.lineMat = lineMat;

    for (let li = 0; li < LINES; li++) {
      const pts = [];
      const zBase = -TERRAIN_D / 2 + 30 + (li / (LINES - 1)) * (TERRAIN_D - 60);
      const wob = 40 + hash(li, 7) * 120;
      const npts = 130;
      for (let i = 0; i < npts; i++) {
        const t = i / (npts - 1);
        const x = -TERRAIN_W / 2 + t * TERRAIN_W;
        const z =
          zBase + Math.sin(t * Math.PI * (1 + hash(li, 3) * 2) + li) * wob;
        const h =
          fbm(x * 0.004 + 40, z * 0.004 + 9, 5) * 90 +
          fbm(x * 0.016, z * 0.016, 3) * 14;
        const vv = Math.abs(x * 0.6 + z * 0.25);
        const hh = h * (0.55 + 0.45 * Math.tanh(vv / 260));
        pts.push(new THREE.Vector3(x, hh + 1.5 + hash(li, i) * 1.2, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const lg = new THREE.BufferGeometry().setFromPoints(curve.getPoints(220));
      const tArr = new Float32Array(221);
      for (let i = 0; i <= 220; i++) tArr[i] = i / 220;
      lg.setAttribute("aT", new THREE.BufferAttribute(tArr, 1));
      const line = new THREE.Line(lg, lineMat);
      grp.add(line);
    }
    return grp;
  }

  const terrainTiles = [];
  for (let i = 0; i < TILES; i++) {
    const t = buildTerrainTile();
    t.position.z = -i * (TERRAIN_D - 2);
    terrainWorld.add(t);
    terrainTiles.push(t);
  }

  /* ---------------------------------------------------------- POINTS world */

  const pointsWorld = new THREE.Group();
  pointsWorld.visible = false;
  scene.add(pointsWorld);

  {
    const layers = [
      { n: 5200, span: 900, size: 1.7, op: 0.75, speed: 0.5 },
      { n: 900, span: 300, size: 3.0, op: 0.5, speed: 0.32 },
    ];
    pointsWorld.userData.layers = layers.map((L, li) => {
      const pos = new Float32Array(L.n * 3);
      const seed = new Float32Array(L.n);
      for (let i = 0; i < L.n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * L.span * 2.2;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 180;
        pos[i * 3 + 2] = (Math.random() - 0.5) * L.span * 2.2 - 150;
        seed[i] = Math.random() * 100;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      const m = new THREE.ShaderMaterial({
        fog: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            uSize: { value: L.size },
            uOpacity: { value: L.op },
            uSpeed: { value: L.speed },
            uInk: { value: new THREE.Color(COL.ink) },
            uB1: { value: new THREE.Color(COL.blue1) },
          },
        ]),
        vertexShader: `
          attribute float aSeed;
          uniform float uTime;
          uniform float uSize;
          uniform float uSpeed;
          varying float vA;
          #include <fog_pars_vertex>
          void main(){
            vec3 p = position;
            p.y += sin(p.x * 0.012 + uTime * uSpeed + aSeed) * 26.0;
            p.y += sin(p.z * 0.017 - uTime * uSpeed * 0.7 + aSeed * 2.0) * 18.0;
            p.x += sin(uTime * 0.05 + aSeed) * 8.0;
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = uSize * (240.0 / -mvPosition.z);
            vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.4 + aSeed * 3.0));
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform float uOpacity;
          uniform vec3 uInk;
          uniform vec3 uB1;
          varying float vA;
          #include <fog_pars_fragment>
          void main(){
            vec2 c = gl_PointCoord - 0.5;
            float d = smoothstep(0.5, 0.1, length(c));
            gl_FragColor = vec4(mix(uB1, uInk, d), d * vA * uOpacity);
            #include <fog_fragment>
          }`,
      });
      const pts = new THREE.Points(g, m);
      pointsWorld.add(pts);
      return pts;
    });
  }

  /* ---------------------------------------------------------- CUBES world */

  const cubesWorld = new THREE.Group();
  cubesWorld.visible = false;
  scene.add(cubesWorld);

  {
    const N = 41;
    const STEP = 26;
    const count = N * N;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uInk: { value: new THREE.Color(COL.ink) },
          uBase: { value: new THREE.Color(0x04101f) },
        },
      ]),
      vertexShader: `
        uniform float uTime;
        uniform float uReveal;
        varying float vH;
        varying vec3 vN;
        varying vec3 vView;
        varying vec2 vXZ;
        #include <fog_pars_vertex>
        float hnoise(vec2 p){
          return sin(p.x) * sin(p.y);
        }
        void main(){
          vec3 p = position;
          vec4 wp0 = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec2 xz = wp0.xz;
          vXZ = xz;
          float wave = hnoise(xz * 0.021 + vec2(uTime * 0.32, 0.0));
          wave += 0.55 * hnoise(xz * 0.041 - vec2(0.0, uTime * 0.24));
          float h = (2.5 + 20.0 * (0.5 + 0.5 * wave)) * uReveal;
          vec4 wp = modelMatrix * instanceMatrix * vec4(p.x, p.y * h, p.z, 1.0);
          vH = h;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uInk;
        uniform vec3 uBase;
        varying float vH;
        varying vec3 vN;
        varying vec3 vView;
        varying vec2 vXZ;
        #include <fog_pars_fragment>
        ${fresnelGLSL}
        void main(){
          float rim = fres(vN, vView);
          float lit = smoothstep(6.0, 24.0, vH);
          vec3 c = uBase + uInk * (rim * 0.28 + lit * 0.10);
          gl_FragColor = vec4(c, 0.92);
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const S = new THREE.Vector3(15, 1, 15);
    const P = new THREE.Vector3();
    let i = 0;
    for (let gx = 0; gx < N; gx++) {
      for (let gz = 0; gz < N; gz++) {
        P.set((gx - N / 2) * STEP, 0, (gz - N / 2) * STEP);
        M.compose(P, Q, S);
        mesh.setMatrixAt(i++, M);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    cubesWorld.add(mesh);
    cubesWorld.userData.mat = mat;
  }

  /* ---------------------------------------------------------- scene mgmt */

  const WORLDS = {
    city: cityWorld,
    terrain: terrainWorld,
    points: pointsWorld,
    cubes: cubesWorld,
  };

  let activeName = "city";
  cityWorld.visible = true;

  const api = {
    camera,
    rig,
    markerAnchors,
    autoOrbit: false,
    activeWorld: () => activeName,
    revealCube(v, dur) {
      const u = cityWorld.userData.cubeMat.uniforms.uReveal;
      if (dur)
        window.gsap &&
          gsap.to(u, { value: v, duration: dur, ease: "power2.inOut" });
      else u.value = v;
    },

    setWorld(name) {
      if (!WORLDS[name] || name === activeName) return;
      const gsap_ = window.gsap;
      const swap = () => {
        Object.values(WORLDS).forEach((w) => (w.visible = false));
        WORLDS[name].visible = true;
        activeName = name;
        api.revealCube(name === "city" ? 1 : 0, 0);
      };
      if (gsap_ && veil) {
        gsap_.to(veil, {
          opacity: 0.85,
          duration: 0.32,
          ease: "power2.in",
          onComplete: swap,
        });
        gsap_.to(veil, {
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          delay: 0.34,
        });
      } else swap();
    },

    project(vec) {
      const v = vec.clone().project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        behind: v.z > 1,
        depth: v.z,
      };
    },
  };

  /* ---------------------------------------------------------- drag orbit
     the map is grabbable while the hero chapter is on screen. we
     listen at window level and ignore anything a real control
     would want (buttons, links, the rail, the bar). */

  const drag = {
    on: false,
    id: null,
    sx: 0,
    sy: 0,
    th: 0,
    ph: 0,
    vth: 0,
    vph: 0,
  };
  api.setDragEnabled = (on) => {
    drag.on = on;
    document.body.classList.toggle("is-map-grab", on);
  };

  {
    const isChrome = (t) =>
      !!(
        t.closest &&
        t.closest(
          ".btn, a, button, .rail, .bottombar, .site-header, .menu-overlay, .loader, .audio-prompt",
        )
      );
    let lastTh = 0,
      lastPh = 0;
    window.addEventListener("pointerdown", (e) => {
      if (!drag.on || e.pointerType === "touch") return;
      if (isChrome(e.target)) return;
      drag.id = e.pointerId;
      drag.sx = e.clientX;
      drag.sy = e.clientY;
      drag.th = rig.theta;
      drag.ph = rig.phi;
      drag.vth = 0;
      drag.vph = 0;
      lastTh = rig.theta;
      lastPh = rig.phi;
      document.body.classList.add("is-map-dragging");
    });
    window.addEventListener("pointermove", (e) => {
      if (drag.id !== e.pointerId || !drag.on) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      rig.theta = drag.th + (dx / window.innerWidth) * 1.15;
      rig.phi = clamp(drag.ph + (dy / window.innerHeight) * 0.55, -0.45, 0.5);
      drag.vth = rig.theta - lastTh;
      drag.vph = rig.phi - lastPh;
      lastTh = rig.theta;
      lastPh = rig.phi;
    });
    const up = (e) => {
      if (drag.id !== e.pointerId) return;
      drag.id = null;
      document.body.classList.remove("is-map-dragging");
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  /* ---------------------------------------------------------- resize + loop */

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const lookTmp = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05);

    /* damped inertia — the map keeps drifting a touch after you let go
       (and does a slow lap on the interior pages) */
    if (api.autoOrbit) {
      rig.theta += 0.00055;
    } else if (
      drag.id === null &&
      (Math.abs(drag.vth) > 0.00002 || Math.abs(drag.vph) > 0.00002)
    ) {
      rig.theta += drag.vth;
      rig.phi = clamp(rig.phi + drag.vph, -0.45, 0.5);
      drag.vth *= 0.93;
      drag.vph *= 0.93;
    }

    /* camera: base rig + drag orbit around the target */
    camPos.set(rig.px, rig.py, rig.pz);
    camTarget.set(rig.tx, rig.ty, rig.tz);
    if (activeName === "city" || activeName === "cubes") {
      lookTmp.copy(camPos).sub(camTarget);
      const r = lookTmp.length();
      const baseAng = Math.atan2(lookTmp.x, lookTmp.z);
      const basePh = Math.asin(clamp(lookTmp.y / r, -1, 1));
      const ang = baseAng + rig.theta + Math.sin(t * 0.05) * 0.015 * rig.drift;
      const ph = clamp(basePh + rig.phi, 0.08, 1.35);
      camPos.set(
        camTarget.x + r * Math.cos(ph) * Math.sin(ang),
        camTarget.y + r * Math.sin(ph),
        camTarget.z + r * Math.cos(ph) * Math.cos(ang),
      );
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    /* per-world time */
    if (cityWorld.visible) {
      cityWorld.userData.waterMat.uniforms.uTime.value = t;
      cityWorld.userData.cubeMat.uniforms.uTime.value = t;
      cityWorld.userData.cubeMat.uniforms.uPulse.value =
        0.18 + 0.14 * Math.sin(t * 1.4) + rig.cubePulse;
      heroCube.rotation.y = t * 0.12;
      heroCube.rotation.x = Math.sin(t * 0.2) * 0.08;
      heroCube.position.y = 46 + Math.sin(t * 0.7) * 2.2;
      const motes = cityWorld.userData.motes;
      motes.rotation.y = t * 0.01;
    }
    if (terrainWorld.visible) {
      const speed = 34;
      terrainTiles.forEach((tile) => {
        tile.position.z += speed * dt;
        if (tile.position.z > TERRAIN_D * 0.8)
          tile.position.z -= TILES * (TERRAIN_D - 2);
      });
      terrainTiles.forEach(
        (tile) => (tile.userData.lineMat.uniforms.uTime.value = t),
      );
    }
    if (pointsWorld.visible) {
      pointsWorld.userData.layers.forEach(
        (pts) => (pts.material.uniforms.uTime.value = t),
      );
      pointsWorld.rotation.y = Math.sin(t * 0.03) * 0.1;
    }
    if (cubesWorld.visible) {
      cubesWorld.userData.mat.uniforms.uTime.value = t;
    }

    renderer.render(scene, camera);
  }
  frame();

  /* intro: lift the veil once fonts + first frame are in */
  api.intro = () => {
    api.revealCube(0);
    if (window.gsap) {
      gsap.to(veil, {
        opacity: 0,
        duration: 1.4,
        ease: "power2.out",
        delay: 0.15,
      });
      gsap.to(cityWorld.userData.cubeMat.uniforms.uReveal, {
        value: 1,
        duration: 2.2,
        ease: "power2.inOut",
        delay: 0.6,
      });
    } else {
      veil.style.opacity = 0;
      api.revealCube(1);
    }
  };
  if (veil) veil.style.opacity = 1;

  window.SKY = window.SKY || {};
  window.SKY.webgl = api;
  document.dispatchEvent(new CustomEvent("webgl:ready", { detail: api }));
})();
