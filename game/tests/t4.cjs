// Capturas de tela de jogo e de painéis.
module.exports = async ({ p, shot, ev, sleep }) => {
  const pre = process.env.PRE || 'p';
  await ev(() => { const G = __G; G.simPause = true; G.startMatch('treino', 1); const pl = G.player; G.dev.freeze = true; pl.teleport(-6, G.terr.height(-6, -62) + 0.05, -52); pl.yaw = 0.25; pl.pitch = -0.03; __sim(0.6); G.devBots('add'); G.devBots('ally'); __sim(0.4); G.simPause = false; });
  await sleep(1200); await shot(pre + '_fps');
  await ev(() => { const G = __G; G.__I.ads = true; }); await sleep(1500); await shot(pre + '_ads');
  await ev(() => { const G = __G; G.__I.ads = false; G.player.camMode = 'tps'; }); await sleep(1500); await shot(pre + '_tps');
  await ev(() => { const G = __G, pl = G.player; pl.camMode = 'fps'; pl.give('gaviao'); pl.addAmmo('308', 30); G.__I.ads = true; }); await sleep(2200); await shot(pre + '_scope');
  await ev(() => { const G = __G; G.__I.ads = false; G.ui.open('inv'); }); await sleep(900); await shot(pre + '_inv');
  await ev(() => { __G.ui.open('buy'); }); await sleep(900); await shot(pre + '_buy');
  await ev(() => { __G.ui.open('map'); }); await sleep(900); await shot(pre + '_map');
  await ev(() => { __G.ui.close(); __G.endMatch(); __G.ui.open('ars'); }); await sleep(1800); await shot(pre + '_ars');
  await ev(() => { __G.ui.open('chars'); }); await sleep(1200); await shot(pre + '_chars');
  await ev(() => { __G.ui.open('settings'); }); await sleep(900); await shot(pre + '_settings');
};
