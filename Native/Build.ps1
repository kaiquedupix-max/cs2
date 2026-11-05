param([int]$Jobs = 4)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$vsDirectory = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$vsDirectory) { throw 'Instale o Visual Studio Build Tools com C++ x64 e CMake.' }
$cmake = Join-Path $vsDirectory 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
$ctest = Join-Path ([IO.Path]::GetDirectoryName($cmake)) 'ctest.exe'
if (!(Test-Path -LiteralPath $cmake)) { $cmake = (Get-Command cmake).Source; $ctest = (Get-Command ctest).Source }
$buildDirectory = Join-Path $repoRoot '.native-build'
New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
$batch = Join-Path $buildDirectory 'build-native.cmd'
$commands = @"
@echo off
chcp 65001 >nul
call "$vsDirectory\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 1
"$cmake" -S "$repoRoot\Native" -B "$buildDirectory" -G Ninja -DCMAKE_BUILD_TYPE=Release
if errorlevel 1 exit /b 1
"$cmake" --build "$buildDirectory" --target openchanger legit_native_checks -j $Jobs
if errorlevel 1 exit /b 1
"$ctest" --test-dir "$buildDirectory" --output-on-failure
exit /b %errorlevel%
"@
[IO.File]::WriteAllText($batch, $commands, [Text.UTF8Encoding]::new($false))
& cmd /d /c $batch
if ($LASTEXITCODE -ne 0) { throw "Falha no build C++: $LASTEXITCODE" }
