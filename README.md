# Mac1ota Menu

Interface em português para o projeto de sobreposição do CS2, escrita em C# com ImGui. O menu usa um tema escuro com detalhes verdes e reúne as opções em Geral, Mira, Visuais, Perfis e Ajustes.

## Compilar

Requisitos: Windows x64 e SDK do .NET 10.

```powershell
dotnet restore "Mac1ota Menu.csproj"
dotnet build "Mac1ota Menu.sln" -c Release
```

Para gerar o executável:

```powershell
dotnet publish "Mac1ota Menu.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
```

O executável se chama `Mac1ota Menu.exe`.

## Usar o menu

A tecla padrão para abrir e fechar o menu é **Insert**. Ela pode ser alterada em Ajustes. A aba Perfis permite salvar, carregar e excluir configurações. Em Ajustes, você pode personalizar cores, opacidade, animações, sons e marca d'água.

Os dados ficam em `Documentos\Mac1ota Menu\CS2\External`. Para reutilizar dados de uma instalação anterior, copie suas configurações, mapas, sons e lançamentos para essa pasta. Os nomes internos das propriedades de configuração foram preservados.

## Créditos e licença

Autores originais: [xfi0](https://github.com/xfi0) / domok. Personalização da interface: Mac1ota Menu. O projeto é gratuito e mantém a licença GPL-3.0 disponível em [LICENSE](LICENSE).
