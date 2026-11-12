module.exports = async ({ p, shot, ev, sleep }) => {
  await ev(() => { __G.startMatch('treino', 1); }); await sleep(800);
  await ev(() => { __G.ui.open('settings'); }); await sleep(300);
  const e = await p.$('[data-a=hudedit]'); await e.scrollIntoViewIfNeeded(); await sleep(100); const b = await e.boundingBox(); console.log('box', JSON.stringify(b));
  await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(400);
  console.log(JSON.stringify(await ev(() => ({ edit: __G.hudEdit, hidden: document.getElementById('edit').hidden, html: document.getElementById('edit').innerHTML.length, panel: document.getElementById('panel').hidden, cls: document.body.className }))));
  const fb = await (await p.$('.hb[data-k=fire]')).boundingBox(); console.log('fire', JSON.stringify(fb));
  await p.mouse.move(fb.x + 40, fb.y + 40); await p.mouse.down(); await p.mouse.move(fb.x - 20, fb.y - 30, { steps: 4 }); await p.mouse.up(); await sleep(200);
  console.log(JSON.stringify(await ev(() => __G.__layout().fire))); await shot('u_edit');
  const s = await p.$('#edit [data-a=save]'); if (s) { const sb = await s.boundingBox(); await p.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2); await sleep(300); }
  console.log(JSON.stringify(await ev(() => ({ keys: Object.keys(localStorage), edit: __G.hudEdit }))));
};
