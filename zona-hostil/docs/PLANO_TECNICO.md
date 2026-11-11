# ZONA HOSTIL — Plano técnico

FPS/TPS Battle Royale 3D original. Este documento registra a análise do ambiente, a escolha de
tecnologia, as limitações reais e a arquitetura. O andamento de cada fase está em `docs/FASE*_RELATORIO.md`.

## 1. Ambiente de desenvolvimento avaliado

| Item | Situação real verificada |
|---|---|
| Máquina | Contêiner Linux na nuvem, 4 CPUs, 15 GB RAM, **sem GPU** |
| Desenvolvedor | Trabalha pelo celular (sem editor gráfico local) |
| Ferramentas | Node 22, Python 3.13, Chromium + Playwright (WebGL via SwiftShader), ffmpeg, git-lfs |
| Rede | GitHub, npm e PyPI acessíveis. Poly Haven, ambientCG, Mixamo, Sketchfab, Quaternius, Freesound e makehumancommunity.org **bloqueados** |
| Blender | Disponível como módulo Python (`bpy` 5.3, PyPI), sem interface, usado para gerar e exportar assets |

## 2. Escolha da tecnologia

**Unreal Engine e Unity foram avaliados e descartados *neste ambiente*:**

- Os dois dependem de editor gráfico com GPU (não existe aqui) e de downloads de dezenas de GB atrás de login (Epic/Unity ID).
- Sem GPU não dá para rodar, testar nem compilar o build de celular (Android/iOS) dentro do contêiner.
- O desenvolvedor usa o celular: um projeto Unreal/Unity só poderia ser aberto e testado num PC.

**Escolha: motor próprio em TypeScript sobre three.js (WebGL 2), com pipeline de assets em Blender headless.**

- Roda em qualquer navegador moderno, **incluindo o do celular**. O jogo é testado de verdade aqui (Chromium headless) e no aparelho pelo link publicado.
- O renderizador PBR do three.js (sombras, IBL, tone mapping ACES) entrega visual moderno, e a qualidade escala por perfis gráficos.
- Os assets (personagens, animações, texturas) são gerados por scripts versionados, então qualquer pessoa reproduz o build.
- Migração futura: os assets saem em glTF 2.0 (padrão aberto). Se o projeto for para Unreal/Unity num PC com GPU, personagens, animações e texturas são reaproveitados.

### Limitações honestas desta escolha

- WebGL não chega ao teto de um AAA nativo (Nanite/Lumen). O caminho é qualidade de assets, iluminação e animação, não contagem bruta de polígonos.
- Celular: o build web roda no navegador. Um app nativo (loja) exige empacotamento (Capacitor/TWA) numa fase posterior.
- **Multiplayer real** precisa de um servidor publicado (Node.js + WebSocket). O código do servidor pode ser escrito e testado aqui, mas a hospedagem pública depende de infraestrutura que o projeto ainda não tem. **Não haverá multiplayer simulado.**
- Áudio: sem bancos de sons acessíveis na rede, os efeitos serão sintetizados (WebAudio) ou gravados/gerados por script.

## 3. Fontes de assets (todas livres para uso comercial)

| Asset | Fonte | Licença |
|---|---|---|
| Corpo humano anatômico, morphs (gênero, idade, musculatura, peso, altura, etnia), esqueleto `game_engine` e pesos de skinning | MakeHuman via repositório MPFB2 | CC0 1.0 |
| Pele, olhos, sobrancelhas, cílios, roupas-base | Assets de sistema do MakeHuman | CC0 1.0 (relicenciados em 2020) |
| Animações | CMU Graphics Lab Motion Capture Database (conversão BVH cgspeed) | Uso livre (inclusive comercial, sem revenda dos dados brutos) |
| Equipamento tático, camuflagens, texturas do mundo, mapa | Gerados por scripts deste projeto | Próprios |

O addon MPFB2 **não é executado**: escrevi um leitor próprio para os arquivos de dados (`tools/character/mhdata.py`).

## 4. Arquitetura

```
zona-hostil/
├─ src/
│  ├─ core/        Game (laço, estados de tela), Settings (persistência validada)
│  ├─ input/       InputState + fontes: teclado/mouse, gamepad, toque (joystick, botões)
│  ├─ physics/     CollisionWorld (heightfield + BVH), CharacterMotor (cápsula cinemática)
│  ├─ player/      PlayerController (máquina de estados), CameraRig (FPS/TPS), TrainingDummy
│  ├─ anim/        CharacterModel (blend de locomoção, IK, poses procedurais), ik.ts
│  ├─ world/       Heightfield, TerrainMesh (shader de mistura), TestRange, Environment
│  └─ ui/          Carregamento, menu inicial, HUD, pausa, configurações, créditos
├─ tools/character Gerador de soldados + retarget de mocap (Python/bpy)
├─ tools/textures  Gerador de texturas PBR tileáveis
└─ tests/          unit (Vitest) e e2e (Playwright, navegador real)
```

Princípios:

- **Lógica separada da renderização.** Física, controlador e configurações não dependem de DOM nem de WebGL, então rodam em testes Node.
- **Física em passo fixo (60 Hz)** com interpolação na renderização. É determinística, que é a base para o servidor autoritativo.
- **Entrada por ações** (`jump`, `crouch`…), nunca por teclas. Toque, teclado e gamepad alimentam o mesmo estado, e o layout de toque é descrito por dados (pronto para o editor de HUD da fase 7).
- **Nada de funcionalidade falsa.** Só aparece na tela o que funciona. O áudio não tem aba de configurações enquanto o motor de áudio não existir.

### Multiplayer (planejado para a fase 9)

- Servidor autoritativo Node.js + WebSocket reaproveitando `physics/` e `player/PlayerController`, que é lógica pura.
- Cliente envia **apenas entradas** numeradas. O servidor simula a 60 Hz e devolve snapshots a 20–30 Hz.
- Predição no cliente com reconciliação e interpolação de entidades remotas.
- Dano e acertos validados no servidor com rebobinagem de posições (lag compensation).
- Salas e lobby: matchmaking por modo (solo/duo/squad), reconexão por token de sessão.
- Antitrapaça básico: velocidade e teleporte validados no servidor, cadência e munição contadas no servidor.

## 5. Fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 1 | Fundação: projeto, arquitetura, personagem humano, câmera, movimentação | **Entregue** (ver relatório) |
| 2 | Mundo: mapa grande (cidade, vilarejos, base militar, aeroporto, rios, pontes), vegetação, interiores, ciclo dia/noite, LOD | Próxima |
| 3 | Combate: armas modeladas, miras, recuo, balística, recarga, dano por região, granadas, viewmodel em 1ª pessoa, ragdoll | — |
| 4 | Battle Royale: avião, salto, queda livre, paraquedas, zona segura, vitória | — |
| 5 | Loot, inventário, loja (moeda fictícia), drone, veículos | — |
| 6 | IA: bots com percepção, cobertura, equipes, dificuldade; modo treinamento completo | — |
| 7 | Interface: lobby, HUD personalizável (mover, redimensionar, opacidade, salvar) | — |
| 8 | Áudio espacial: armas, passos por superfície, ambiente, veículos | — |
| 9 | Multiplayer real (servidor autoritativo) | — |
| 10 | Polimento, otimização e testes em aparelhos reais | — |
