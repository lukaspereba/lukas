# ZONA HOSTIL

FPS/TPS Battle Royale 3D original, feito em TypeScript + three.js (WebGL 2), com personagens humanos
gerados a partir do MakeHuman (CC0) e animações de captura de movimento real (CMU).

**Estado atual:** Fases 1 a 5 concluídas. O jogo tem personagem, câmera, movimentação, modo
desenvolvedor e o mapa de Carapicuíba com relevo real e os locais das fotos.
Veja [docs/RELATORIO_FASES_2_A_5.md](docs/RELATORIO_FASES_2_A_5.md), [docs/FASE1_RELATORIO.md](docs/FASE1_RELATORIO.md)
e o [plano técnico](docs/PLANO_TECNICO.md).

Mapas: **JOGAR** abre Carapicuíba, e **CAMPO DE TREINAMENTO** abre o campo de testes. Pela URL, use
`?mapa=treino`.

```bash
npm install
npm run dev                         # jogo em http://localhost:5173
npm test                            # testes unitários (Vitest)
npm run build && npm run test:e2e   # testes no navegador real (Playwright)
```

## Regerar assets
- Texturas do mundo: `python3 tools/textures/gen_textures.py public/assets/textures`
- Texturas da cidade: `python3 tools/textures/gen_city.py public/assets/textures/city`
- Relevo de Carapicuíba (Float32 → JSON servível): `python3 tools/map/pack_heights.py relevo.bin meta.json public/assets/maps/carapicuiba.json`
- Soldados e animações: veja [tools/character/README.md](tools/character/README.md)

## Licenças
Código e assets próprios deste projeto. Assets de terceiros: veja [docs/CREDITOS.md](docs/CREDITOS.md).
