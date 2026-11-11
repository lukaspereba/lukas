import './styles.css';
import { Game } from './core/Game';

function supportsWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

const app = document.getElementById('app')!;
if (!supportsWebGL2()) {
  app.innerHTML = '<div class="zh-screen zh-loading error"><div class="zh-logo">ZONA <b>HOSTIL</b></div><div class="zh-load-label">Este navegador não suporta WebGL 2. Atualize o navegador ou ative a aceleração de hardware.</div></div>';
} else {
  const game = new Game(app);
  void game.start();
}
