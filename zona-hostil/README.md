# ZONA HOSTIL

FPS/TPS Battle Royale 3D original, feito em TypeScript + three.js (WebGL 2), com personagens humanos
gerados a partir do MakeHuman (CC0) e animações de captura de movimento real (CMU).

**Estado atual:** Fase 1 concluída: personagem, câmera e movimentação.
Veja [docs/FASE1_RELATORIO.md](docs/FASE1_RELATORIO.md) e o [plano técnico](docs/PLANO_TECNICO.md).

```bash
npm install
npm run dev                         # jogo em http://localhost:5173
npm test                            # testes unitários (Vitest)
npm run build && npm run test:e2e   # testes no navegador real (Playwright)
```

## Regerar assets
- Texturas do mundo: `python3 tools/textures/gen_textures.py public/assets/textures`
- Soldados e animações: veja [tools/character/README.md](tools/character/README.md)

## Licenças
Código e assets próprios deste projeto. Assets de terceiros: veja [docs/CREDITOS.md](docs/CREDITOS.md).
