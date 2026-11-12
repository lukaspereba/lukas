// Métricas de renderização por predefinição em cenas reais (draw calls, triângulos, regiões, memória JS).
module.exports = async ({ p, shot, ev, sleep }) => {
  const r = await ev(async () => { const G = __G, out = []; G.simPause = true; G.startMatch('treino', 1); const pl = G.player; G.dev.god = true; const S = G.__S; S.dynRes = false; __sim(1);
    const spots = [['Praça/Sede', -6, -52, 0.25], ['Shopping (interior)', 72, -208, -1.57, 1.3], ['Parque do Planalto', -150, 100, 2.4], ['Rua residencial', -140, -34, 1.57], ['Escola/Igreja (R. Europa)', 108, -70, 3.1]];
    for (const preset of ['baixo', 'medio', 'alto']) { G.__applyPreset(preset); G.__applyQuality(); for (const [name, x, z, yaw, dy] of spots) { pl.teleport(x, G.terr.height(x, z) + (dy || 0.1), z); pl.yaw = yaw; pl.pitch = 0; __sim(0.6); G.__render(); out.push({ preset, name, calls: G.stats.calls, tris: G.stats.tris, chunks: G.stats.chunks, res: G.resW + 'x' + G.resH }); } }
    if (window.gc) { gc(); gc(); } return { rows: out, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, colliders: G.phys.b.length, worldTris: G.world.worldTris, geoms: G.renderer.info.memory.geometries, textures: G.renderer.info.memory.textures }; });
  for (const x of r.rows) console.log(`${x.preset}\t${x.name}\t${x.calls}\t${x.tris}\t${x.chunks}\t${x.res}`);
  console.log(JSON.stringify({ heap: r.heap, colliders: r.colliders, worldTris: r.worldTris, geoms: r.geoms, textures: r.textures }));
};
