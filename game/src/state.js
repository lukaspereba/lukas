// Estado global compartilhado entre os módulos (evita importações circulares).
export const G = { time: 0, dt: 0, frame: 0, mode: 'menu', paused: false, chars: [], bots: [], vehicles: [], items: [], dev: { on: false, god: false, fly: false, ammo: false, speed: 1 } };
