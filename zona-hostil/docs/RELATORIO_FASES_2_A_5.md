# Relatório — Fases 2 a 5 (evolução Carapicuíba)

Ambiente de teste: contêiner sem GPU. O WebGL roda na CPU (SwiftShader), então **os tempos de quadro
abaixo servem só para comparar versões entre si**. Eles não dizem quantos FPS o jogo faz num celular.
O número real do aparelho só aparece no contador de FPS do próprio jogo (Configurações → Jogabilidade →
Mostrar FPS).

## Fase 1 — auditoria, backup e fotos

- Backup do estado anterior: ramo `backup/fase1` (commit `d868ba3`).
- Fotos recebidas: 14. Ordem conferida:
  - 1: Quadra fechada do Jandaia
  - 2–4: Plaza Shopping Carapicuíba
  - 5–8: Escola Basílio Bosniac e Igreja São Lucas (o pedido numerou como 6–9)
  - 9–11: Parque do Planalto (o pedido numerou como 10–12)
  - 12–14: três fotos de pessoas
- **Faltam:** o arquivo da logo do time, e a 4ª foto de personagem. O pedido cita 4 pessoas (Lukas,
  Bahia, Kaique, Mosquitão) e chegaram 3 fotos.

## Fase 2 — animação e câmera

| Bug relatado | Causa encontrada | Correção |
|---|---|---|
| Partes do corpo bugadas em 3ª pessoa | o mixer do three.js só reescreve ossos cujo valor animado muda; as rotações procedurais se acumulavam quadro a quadro | a pose animada pura é restaurada antes de cada `mixer.update` |
| Cabeça inclinada para trás ao andar | os clipes de captura deixam a cabeça entre +17° e +38° para cima (medido) | estabilização no pescoço e na cabeça, que acompanham a mira |
| Braço/perna estranhos no pulo | clipe de salto vertical | pose aérea procedural + compressão no pouso |
| Personagem afunda ao deitar | pelve fixa ignorando o terreno | pelve alinhada à inclinação medida no peito e nos pés |
| Bots com os mesmos defeitos | mesmo código de animação | corrigidos junto, porque usam a mesma classe |

## Fase 3 — desempenho e modo desenvolvedor

Medido com `tools/bench.mjs` (480×270, perfil médio, mediana de 90 quadros):

| Cena | Antes | Depois |
|---|---|---|
| Campo de treino, spawn | 657 ms | 500 ms |
| Campo de treino, olhando ao norte | 535 ms | 367 ms |

- Terreno: o shader calcula os pesos antes e só lê as texturas das camadas presentes.
- Céu desenhado uma vez num cubemap (antes era calculado por pixel em todo quadro).
- Personagens distantes sem sombra e sem animação quando estão fora da visão.
- Resolução dinâmica (ligada por padrão) para segurar o FPS.
- O contador de FPS antigo usava média exponencial e mostrava valores errados. O "15–35 FPS" do
  relatório da Fase 1 vinha dele. O contador novo usa janela de 1 s.
- Modo desenvolvedor: 5 toques no logo abrem o pedido de código. O código não aparece na tela (campo
  de senha), e só o hash SHA-256 fica no pacote. Comparação exata em minúsculas. O painel tem voo livre,
  velocidade, teletransporte, troca de personagem, adicionar/remover manequins e painel de desempenho.
  Imortalidade e munição infinita já existem no painel e passam a valer quando dano e armas existirem.
  **Isto é proteção de interface, não autenticação.** Num servidor multiplayer, os privilégios precisam
  ser validados no servidor.

## Fase 4 — relevo real e plano do mapa

- Relevo real de Carapicuíba: AWS Terrain Tiles (SRTM/NED, terrarium z15). Janela de 560 m × 560 m, com
  61 m de desnível. Arquivo empacotado: `public/assets/maps/carapicuiba.json` (gerado por
  `tools/map/pack_heights.py`).
- O OpenStreetMap estava bloqueado na rede deste ambiente. Por isso, o **traçado das ruas e a posição
  exata dos prédios são interpretações** baseadas nas fotos e em pesquisa. As relações pedidas foram
  mantidas: escola ao lado da igreja na Rua Europa, igreja na esquina da Av. Inocêncio Seráfico, shopping
  no vale perto da avenida, parque em patamares com o aquático no meio e o campo no fundo, e a sede no
  centro.
