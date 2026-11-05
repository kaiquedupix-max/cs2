# Rage — aquisição, varredura e disparo

A aba anterior alterava os campos do Aimbot por um preset. O novo `Rage` tem
seleção de alvo e controle de disparo próprios, com configurações salvas pelo
sistema de perfis existente. Habilitar Rage pausa Aimbot, TriggerBot e RCS
antigos; desabilitá-lo devolve o controle às configurações anteriores.

## Funções implementadas

- Prioridade por menor erro angular, menor vida ou menor distância, com desempate
  determinístico e manutenção do alvo enquanto ele continua elegível.
- Varredura dos centros de cabeça, pescoço, peito e pelve; seleção de corpo
  abaixo de uma vida configurável. Usa posições 3D dos ossos já lidos pelo projeto.
- Campo de mira em graus, alcance em metros e limite de giro por atualização.
  A normalização trata a passagem de yaw entre -180 e +180 graus.
- Verificação de visibilidade do ponto selecionado usando a geometria do mapa.
  Sem mapa carregado, o modo visível aguarda dados em vez de assumir linha livre.
- Compensação de recuo na mira, sem concorrer com o RCS antigo.
- Luneta automática para snipers e opção de exigir luneta antes do disparo.
- Disparo condicionado a tempo no alvo, intervalo mínimo, alinhamento angular,
  munição, tick de disponibilidade da arma, visibilidade e confirmação do alvo
  sob a mira pelo próprio jogo. Filtros adicionais por velocidade e contato
  com o chão. Intervalo mínimo não acelera a cadência autorizada pelo jogo.
- Pausa com menu aberto, perda de foco, jogador morto, compra ou cegueira.
  Facas, granadas, bomba e itens que não sejam armas de fogo não acionam disparo.

Ativação padrão: botão do meio do mouse; configurável. Fechar o menu antes de
usar. Disparo automático começa desligado. O status mostra espera por tecla,
falta de mapa, ausência de alvo ou dados de arma insuficientes.

## Referência do Axion

O fluxo foi estudado em:
- https://github.com/T1GxR/Axion-CS2-RAGE-CHEAT/blob/main/cstrike/features/rage/rage.h
- https://github.com/T1GxR/Axion-CS2-RAGE-CHEAT/blob/main/cstrike/features/rage/rage.cpp
- https://github.com/T1GxR/Axion-CS2-RAGE-CHEAT/blob/main/cstrike/features/penetration/penetration.cpp

O Axion usa CUserCmd, histórico/subtick, previsão do motor, superfícies e
simulação de dispersão. Esta implementação reaproveita a ideia de separar
varredura, seleção e condições de disparo, com código adaptado aos dados atuais.
Não incorpora offsets de dois anos atrás. Leituras e escritas novas checam
o resultado da API de memória e a quantidade de bytes transferidos.

Autowall, dano mínimo calculado por penetração, hitchance por sementes,
anti-aim, silent aim e exploração de subtick não estão implementados nesta revisão.
Também não se apresenta o filtro de velocidade como autostop nem os centros
de ossos como multipoint de cápsulas. Esses recursos exigem outros sistemas;
não há controles inativos fingindo que estão presentes.

Compilação e testes matemáticos podem ser executados sem abrir o jogo. Os
testes de comportamento dentro do CS2 ficam com o usuário.


## Atualização v5
O caminho C++ de comandos e suas referências/limitações estão em [NativeBridge.md](NativeBridge.md). Inclui spinbot, mira silenciosa e auto stop para testes; não é o port integral do Rage Axion/Asphyxia.
