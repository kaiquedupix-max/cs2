$ErrorActionPreference = "Stop"

$workspace = [IO.Path]::GetFullPath($PSScriptRoot)
Set-Location -LiteralPath $workspace

Get-Process -Name "Mac1ota Menu", "legitbaratinho.xyz" -ErrorAction SilentlyContinue |
    Stop-Process -Force

$publishDirectories = @(
    (Join-Path $workspace "publish"),
    (Join-Path $workspace "publish-mac1ota"),
    (Join-Path $workspace "bin\Release\net10.0-windows7.0\win-x64\publish")
)

foreach ($directory in $publishDirectories) {
    $resolvedDirectory = [IO.Path]::GetFullPath($directory)
    $isInsideWorkspace = $resolvedDirectory.StartsWith(
        $workspace + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)

    if (-not $isInsideWorkspace) {
        throw "Diretório de publicação fora do projeto: $resolvedDirectory"
    }

    if (Test-Path -LiteralPath $resolvedDirectory) {
        Remove-Item -LiteralPath $resolvedDirectory -Recurse -Force
    }
}

dotnet publish ".\Mac1ota Menu.csproj" `
    --configuration Release `
    --runtime win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    "-p:AssemblyName=Mac1ota Menu" `
    --output ".\publish"

if ($LASTEXITCODE -ne 0) {
    throw "O publish falhou com o código $LASTEXITCODE."
}

Write-Host "`nExecutável criado em:" -ForegroundColor Green
Write-Host (Join-Path $workspace "publish\Mac1ota Menu.exe") -ForegroundColor Green
