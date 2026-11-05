# Loader de teste v4

## Implementado nesta versão

- Catálogo de armas, facas e luvas; kits musicais removidos.
- Seleção no loader antes de abrir o CS2, preparo por arma e aplicação ao equipar.
- Escolhas persistidas nas configurações existentes, incluindo desgaste, seed e StatTrak/counter.
- Troca de modelo da faca por funções nativas localizadas por assinatura única.
- Atributos das luvas alocados pelo alocador do jogo, com pedido de reaplicação.
- Nome/raridade e StatTrak enviados aos campos nativos do item.
- Misc com Auto Bhop ao segurar Espaço e céu preto.
- Mira Legit e Mira Rage separadas, ícones vetoriais para abas antes sem glifo.
- Fundo verde/amarelo/laranja/vermelho conforme intensidade da configuração.
- Aviso de Tela cheia em janela após login e ao iniciar; aviso de risco para Rage/config agressiva.

## Validação

Build Release local e checks offline de ABI/materiais, nomes UTF-8, modelos, raridade, seleção de alvos e round trip de perfil. Nenhum teste no processo do jogo foi realizado nesta versão. Facas, luvas, HUD e contador precisam de validação visual pelo usuário. O contador é configurável; não há incremento de kills implementado nesta versão.

## Ainda pendente

- Spinbot/anti-aim enviado aos outros jogadores mantendo a câmera local normal.
- Silent aim e integração atualizada com usercmd/subticks.
- Port completo do Rage Axion, incluindo autowall, lag compensation e hitchance.
- Auto strafe aéreo: o Auto Bhop atual repete o salto ao tocar o chão; não controla a direção.

A versão não oferece a garantia de eliminar dispersão/inaccuracy validada pelo servidor ao andar ou pular. Controles sem implementação não foram adicionados.

## Referências de implementação consultadas

- https://github.com/Mavrom/cs2-skinchanger (modelos e céu)
- https://github.com/Henrih56/cs2-skin-changer (atualização de cosméticos)
- https://github.com/arrpt/nerv (export do alocador tier0)
- https://github.com/T1GxR/Axion-CS2-RAGE-CHEAT (comparação dos mecanismos Rage/anti-aim; não portados integralmente)

O caminho funcional de regeneração das armas da v3 foi preservado. Esta compilação de PR mantém autenticação/licença e desativa somente o auto-update para evitar trocar a versão de testes pela versão de produção.
