// Testes de jogabilidade em Treino: movimento, colisão, posturas, tiro, recarga, granada, loot, loja, veículo, drone.
module.exports = async ({ p, shot, ev, sleep }) => {
  const r = await ev(() => { const G = __G, out = {}; G.simPause = true; const I = G.__I; G.startMatch('treino', 1); const pl = G.player; const sim = window.__sim; G.dev.freeze = true;
    const keys = (o) => Object.assign(G.__keys, o);
    // 1 movimento para frente (W) por 2 s
    const p0 = pl.pos.clone(); G.__keys.KeyW = true; sim(2); G.__keys.KeyW = false; sim(0.3); out.walk = +pl.pos.distanceTo(p0).toFixed(2); out.walkDir = [+(pl.pos.x - p0.x).toFixed(1), +(pl.pos.z - p0.z).toFixed(1)];
    // 2 sprint
    const p1 = pl.pos.clone(); G.__keys.KeyW = true; G.__keys.ShiftLeft = true; sim(1.5); out.sprint = +pl.pos.distanceTo(p1).toFixed(2); G.__keys.ShiftLeft = false; G.__keys.KeyW = false; sim(0.3);
    // 3 colisão: andar contra a fachada da sede (z=-18) a partir de z=-24
    pl.teleport(-15, G.terr.height(-15, -24) + 0.1, -24); pl.yaw = Math.PI; sim(0.3); G.__keys.KeyW = true; sim(3); G.__keys.KeyW = false; out.wallStopZ = +pl.pos.z.toFixed(2);
    // 4 pulo, agachar, deitar
    pl.teleport(0, G.terr.height(0, -40) + 0.05, -40); sim(0.5); const y0 = pl.pos.y; G.__hits.add('jump'); let maxY = 0; sim(1.2, 1 / 60, () => { maxY = Math.max(maxY, pl.pos.y - y0); }); out.jumpH = +maxY.toFixed(2); out.landed = pl.onGround;
    G.__hits.add('crouch'); sim(0.3); out.crouch = pl.crouch; out.eyeC = +pl.eyeH().toFixed(2); G.__hits.add('prone'); sim(0.4); out.prone = pl.prone; G.__hits.add('jump'); sim(0.3); G.__hits.add('jump'); sim(0.3); out.standAgain = !pl.crouch && !pl.prone;
    // 5 deslize
    G.__keys.KeyW = true; G.__keys.ShiftLeft = true; sim(1.2); G.__hits.add('crouch'); sim(0.2); out.sliding = pl.sliding; sim(1.2); out.slideEnd = !pl.sliding; G.__keys.KeyW = false; G.__keys.ShiftLeft = false; sim(0.5); if (pl.crouch) { G.__hits.add('crouch'); sim(0.2); }
    // 6 tiro em um bot parado 12 m à frente
    pl.teleport(0, G.terr.height(0, -60) + 0.05, -60); pl.yaw = 0; pl.pitch = 0; sim(0.4); G.devBots('add'); const b = G.bots.filter((x) => x.alive).sort((a, c) => a.pos.distanceTo(pl.pos) - c.pos.distanceTo(pl.pos))[0]; out.botDist = +b.pos.distanceTo(pl.pos).toFixed(1);
    const dx = b.pos.x - pl.pos.x, dz = b.pos.z - pl.pos.z; pl.yaw = Math.atan2(-dx, -dz); pl.pitch = Math.atan2(b.pos.y + 1.2 - (pl.pos.y + 1.6), Math.hypot(dx, dz)); sim(0.2); const a0 = pl.w.ammo, hp0 = b.hp + b.armor; I.fire = true; sim(1.0); I.fire = false; out.ammoUsed = a0 - pl.w.ammo; out.botDmg = +(hp0 - (b.hp + b.armor)).toFixed(0); out.botAlive = b.alive; out.kills = pl.kills;
    // 7 recarga
    const am = pl.w.ammo; G.__hits.add('reload'); sim(0.2); out.reloading = pl.reloadT > 0; sim(3); out.reloaded = pl.w.ammo === pl.w.def.mag && am < pl.w.def.mag;
    // 8 troca de arma e mira
    G.__hits.add('slot2'); sim(0.6); out.slot2 = pl.w.def.name; I.ads = true; sim(0.6); out.ads = +pl.adsT.toFixed(2); out.fovAds = +G.camera.fov.toFixed(1); I.ads = false; sim(0.4); G.__hits.add('slot3'); sim(0.5); out.melee = pl.cur === 2; G.__hits.add('slot1'); sim(0.5);
    // 9 granada
    const f0 = pl.inv.frag; pl.pitch = 0.2; G.__hits.add('lethal'); sim(0.2); out.fragThrown = f0 - pl.inv.frag; sim(4); 
    // 10 placa
    pl.armor = 50; G.__hits.add('plate'); sim(2); out.armorAfterPlate = pl.armor;
    // 11 caixa de loot mais próxima
    const L = G.__Loot; const c = L.crates.filter((x) => !x.open && Math.abs(x.y - G.terr.height(x.x, x.z)) < 1).sort((a, d) => (a.x ** 2 + a.z ** 2) - (d.x ** 2 + d.z ** 2))[0]; pl.teleport(c.x + 1.2, c.y + 0.1, c.z); sim(0.5); out.interact = G.interact && G.interact.type; const n0 = L.items.filter((i) => i.alive).length; G.__hits.add('interact'); sim(0.3); out.crateOpen = c.open; out.itemsSpawned = L.items.filter((i) => i.alive).length - n0; pl.teleport(c.x, c.y + 0.1, c.z); sim(1.0); out.cashAfter = pl.cash;
    // 12 loja
    const cash0 = pl.cash; out.buyUav = G.__buy(pl, 'drone') || G.__buy(pl, 'gasmask'); out.spent = cash0 - pl.cash;
    // 13 veículo
    G.devVehicles(); const v = G.vehicles.find((x) => !x.t.air); pl.teleport(v.pos.x + 2.2, v.pos.y + 0.2, v.pos.z); sim(0.4); out.vInteract = G.interact && G.interact.type; G.__hits.add('interact'); sim(0.2); out.inVehicle = pl.mode; const vp = v.pos.clone(); G.__keys.KeyW = true; sim(3); G.__keys.KeyW = false; out.drove = +v.pos.distanceTo(vp).toFixed(1); out.vSpeed = +v.speed.toFixed(1); G.__hits.add('interact'); sim(0.3); out.exited = pl.mode;
    // 14 drone
    pl.inv.drone = 1; pl.fieldSel = 'drone'; sim(0.5); G.__hits.add('field'); sim(0.3); out.drone = pl.mode; G.__keys.KeyW = true; sim(1); G.__keys.KeyW = false; G.__hits.add('interact'); sim(0.3); out.droneEnd = pl.mode;
    // 15 UAV
    pl.inv.uav = 1; G.__hits.add('streak'); sim(0.2); out.uav = +(G.match.uavT[0] || 0).toFixed(0);
    out.hp = pl.hp; out.alive = pl.alive; return out; });
  console.log(JSON.stringify(r, null, 1));
};
