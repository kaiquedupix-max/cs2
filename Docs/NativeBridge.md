# Módulo nativo — versão de teste v5

O loader continua em C# e embute `legit_native.dll`, compilado em C++23. A DLL é extraída em `%LOCALAPPDATA%/legitbaratinho/native/<SHA256>/` e carregada somente após o login e a conexão com o CS2. A autenticação e a licença do loader permanecem no caminho existente.

## Procedência

- [Axion anti-aim](https://github.com/T1GxR/Axion-CS2-RAGE-CHEAT/blob/main/cstrike/features/antiaim/antiaim.cpp) e [movimento](https://github.com/T1GxR/Axion-CS2-RAGE-CHEAT/blob/main/cstrike/features/misc/movement.cpp): referência de alterações em comandos e correção de movimento.
- [Asphyxia-Rage anti-aim](https://github.com/zyzzfh/Asphyxia-Rage/blob/master/cstrike/features/rage/antiaim.cpp) e [CreateMove](https://github.com/zyzzfh/Asphyxia-Rage/blob/master/cstrike/core/hooks.cpp): comparação do tratamento de câmera e comandos. O projeto contém TODO explícito de CRC e não é uma implementação atual pronta para copiar.
- [OpenChanger a8779e9](https://github.com/realmaximg/OpenChanger/tree/a8779e932438fc83268d69150f245eaf871c2aee): base MIT do SDK e do inventário local/SOC, luvas, modelos e StatTrak. Download fixado por commit e SHA-256 no CMake. O frontend do OpenChanger é excluído; as escolhas continuam no loader/ImGui existente.
- [SteamDatabase/Protobufs](https://github.com/SteamDatabase/Protobufs/tree/master/csgo): snapshot de usercmd/cs_usercmd. Os campos foram preservados; imports e opções particulares do gerador Valve foram simplificados para gerar as classes com protobuf 3.21.8. Só são alteradas mensagens já existentes do jogo; não são alocadas mensagens novas no heap do jogo.

A ponte entre C# e C++, o protocolo, a integração das configurações e a adaptação dos callbacks são código deste projeto. Não se trata de um port integral do Axion/Asphyxia.

## Implementação

- Cosméticos: troca o caminho de fallback por identidades/atributos no inventário local e callbacks de decode. O HUD obtém os nomes localizados e a raridade do item, em vez de transformar o nome da skin em uma name tag.
- Corrige também o mapeamento ausente de `m_szCustomName` do caminho externo anterior.
- Luvas: SOC/identidade reais no cliente, reaplicação ao mudar o item. Faixas/Hand Wraps 5032 têm rótulo explícito em português. Armas seguradas pelo jogador são identificadas pelo proprietário atual, incluindo armas adquiridas de outros jogadores/mapas de treino.
- StatTrak: atributos de kills/contador no item do inventário, qualidade adequada e evento de morte do módulo nativo. Contagens do inventário local são mantidas ao alterar opções de câmera/anti-aim. Salvar um perfil do C# ainda grava o contador escolhido no menu, não uma leitura de volta das kills acumuladas no C++.
- Spinbot: altera yaw/pitch dos comandos e históricos, corrige o movimento e preserva os ângulos usados pela câmera local. Suspende durante ataque/uso e com granadas. Não usa a rotação visível externa da câmera.
- Mira silenciosa: a seleção de alvo existente publica o ângulo na ponte, que altera os comandos/histórico; o C# deixa de gravar o ângulo visível nesse modo. Disparo continua sujeito aos filtros configurados e à prontidão da arma.
- Auto stop: contramovimento nativo e espera pelo limite de velocidade antes de disparar.
- Auto Bhop: salto nos comandos por estado de chão e movimento aéreo automático opcional, mantendo Espaço pressionado.
- Terceira pessoa: opção em Misc e distância ajustável, usando callbacks de câmera identificados no cliente atual.
- Chat: opção desligada por padrão em Misc. Alterna três mensagens de legitbaratinho.xyz em eventos round_start/round_end; não envia mensagens durante o desenvolvimento.
- Sem dispersão: somente comando `weapon_accuracy_nospread` do servidor local com `sv_cheats 1`. Não é um método para remover dispersão no matchmaking.

O callback CreateMove e a obtenção do comando são validados pelo fluxo de instruções atual, incluindo stride 0x98 e offset de sequência decodificado, em vez de copiar os layouts antigos 0x88 e índices de câmera. As duas assinaturas de callbacks de terceira pessoa e o acesso a ângulos foram conferidos no client.dll em disco. Nenhum teste no processo do jogo foi executado.

## Build e verificações

1. Visual Studio Build Tools com C++ x64 e CMake/Ninja.
2. `powershell -ExecutionPolicy Bypass -File Native/Build.ps1`
3. `dotnet run --project Tests/SkinMaterialChecks.csproj -c Release`
4. `dotnet build "Mac1ota Menu.csproj" -c Release -p:LegitPreviewBuild=true`

O build do loader falha se o DLL não tiver sido compilado. O CI verifica o protocolo, geometria de movimento, serialização de perfil e o hash do DLL embutido; publica um único EXE. As licenças do SDK e das bibliotecas são embutidas e extraídas junto do módulo.

Antes do teste, feche o loader anterior e reinicie o CS2 para eliminar as alterações de memória da v4. Use Tela cheia em janela. A confirmação visual/funcional fica com o usuário. Se algum link nativo falhar, consulte `%APPDATA%/legitbaratinho-native/dev/log.txt`; o módulo não tenta continuar com endereços ausentes.

## Limites ainda abertos

Esta versão não contém o port completo dos sistemas de penetração/autowall, lag compensation, resolver e hitchance do Axion/Asphyxia. Os novos caminhos nativos compilam e passam pelos checks offline; o comportamento de spinbot, câmera, comandos e cosméticos ainda requer teste real. Não há promessa de funcionamento em qualquer atualização do cliente nem de tiros sem dispersão em servidores remotos.
