// Vitrine de modelos: 4 personagens, bots, pets e armas (para inspeção visual).
module.exports = async ({ p, shot, ev, sleep }) => {
  await ev(() => { const G = __G, T = __THREE, M = G.__mods; G.simPause = true; document.getElementById('menu').hidden = true; const y = G.terr.height(0, -72) + 0.72; G.camera.clearViewOffset(); G.show = [];
    ['lukas', 'bahia', 'kaique', 'mosquitao'].forEach((id, i) => { const h = new M.Humanoid(M.lookFor(id, 'padrao')); h.root.position.set(-2.4 + i * 1.6, G.terr.height(0, -60), -60); h.root.rotation.y = 0; G.scene.add(h.root); h.update(0.5, { speed: 0, armed: null }); h.update(0.5, { speed: 0, armed: null }); G.show.push(h); });
    [0, 1, 2].forEach((i) => { const h = new M.Humanoid(M.botLook(i * 3 + 1)); h.root.position.set(-1.6 + i * 1.6, G.terr.height(0, -60), -57.5); h.root.rotation.y = Math.PI; G.scene.add(h.root); h.setWeapon(M.buildWeapon(G.__W[i * 5], G.__W[i * 5].optic)); for (let k = 0; k < 4; k++) h.update(0.3, { speed: i === 1 ? 4 : 0, armed: 'rifle', crouch: i === 2 }); G.show.push(h); });
    G.pets = ['belo', 'louro', 'nina'].map((id, i) => { const pt = new M.Pet(id); pt.pos.set(-1 + i, G.terr.height(0, -62), -62.2); const o = { pos: new T.Vector3(-1 + i + (id === 'belo' ? 0.9 : -0.9), G.terr.height(0, -62), -63.1), yaw: Math.PI * 0.8, speed: 0, crouch: false, prone: false }; if (id === 'louro') o.pos.set(-1 + i - 0.2, G.terr.height(0, -62) - 1.1, -62.2); for (let k = 0; k < 30; k++) pt.update(0.1, o, false, true); pt.g.rotation.y = -0.9; return pt; });
    G.guns = G.__W.map((w, i) => { const g = M.buildWeapon(w, w.optic); g.position.set(-2.2 + (i % 5) * 1.1, G.terr.height(0, -60) + 2.1 - Math.floor(i / 5) * 0.42, -80); g.rotation.y = Math.PI / 2; G.scene.add(g); return g; });
    window.__cam = (x, yy, z, tx, ty, tz, fov) => { const c = G.camera; c.fov = fov || 40; c.updateProjectionMatrix(); c.position.set(x, G.terr.height(0, -60) + yy, z); c.lookAt(tx, G.terr.height(0, -60) + ty, tz); G.sky.position.copy(c.position); G.vmVisible = false; G.__render(); }; });
  await ev(() => __cam(0, 1.1, -65.2, 0, 0.95, -60, 30)); await shot('v_chars');
  await ev(() => __cam(-1.6, 1.6, -61.9, -1.6, 1.52, -60, 36)); await shot('v_face1');
  await ev(() => __cam(1.6, 1.6, -61.9, 1.6, 1.52, -60, 36)); await shot('v_face2');
  await ev(() => __cam(0, 1.3, -53.2, 0, 0.9, -57.5, 30)); await shot('v_bots');
  await ev(() => __cam(0.1, 0.45, -64.4, 0.1, 0.22, -62.2, 34)); await shot('v_pets');
  await ev(() => __cam(0, 1.5, -83.6, 0, 1.5, -80, 50)); await shot('v_guns');
};
