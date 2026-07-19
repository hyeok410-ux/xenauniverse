(function () {
  "use strict";
  if (!window.THREE) return;

  const T = window.THREE;
  const SIZE = 6;
  const colors = {
    white: { primary: 0x37eef5, secondary: 0x755cff, glow: 0xb9ff3c },
    black: { primary: 0xff3b69, secondary: 0x7e183f, glow: 0xffd66b },
  };
  const typeHeight = { signal: .38, catalyst: .62, vector: .76, glitch: .74, bastion: .92, leader: 1.12 };
  const SHOW_FIGURES = false;
  // The CSS board spans exactly six world units. Matching the frustum keeps VFX and legal-square UI perfectly aligned.
  const TOPDOWN_FRUSTUM = 3;
  let renderer, scene, camera, root, boardGroup, lightGroup, host;
  let hitPlane, squareCallback, raycaster;
  let figures = new Map();
  let previous = new Map();
  let squareFrames = [];
  let effects = [];
  let lastActionNonce = 0;
  let resizeObserver;
  let running = false;
  let lastTime = 0;
  let viewFlipped = false;

  function squarePosition(index) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    // The top-down camera's right vector is negative X, so X must be mirrored
    // to land VFX on the same left/right square as the DOM board.
    const x = viewFlipped ? col - 2.5 : 2.5 - col;
    const z = viewFlipped ? 2.5 - row : row - 2.5;
    return new T.Vector3(x, 0, z);
  }

  function material(color, emissive, amount) {
    return new T.MeshStandardMaterial({ color, metalness: .74, roughness: .22, emissive: emissive || color, emissiveIntensity: amount || .15 });
  }

  function init() {
    if (renderer) return;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.fog = new T.FogExp2(0x05060a, .075);
    camera = new T.OrthographicCamera(-TOPDOWN_FRUSTUM, TOPDOWN_FRUSTUM, TOPDOWN_FRUSTUM, -TOPDOWN_FRUSTUM, .1, 100);
    camera.position.set(0, 10, 0);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    root = new T.Group();
    root.rotation.x = 0;
    scene.add(root);
    const ambient = new T.HemisphereLight(0x9beeff, 0x070810, 1.85);
    scene.add(ambient);
    const key = new T.DirectionalLight(0xe8fbff, 2.5);
    key.position.set(0, 8, 2); key.castShadow = true; scene.add(key);
    const magenta = new T.PointLight(0x8a5cff, 16, 10, 2);
    magenta.position.set(-4, 2.2, -2.4); scene.add(magenta);
    const cyan = new T.PointLight(0x31eaf2, 16, 10, 2);
    cyan.position.set(4, 2.2, 2.4); scene.add(cyan);
    buildBoard();
    raycaster = new T.Raycaster();
    renderer.domElement.addEventListener("click", onBoardClick);
    window.addEventListener("resize", resize);
  }

  function buildBoard() {
    boardGroup = new T.Group();
    lightGroup = new T.Group();
    root.add(boardGroup, lightGroup);
    const base = new T.Mesh(new T.BoxGeometry(7.4, .28, 7.4), material(0x090d17, 0x101936, .28));
    base.position.y = -.25; base.receiveShadow = true; boardGroup.add(base);
    for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) {
      const light = (row + col) % 2 === 0;
      const tile = new T.Mesh(new T.BoxGeometry(.96, .12, .96), material(light ? 0x243148 : 0x0a101d, light ? 0x1e3457 : 0x070a13, light ? .18 : .08));
      tile.position.set(col - 2.5, 0, row - 2.5); tile.receiveShadow = true; boardGroup.add(tile);
      const frame = new T.Mesh(new T.BoxGeometry(.93, .017, .93), new T.MeshBasicMaterial({ color: 0x00dffc, transparent: true, opacity: 0 }));
      frame.position.set(col - 2.5, .072, row - 2.5); lightGroup.add(frame); squareFrames[row * SIZE + col] = frame;
    }
    const floor = new T.Mesh(new T.CircleGeometry(9.5, 64), new T.MeshBasicMaterial({ color: 0x0a1023, transparent: true, opacity: .56 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.42; root.add(floor);
    hitPlane = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshBasicMaterial({ visible: false }));
    hitPlane.rotation.x = -Math.PI / 2; hitPlane.position.y = .16; root.add(hitPlane);
    // The DOM board owns tiles and legal-move markers; Three.js is a transparent VFX layer.
    boardGroup.visible = false;
    lightGroup.visible = false;
    floor.visible = false;
  }

  function addMesh(group, geometry, mat, y, scale) {
    const mesh = new T.Mesh(geometry, mat); mesh.position.y = y; if (scale) mesh.scale.setScalar(scale); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }

  function makeFigure(piece, awakened) {
    const palette = colors[piece.color];
    const group = new T.Group();
    const baseMat = material(palette.primary, palette.secondary, .34);
    const accentMat = material(palette.secondary, palette.primary, .42);
    const glowMat = new T.MeshBasicMaterial({ color: awakened ? palette.glow : palette.primary, transparent: true, opacity: .62 });
    const base = addMesh(group, new T.CylinderGeometry(.31, .4, .13, 20), baseMat, .065);
    const ring = addMesh(group, new T.TorusGeometry(.36, .032, 8, 30), glowMat, .14); ring.rotation.x = Math.PI / 2;
    const height = typeHeight[piece.type] || .55;
    if (piece.type === "signal") {
      addMesh(group, new T.CylinderGeometry(.16, .23, .25, 14), baseMat, .26);
      addMesh(group, new T.SphereGeometry(.15, 16, 12), accentMat, .47);
    } else if (piece.type === "bastion") {
      addMesh(group, new T.BoxGeometry(.38, .48, .38), baseMat, .36);
      addMesh(group, new T.CylinderGeometry(.25, .28, .22, 8), accentMat, .7);
      for (let i = 0; i < 4; i += 1) addMesh(group, new T.BoxGeometry(.09, .12, .09), accentMat, .88, 1).position.set((i % 2 ? .12 : -.12), .88, (i > 1 ? .12 : -.12));
    } else if (piece.type === "vector") {
      addMesh(group, new T.ConeGeometry(.27, .58, 4), baseMat, .42).rotation.y = Math.PI / 4;
      addMesh(group, new T.OctahedronGeometry(.16), accentMat, .78);
    } else if (piece.type === "glitch") {
      const torus = addMesh(group, new T.TorusKnotGeometry(.16, .055, 44, 6), baseMat, .42); torus.rotation.x = .7;
      addMesh(group, new T.SphereGeometry(.17, 16, 12), accentMat, .66);
    } else if (piece.type === "catalyst") {
      const core = addMesh(group, new T.OctahedronGeometry(.26), accentMat, .48); core.rotation.x = .45;
      const orbit = addMesh(group, new T.TorusGeometry(.34, .025, 6, 24), glowMat, .48); orbit.rotation.x = 1.1;
      group.userData.orbit = orbit;
    } else if (piece.type === "leader") {
      addMesh(group, new T.CylinderGeometry(.25, .34, .56, 16), baseMat, .42);
      addMesh(group, new T.SphereGeometry(.2, 16, 12), accentMat, .82);
      const crown = addMesh(group, new T.TorusGeometry(.25, .042, 8, 24), glowMat, 1.04); crown.rotation.x = Math.PI / 2;
      group.userData.crown = crown;
    }
    const halo = addMesh(group, new T.RingGeometry(.38, .48, 28), glowMat, .155); halo.rotation.x = -Math.PI / 2; halo.visible = awakened;
    group.userData = { ...group.userData, piece, height, base, ring, halo, animation: null, fade: null, idlePhase: Math.random() * Math.PI * 2 };
    return group;
  }

  function pulse(position, color, strong, multiplier) {
    const ring = new T.Mesh(new T.RingGeometry(.12, .17, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(position); ring.position.y = .18; root.add(ring);
    effects.push({ mesh: ring, age: 0, duration: strong ? .8 : .42, scale: multiplier || (strong ? 5.5 : 2.8) });
  }

  function effectProfile(action) {
    if (action.skill === "override") return { color: 0xb7ff3c, style: "override" };
    if (action.skill === "cyanShift") return { color: 0x37eef5, style: "frequency" };
    if (action.skill === "systemLock") return { color: 0xffd66b, style: "lock" };
    if (action.skill === "publicErasure") return { color: 0xff315f, style: "erase" };
    if (action.effectStyle) return { color: Number.isFinite(action.effectColor) ? action.effectColor : colors[action.color || "white"].primary, style: action.effectStyle };
    const profiles = {
      "XENA": { color: 0x37eef5, style: "slash" },
      "NIX-09": { color: 0xa77bff, style: "memory" },
      "LYRA": { color: 0xffd66b, style: "lance" },
      "NOVA": { color: 0xff4fbd, style: "burst" },
      "ECHO": { color: 0x4ce9ff, style: "frequency" },
      "BAEK": { color: 0xe9e8c6, style: "shield" },
      "SOVRAN": { color: 0xff315f, style: "sky" },
      "MOTHERSHIP": { color: 0xff315f, style: "bomb" },
      "DRAGOON": { color: 0xff8b4a, style: "stomp" },
      "HUNTER": { color: 0xff315f, style: "lock" },
      "ARCHITECT-MAN": { color: 0xff516b, style: "slash" },
      "PALE-GOLD GUARDIAN": { color: 0xffd66b, style: "lance" },
      "CLONE-01": { color: 0xff315f, style: "slash" },
      "CLONE-02": { color: 0xff315f, style: "slash" },
      "DRONE-01": { color: 0xff315f, style: "missile" },
      "DRONE-02": { color: 0xff315f, style: "missile" },
      "XENA ETHEREAL": { color: 0xffd66b, style: "override" },
      "NIX-09 CATALYST": { color: 0xa77bff, style: "memory" },
      "CRYSTAL BASTION": { color: 0xffd66b, style: "shield" },
      "LYRA MEMORY VECTOR": { color: 0xe9e8c6, style: "lance" },
      "ECHO FREQUENCY VECTOR": { color: 0x4ce9ff, style: "frequency" },
      "NOVA LAUGHING GLITCH": { color: 0xff4fbd, style: "burst" },
      "BAEK SIGNAL": { color: 0xe9e8c6, style: "shield" },
      "JIN CRYSTAL MARK": { color: 0x37eef5, style: "memory" },
      "FIRST WHISTLER RETURNED": { color: 0xb7ff3c, style: "memory" },
      "LUCID-5 RED CHAIN": { color: 0xff516b, style: "slash" },
      "LUCID-6 GLASS SHARD": { color: 0x9beeff, style: "lance" },
      "NAYUN MOTHER STAY BRIGHT": { color: 0xffd66b, style: "memory" },
    };
    return profiles[action.character] || { color: colors[action.color || "white"].primary, style: action.capture ? "burst" : "pulse" };
  }

  function beam(fromIndex, toIndex, color, strong, offset) {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return;
    const start = squarePosition(fromIndex); start.y = .2;
    const end = squarePosition(toIndex); end.y = .2;
    if (offset) {
      const direction = end.clone().sub(start);
      const perpendicular = new T.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(offset);
      start.add(perpendicular); end.add(perpendicular);
    }
    const geometry = new T.BufferGeometry().setFromPoints([start, end]);
    const line = new T.Line(geometry, new T.LineBasicMaterial({ color, transparent: true, opacity: .95 }));
    root.add(line);
    effects.push({ mesh: line, age: 0, duration: strong ? .7 : .42, scale: 1, beam: true });
  }

  function ribbon(fromIndex, toIndex, color, width, duration, offset) {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return;
    const start = squarePosition(fromIndex); start.y = .205;
    const end = squarePosition(toIndex); end.y = .205;
    const direction = end.clone().sub(start);
    if (offset) {
      const perpendicular = new T.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(offset);
      start.add(perpendicular); end.add(perpendicular);
      direction.copy(end).sub(start);
    }
    const length = direction.length();
    const mesh = new T.Mesh(new T.BoxGeometry(width, .018, length), new T.MeshBasicMaterial({ color, transparent: true, opacity: .82, blending: T.AdditiveBlending }));
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.rotation.y = Math.atan2(direction.x, direction.z);
    root.add(mesh);
    effects.push({ mesh, age: 0, duration: duration || .56, scale: 1, beam: true });
  }

  function burstRays(index, color, count, length) {
    if (!Number.isInteger(index)) return;
    const center = squarePosition(index); center.y = .21;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + .18;
      const direction = new T.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const start = center.clone().add(direction.clone().multiplyScalar(.08));
      const end = center.clone().add(direction.multiplyScalar(length || .52));
      const mesh = new T.Mesh(new T.BoxGeometry(.045, .014, start.distanceTo(end)), new T.MeshBasicMaterial({ color, transparent: true, opacity: .86, blending: T.AdditiveBlending }));
      mesh.position.copy(start).add(end).multiplyScalar(.5);
      const delta = end.clone().sub(start); mesh.rotation.y = Math.atan2(delta.x, delta.z);
      root.add(mesh); effects.push({ mesh, age: 0, duration: .42, scale: 1, beam: true });
    }
  }

  function reticle(index, color) {
    if (!Number.isInteger(index)) return;
    const center = squarePosition(index); center.y = .2;
    for (let i = 0; i < 2; i += 1) {
      const points = i === 0 ? [new T.Vector3(-.34, 0, 0), new T.Vector3(.34, 0, 0)] : [new T.Vector3(0, 0, -.34), new T.Vector3(0, 0, .34)];
      const line = new T.Line(new T.BufferGeometry().setFromPoints(points.map((point) => point.add(center))), new T.LineBasicMaterial({ color, transparent: true, opacity: .95 }));
      root.add(line); effects.push({ mesh: line, age: 0, duration: .55, scale: 1, beam: true });
    }
  }

  function playAction(action) {
    if (!action || !action.nonce || action.nonce === lastActionNonce) return;
    lastActionNonce = action.nonce;
    const profile = effectProfile(action);
    const color = profile.color;
    const strong = Boolean(action.capture || action.skill);
    const target = Number.isInteger(action.to) ? squarePosition(action.to) : null;
    if (profile.style === "slash") {
      ribbon(action.from, action.to, color, .085, .58, -.13); ribbon(action.from, action.to, 0xffffff, .032, .42, .01); ribbon(action.from, action.to, color, .06, .54, .15);
      if (target) { pulse(target, color, true, 6.2); burstRays(action.to, color, 6, .52); }
    } else if (profile.style === "frequency" || profile.style === "memory") {
      ribbon(action.from, action.to, color, .055, .62);
      if (target) { pulse(target, color, true, 4.2); pulse(target, profile.style === "memory" ? 0xa77bff : 0x37eef5, true, 6.8); burstRays(action.to, color, 8, .38); }
    } else if (profile.style === "bomb" || profile.style === "sky") {
      ribbon(action.from, action.to, color, .11, .72);
      if (target) { reticle(action.to, color); pulse(target, color, true, 8.2); pulse(target, 0xffffff, false, 3.4); burstRays(action.to, color, 10, .74); }
    } else if (profile.style === "stomp") {
      if (target) { pulse(target, color, true, 8.6); pulse(target, 0xffd66b, true, 5.2); burstRays(action.to, color, 12, .68); }
    } else if (profile.style === "lock") {
      ribbon(action.from, action.to, color, .045, .66);
      if (target) { reticle(action.to, color); pulse(target, color, false, 4.6); }
    } else if (profile.style === "lance" || profile.style === "missile") {
      ribbon(action.from, action.to, color, .07, .66);
      ribbon(action.from, action.to, 0xffffff, .022, .44, .035);
      if (target) { pulse(target, color, true, 5.4); burstRays(action.to, color, 7, .5); }
    } else if (profile.style === "override") {
      ribbon(action.from, action.to, color, .09, .7, -.1); ribbon(action.from, action.to, 0x37eef5, .065, .66, .1);
      if (target) { pulse(target, color, true, 8); pulse(target, 0x37eef5, true, 5); burstRays(action.to, color, 12, .7); }
    } else {
      beam(action.from, action.to, color, strong);
    }
    if (Number.isInteger(action.to)) {
      pulse(squarePosition(action.to), color, strong);
      if (profile.style === "erase" || action.skill === "publicErasure") pulse(squarePosition(action.to), 0xff315f, true);
    }
  }

  function sync(state, ui) {
    if (!renderer) init();
    viewFlipped = Boolean(ui && ui.flipped);
    const seen = new Set();
    const next = new Map();
    if (!SHOW_FIGURES) {
      for (let index = 0; index < state.board.length; index += 1) {
        const piece = state.board[index];
        if (!piece) continue;
        seen.add(piece.id);
        const prior = previous.get(piece.id);
        if (prior !== undefined && prior !== index) pulse(squarePosition(index), colors[piece.color].primary, piece.type === "leader");
        next.set(piece.id, index);
      }
      previous = next;
      playAction(ui && ui.action);
      updateHighlights(ui || {});
      document.body.classList.add("three-ready");
      start();
      return;
    }
    for (let index = 0; index < state.board.length; index += 1) {
      const piece = state.board[index];
      if (!piece) continue;
      seen.add(piece.id);
      const target = squarePosition(index);
      const awakening = piece.type === "leader" && state.awakened[piece.color];
      let figure = figures.get(piece.id);
      if (!figure) {
        figure = makeFigure(piece, awakening); figure.position.copy(target); root.add(figure); figures.set(piece.id, figure);
      } else {
        const prior = previous.get(piece.id);
        if (prior !== undefined && prior !== index) {
          figure.userData.animation = { from: figure.position.clone(), to: target.clone(), age: 0, duration: .44 };
          pulse(target, colors[piece.color].primary, piece.type === "leader");
        } else figure.position.copy(target);
        figure.userData.piece = piece;
        figure.userData.halo.visible = awakening;
      }
      next.set(piece.id, index);
    }
    for (const [id, figure] of figures) if (!seen.has(id)) {
      figure.userData.fade = { age: 0, duration: .4 }; pulse(figure.position, 0xff315f, true);
    }
    previous = next;
    playAction(ui && ui.action);
    updateHighlights(ui || {});
    document.body.classList.add("three-ready");
    start();
  }

  function updateHighlights(ui) {
    for (let index = 0; index < squareFrames.length; index += 1) {
      const frame = squareFrames[index];
      const chosen = ui.selected === index;
      const legal = (ui.legal || []).some((move) => move.to === index);
      frame.material.opacity = chosen ? .85 : legal ? .45 : 0;
      frame.material.color.setHex(chosen ? 0xb7ff3c : 0x37eef5);
    }
  }

  function mount(nextHost) {
    init();
    if (!nextHost) return;
    host = nextHost;
    if (renderer.domElement.parentNode !== host) host.appendChild(renderer.domElement);
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
  }

  function onBoardClick(event) {
    if (!host || !hitPlane || !squareCallback) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new T.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(hitPlane, false)[0];
    if (!hit) return;
    const local = hitPlane.worldToLocal(hit.point.clone());
    const col = Math.floor(local.x + 3);
    const row = Math.floor(3 - local.z);
    if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) squareCallback(row * SIZE + col);
  }

  function resize() {
    if (!renderer || !host) return;
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, rect.width); const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    // Keep the six-by-six world stretched with the CSS board. This makes every impact
    // land on its DOM square even when the arena uses a slightly wider presentation.
    camera.left = -TOPDOWN_FRUSTUM;
    camera.right = TOPDOWN_FRUSTUM;
    camera.top = TOPDOWN_FRUSTUM;
    camera.bottom = -TOPDOWN_FRUSTUM;
    camera.updateProjectionMatrix();
  }

  function animate(now) {
    requestAnimationFrame(animate);
    if (!renderer || !running) return;
    const delta = Math.min(.05, (now - lastTime) / 1000 || 0); lastTime = now;
    for (const [id, figure] of figures) {
      const data = figure.userData;
      if (data.animation) {
        data.animation.age += delta; const t = Math.min(1, data.animation.age / data.animation.duration);
        figure.position.lerpVectors(data.animation.from, data.animation.to, t);
        figure.position.y = Math.sin(t * Math.PI) * .52;
        figure.rotation.y += .22;
        if (t >= 1) { figure.position.y = 0; data.animation = null; }
      }
      if (data.fade) {
        data.fade.age += delta; const t = data.fade.age / data.fade.duration;
        figure.scale.setScalar(Math.max(.01, 1 - t)); figure.rotation.y += delta * 6;
        if (t >= 1) { root.remove(figure); figures.delete(id); }
      } else {
        const pulseScale = data.halo.visible ? 1 + Math.sin(now / 180) * .08 : 1;
        figure.position.y = Math.sin(now / 520 + data.idlePhase) * .026;
        figure.rotation.y = Math.sin(now / 840 + data.idlePhase) * .035;
        data.halo.scale.setScalar(pulseScale);
        data.ring.rotation.z += delta * .7;
        if (data.orbit) data.orbit.rotation.z += delta * 1.6;
        if (data.crown) data.crown.rotation.z -= delta * 1.2;
      }
    }
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i]; effect.age += delta; const t = effect.age / effect.duration;
      if (!effect.beam) effect.mesh.scale.setScalar(1 + (effect.scale - 1) * t);
      effect.mesh.material.opacity = Math.max(0, .9 * (1 - t));
      if (t >= 1) { root.remove(effect.mesh); effects.splice(i, 1); }
    }
    renderer.render(scene, camera);
  }

  function start() { if (!running) { running = true; lastTime = performance.now(); requestAnimationFrame(animate); } }
  function reset() {
    previous.clear();
    for (const figure of figures.values()) root && root.remove(figure);
    figures.clear(); effects.forEach((effect) => root && root.remove(effect.mesh)); effects = [];
    lastActionNonce = 0;
  }

  function setOnSquare(callback) { squareCallback = callback; }
  window.OverrideGridScene = { mount, sync, reset, setOnSquare, playAction };
})();
