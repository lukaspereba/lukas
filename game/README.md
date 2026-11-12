# Carapicuíba Royale

FPS/TPS Battle Royale 3D para navegador (celular e computador), ambientado em uma versão compacta de Carapicuíba, SP.
Feito do zero em **Three.js (WebGL2)**, com todo o conteúdo (modelos, texturas, animações e sons) gerado por código.

## Como jogar

- **Arquivo único:** abra `jogar.html` em qualquer navegador moderno (Chrome no Android recomendado). Não precisa de servidor.
- **Pelo código-fonte:** `npm install`, `npm run build` e `npm run serve` (abre em `http://localhost:8080`).
- **No celular, na mesma rede Wi-Fi:** rode `npm run serve` no computador e abra `http://IP-DO-COMPUTADOR:8080` no celular.

O jogo funciona em retrato e em paisagem; em paisagem a área de visão é maior.

### Controles (toque)

| Ação | Como |
|---|---|
| Andar | Analógico à esquerda |
| Olhar | Arrastar o dedo em qualquer área livre (ou no botão de tiro) |
| Correr automático | Botão CORRER (liga/desliga; o analógico continua guiando) |
| Atirar / mirar | Botão vermelho / MIRA |
| Pular, agachar, deitar | PULO, AGACH, DEITA. Agachar correndo = deslize. Pular contra um muro = escalar |
| Trocar arma | Tocar no nome da arma (canto superior esquerdo) |
| Granada letal / tática / placa | ✸ / ☁ / ▰ |
| Drone, caixa de munição / UAV | ⌖ / ✈ (aparecem quando você tem o item) |
| Interagir (portas, caixas, lojas, veículos, contratos) | USAR |
| Inventário / pausa | 🎒 / ☰ (a troca de câmera 1ª/3ª pessoa fica no menu de pausa) |

Teclado e mouse: WASD, Shift, Espaço, C, Z, R, E, G, Q, V, 1-2-3, 4 (placa), X, 5, T, M, Tab, Esc.

**Editor de HUD:** Ajustes → Botões na tela → Editar HUD (mover, redimensionar, opacidade, salvar, restaurar). O layout é salvo separadamente para retrato e paisagem.

### Modo Deus (explorar o mapa)

Toque 5 vezes na logo do menu (ou Ajustes → Código) e digite `djalma67`. Você fica invencível, o gás não machuca e os bots ignoram você.
Na partida, ☰ abre os controles: ligar/desligar, voar (PULO sobe, AGACH desce), velocidade 1×/2×/4× e ir direto a cada local.
O botão "Explorar o mapa agora" abre o Treino livre, que não tem zona.

O HUD mostra só o essencial: vivos/abates, vida e colete, arma e munição, minimapa com o tempo da zona. Botões de granada, placa, drone e UAV só aparecem quando você tem o item.

### Modo desenvolvedor

Toque 5 vezes na logo do menu e digite o código (somente minúsculas). Libera: modo deus, voo, velocidade, munição infinita,
criar/remover/congelar bots, criar aliado, testar as 20 armas, equipamentos, personagens, teletransporte para os locais e diagnóstico.
O jogo é 100% local (sem servidor), então o código fica no cliente; em um multiplayer futuro a verificação teria de ir para o servidor.

## O que existe

- **Mapa** 640 × 640 m com relevo (morros, ruas inclinadas, fundações e escadas), malha de ruas, ~200 casas e comércios com interior, postes, fiação, árvores.
- **Locais das fotos:** Quadra fechada do Jandaia (foto 1), Plaza Shopping com 2 pisos, lojas abertas/fechadas, praça de alimentação, doca e cobertura (fotos 2–4),
  EE Basílio Bosniac e Igreja São Lucas lado a lado na R. Europa (fotos 5–8), Parque do Planalto com ginásio, parque aquático central, quatro quadras em dois patamares e campo sintético afastado (fotos 9–11).
- **Sede do time** no centro: recepção, administração, sala de equipamentos, convivência no 2º piso, quadra interna, vestiário, banheiros, chuveiros, uniformes.
- **Personagens:** Lukas, Bahia, Kaique e Mosquitão (nessa ordem das fotos), com cabelo, tom de pele e roupa baseados em cada foto; 4 trajes.
- **Pets:** Belo (gato cinza e branco), Louro (periquito) e Nina (salsicha).
- **20 armas** com modelo, som, dano, alcance, cadência, recuo e recarga próprios; 5 miras; faca e punhos.
- **Equipamentos:** granadas de fragmentação, fumaça, atordoamento e distração; drone controlável; UAV; placas; máscara de gás; caixa de munição; autorreanimação.
- **Battle Royale:** avião, salto, queda livre, paraquedas, zona em 5 etapas, gás, contratos (alvo, reconhecimento, suprimentos, captura), Gulag, Ressurgência, Solo/Duo/Squad, espectador.
- **Loot e economia:** 185 caixas, itens no chão, inventário com limites, dinheiro, 7 lojas com recompra de aliado e loadout.
- **Bots:** saqueiam, usam cobertura, perseguem, respeitam aliados, fogem do gás, dirigem até a zona, 3 dificuldades.
- **Veículos:** jipe, caminhonete, carro, blindado e helicóptero.

