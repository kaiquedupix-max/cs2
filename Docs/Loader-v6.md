# Correções v6

- Remove a entrada duplicada `m_szCustomName` que gerava TypeInitializationException na v5. A tentativa automática repetia a exceção e deixava o loader alternando client.dll/Atualizando dados indefinidamente.
- Inicialização fora do contexto modal do WinForms, downloads paralelos com limite, parsing indexado por classe e falha visível em vez de repetir a conexão indefinidamente.
- A matriz de visão deixa de ser interpretada como ponteiro para decidir baixar offsets novamente.
- Remove o seletor e o formulário extra do loader. Skins e CFG continuam apenas no menu dentro do jogo.
- Mantém as escolhas na seção CosmeticLoadout da CFG existente. O teste usa o mesmo serializador Newtonsoft do produto e confere definição, paint kit, seed, desgaste e StatTrak.
- Adiciona manutenção nativa independente dos callbacks de decode: invalida o estado em morte/spawn/round e acompanha pawn, armas e HUD recriados. Repõe identidade/modelo/materiais a partir da escolha salva, sem selecionar a skin novamente.
- Reenvia a sincronização do inventário local após respawn e aplica a rotina de reconstrução de materiais validada pelo comando nomeado do jogo. Repetições após falha são limitadas.

Validação: C++/C# compilados, testes de invalidação após respawn/troca de HUD, round trip de CFG e inicialização real do baixador/parser em menos de um segundo no ambiente local. Nenhum acesso ao processo do jogo foi feito nessa verificação. A confirmação na partida fica com o usuário.