- As ruas são niveladas sobre o relevo, com rampa máxima de 16% (10% na avenida).

## Fase 5 — locais das fotos

| Local | O que foi construído | Explorável |
|---|---|---|
| Quadra do Jandaia (foto 1) | quadra 46×28 m, mureta azul com alambrado, cobertura em arco, paredes de cobogó, tabelas (uma pendurada), traves, arquibancada, refletores | sim |
| Plaza Shopping (fotos 2–4) | fachada com marquise e letreiro, painel laranja, 2 pisos + cobertura, átrio com claraboia, 2 escadas rolantes, escada principal, escada de serviço, lojas abertas/fechadas/meio-abertas, praça de alimentação, cinema, corredor de serviço, depósitos, escada de incêndio até o teto | sim (interior inteiro) |
| Escola Basílio Bosniac (fotos 5–6) | muro pintado com portão e aviso, alambrado, placa, prédio de 2 andares com salas e carteiras, escada interna, quadra coberta, palmeiras | sim |
| Igreja São Lucas (fotos 7–8) | tijolo aparente, pilastras brancas, rosácea, pórtico com escada, torre de 21 m com cruz, bancos e altar, gradil verde, "box" amarelo no cruzamento | sim |
| Parque do Planalto (fotos 9–11) | 3 patamares: ginásio em arco e administração; parque aquático central com balde, 2 quadras azuis e área de skate; campo de grama no fundo com traves e arquibancada | sim |
| Sede do time (centro) | ginásio com quadra, recepção, administração, vestiários, chuveiros, área social, araras de uniforme, painel reservado para a logo | sim |
| Bairro | ruas e vielas, casas com e sem interior, caixas d'água, postes com fiação | casas marcadas como enteráveis |

Nomes de lojas são fictícios. A logo real do shopping não foi reproduzida (o letreiro usa um símbolo
original).

### Medições da Fase 5

Mesma ferramenta e mesmas configurações da Fase 3 (`tools/bench.mjs`, 480×270, perfil médio, sombras
médias, resolução dinâmica desligada). Renderização por CPU, então vale só a comparação:

| Cena | Mediana | p95 | Chamadas de desenho | Triângulos |
|---|---|---|---|---|
| Campo de treino, spawn | 483 ms | 1061 ms | 94 | 589 mil |
| Campo de treino, norte | 392 ms | 940 ms | 93 | 589 mil |
| Carapicuíba, sede (spawn) | 659 ms | 1600 ms | 257 | 891 mil |
| Carapicuíba, sede olhando ao norte | 736 ms | 1886 ms | 297 | 960 mil |

O mapa da cidade custa de 1,4× a 1,9× o campo de treino por quadro nesta medição. O que já reduz esse
custo:

- Estáticos mesclados por material em blocos de 140 m. As chamadas de desenho caíram de 677 para cerca
  de 290 no mapa.
- Cor das casas gravada nos vértices, para que todas usem um único material.
- Céu em cubemap, terreno com amostragem condicional e sombras só no perfil alto (PCF suave).
- Sombras dos personagens até 30 m.

**Ainda não medido:** o FPS num celular de verdade. Para saber quanto o jogo roda no seu aparelho, leia
o contador de FPS do jogo.

### Testes da Fase 5

`tests/e2e/run-e2e.mjs`, navegador real (Chromium) com toque emulado no celular:

- Começa em pé na sede ao tocar JOGAR.
- Todos os 11 locais existem. O personagem fica apoiado em cada um, sem atravessar o piso. Esse teste
  achou a igreja 6 m acima da avenida; ela foi baixada para o nível da rua e o lote foi cortado no morro.
- Anda pela Av. Inocêncio Seráfico.
- Sobe a escada rolante do shopping até o 1º piso (+5,5 m).
- Iluminação interna liga dentro do shopping.
- O quadro não fica preto.
- As verificações antigas continuam rodando no campo de treino (`?mapa=treino`).

## O que ainda falta

- Fase 6: logo do time na sede e uniformes (falta o arquivo da logo).
- Fase 7: personagens a partir das fotos (falta a 4ª foto).
- Fases 8 a 13: pets, as 20 armas, mira/granadas/drone, loot/inventário/estações de compra, novo menu e
  testes de integração.
- Áudio, bots com IA e dano. Imortalidade e munição infinita do modo dev passam a ter efeito quando dano
  e armas existirem.
