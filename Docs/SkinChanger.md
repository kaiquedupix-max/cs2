# Skin changer — versão para validação no jogo

O botão anterior escrevia somente os campos fallback; ele não reconstruía os materiais.
O novo caminho publica os atributos econômicos 6/7/8 (paint/seed/wear), seleciona
o modelo antigo/novo do catálogo e chama a rotina de regeneração de client.dll.
A execução ocorre fora da thread de desenho. Seleções ficam ativas nesta sessão,
inclusive com o menu fechado, e são aplicadas a novas armas equipadas.

Referência de implementação e discussão original:
- https://github.com/ValorantTracker/cs2-skin-changer
- https://www.unknowncheats.me/forum/counter-strike-2-releases/738534-cs2-external-skin-changer-source.html
- Catálogo: https://github.com/ByMykel/CSGO-API

## Limites desta versão

- Armas apenas; facas, luvas e kits musicais continuam sem aplicação.
- Use uma arma padrão sem atributos de inventário. O código recusa substituir
  listas pertencentes ao jogo, preservando stickers, charms e outros atributos.
- A assinatura e o registro do callback do comando `regenerate_weapon_skins` são
  verificados contra o jogo instalado. Não há patch de instruções em client.dll.
  Alterações incompatíveis no CS2 geram erro antes de escrever na arma.
- Um timeout impede novas chamadas nesse processo. A memória ainda potencialmente
  utilizada pela rotina fica alocada até o CS2 fechar.
- Retorno da rotina não é comprovação visual. A validação final é dentro do jogo.

## Verificação

```powershell
dotnet run --project Tests/SkinMaterialChecks.csproj -c Release
# Somente leitura; requer CS2 aberto. Não aplica skins:
dotnet run --project Tests/SkinMaterialChecks.csproj -c Release -- --probe
```

No jogo, selecionar AK-47, uma skin do modelo atual e clicar Aplicar skin.
Conferir textura, seed e desgaste. Repetir com uma skin legacy_model, AWP e USP-S.
Fechar o menu, alternar armas, morrer/recomprar e iniciar outra rodada.
Conferir que não há congelamento do menu. Uma arma com atributos próprios deve
mostrar uma mensagem e continuar intacta. Registrar a mensagem exata em caso de erro.

Licença da referência preservada em `Docs/ThirdParty/SkinChanger-MIT.txt`.

## Resultado local

Build Release x64: passou. Testes de ABI, limites de assinatura e identidade do
callback: passaram. O probe somente de leitura identificou a rotina pelo registro
do comando no CS2 aberto. A alteração visual ainda precisa ser validada no jogo.
O deslocamento fixo `+0x52` da referência antiga foi descartado: no binário instalado
ele está no meio de uma instrução. A referência Henrih56 usa a mesma assinatura e
não resolve essa diferença por si só.