## Arquitetura (`src/`)

| Arquivo | Função |
|---|---|
| `engine.js` | Renderizador, céu, luz, sombras, culling por distância, resolução dinâmica |
| `textures.js`, `batcher.js`, `mesh.js` | Texturas procedurais em um único array; geometria fundida por região; modelos por código |
| `terrain.js`, `kit.js`, `world.js`, `poi.js` | Relevo e ruas; kit de construção; quadras e mobiliário; locais das fotos e sede |
| `physics.js`, `nav.js` | Colisão própria (caixas em grade + rampas + terreno), raios; malha de navegação e A* |
| `actors.js`, `player.js`, `viewmodel.js`, `character.js`, `weaponmodels.js` | Combate, jogador, arma em 1ª pessoa, humanoides animados, modelos das armas |
| `bots.js`, `br.js`, `loot.js`, `equipment.js`, `vehicles.js`, `pets.js` | IA, regras da partida, loot/lojas, equipamentos, veículos, pets |
| `ui.js`, `input.js`, `audio.js`, `fx.js` | HUD e menus, toque/teclado, áudio sintetizado, partículas |

## Otimização aplicada

- Um único material e uma textura em array para todo o cenário; geometria fundida em regiões de 80 m (3 malhas por região).
- Culling por distância com dois níveis (estrutura × detalhe) além do frustum culling; detalhes somem quando o jogador está no alto.
- Vidros, portas, caixas, itens, marcas de tiro e carros estacionados em malhas instanciadas; partículas em um único draw call.
- Sombra única que segue a câmera; só personagens próximos projetam sombra.
- Colisão e navegação próprias; bots distantes não são desenhados.
- Cópias de geometria na RAM são liberadas após o envio à GPU.
- Predefinições Baixo/Médio/Alto/Personalizado, limite de FPS (30/60/90/120/livre) e resolução dinâmica para segurar a meta de FPS.

## Testes executados (Chromium headless, `tests/`)

| Teste | Resultado |
|---|---|
| `t2` jogabilidade em Treino (andar, sprint, colisão, pulo, agachar, deitar, deslize, tiro, recarga, troca, mira, granada, placa, caixa, loja, veículo, drone, UAV) | 15/15 |
| `t3` Battle Royale completo em avanço rápido (avião → salto → pouso → zona → Gulag → fim) e Ressurgência em Duo até a vitória | sem erros |
| `t6`/`t7` interface com toques reais (código do dev certo/errado, pets, personagem, loja, arsenal, modo, jogar, correr automático, inventário, pausa, editor de HUD) | passou |
| `t8` Gulag (derrota e vitória) e Duo com derrubado | sem erros |
| `t10` métricas de renderização por predefinição | abaixo |

Rodar: `npm run build` e `node tests/run.cjs tests/t2.cjs` (largura e altura opcionais).

## Relatório de desempenho

Medido em Chromium headless **com renderização por software (sem GPU)**. Os números de carga de cena valem para qualquer aparelho; **FPS em celular real não foi medido** neste ambiente.

| Predefinição | Draw calls | Triângulos | Observação |
|---|---|---|---|
| Baixo (sem sombras, 60% da resolução, 150 m) | 34–49 | 83–114 mil | |
| Médio (sombras 1024, 80%, 220 m) | 53–105 | 132–242 mil | inclui a passada de sombra |
| Alto (sombras 2048, 100%, 300 m) | 56–121 | 134–267 mil | inclui a passada de sombra |

Cenas medidas: praça/sede, interior do shopping, Parque do Planalto, rua residencial, escola/igreja.

- Simulação (23 bots, física, loot, zona): 0,2–0,4 ms por quadro no servidor de teste.
- Memória JavaScript após coleta: ~61 MB. Cena total: ~409 mil triângulos, 18,7 mil colisores.
- Carregamento: ~5 s no servidor de teste. Pacote: 1,0 MB (arquivo único).
- Use Ajustes → Diagnóstico para ver FPS, tempo de quadro, resolução, draw calls e memória no seu aparelho.

## Pendências e limites

- Gráficos são estilizados (geometria e texturas por código); não há rostos fotorrealistas nem animação por captura de movimento.
- A logo oficial do time não foi enviada: a sede usa um escudo provisório preto e dourado ("SUA LOGO AQUI").
- O traçado das ruas é uma grade compacta inspirada na cidade, não uma cópia das ruas reais.
- Sem multiplayer online: todos os adversários e aliados são bots.
- Bots não sobem ao 2º piso nem pilotam helicóptero; não quebram vidro de propósito.
- Occlusion culling real não existe em WebGL; foi substituído por culling de distância e neblina.
- FPS de 60/90/120 em celular precisa ser medido no aparelho; a resolução dinâmica tenta manter 60.
