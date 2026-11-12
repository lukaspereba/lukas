module.exports = async ({ p, shot, ev, sleep }) => {
  await sleep(1500); await shot('m_menu');
  console.log('boot', await ev(() => ({ actors: __G.actors.length, pool: __G.botPool.length, nav: Array.from(__G.world ? [0] : []).length, fps: __G.stats.fps })));
  await ev(() => __G.startMatch('treino', 1)); await sleep(2500); await shot('m_treino');
  console.log('treino', await ev(() => { const G = __G, pl = G.player; return { mode: pl.mode, pos: [pl.pos.x, pl.pos.y, pl.pos.z].map((v) => +v.toFixed(1)), w: pl.w && pl.w.def.name, bots: G.bots.filter((b) => b.alive).length, calls: G.stats.calls, tris: G.stats.tris, fps: +G.stats.fps.toFixed(1) }; }));
};
