# Windows-only regression. No real key, account or provider request.
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot=Join-Path $repoRoot ('.validation\hidden-input-test-'+[guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path (Join-Path $testRoot 'scripts') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $testRoot '.validation') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts\configure-turn-hml.ps1') -Destination (Join-Path $testRoot 'scripts\configure-turn-hml.ps1')
[IO.File]::WriteAllText((Join-Path $testRoot '.gitignore'),"/.validation/`n")
& git -C $testRoot init --quiet
$envPath=Join-Path $testRoot '.validation\turn-xirsys.env'
[IO.File]::WriteAllText($envPath,"HUB_TURN_XIRSYS_IDENT=fictional`nHUB_TURN_XIRSYS_CHANNEL=decifazhub`n")
$fixtureSecret=[guid]::NewGuid().ToString()
$global:turnInputMasked=$false
$global:turnInputValidated=$false
function Read-Host {param([string]$Prompt,[switch]$AsSecureString) if(-not $AsSecureString){throw 'Input not hidden'};$global:turnInputMasked=$true;ConvertTo-SecureString $fixtureSecret -AsPlainText -Force}
function node {param([string]$ScriptPath)
 if([IO.Path]::GetFileName($ScriptPath) -ne 'turn-account-validation.mjs'){throw 'Wrong validator'}
 $content=[IO.File]::ReadAllText($envPath)
 if(-not $content.Contains('HUB_TURN_XIRSYS_SECRET='+$fixtureSecret)){throw 'Secret not saved'}
 if(-not $content.Contains('HUB_TURN_ENABLED=false') -or -not $content.Contains('HUB_TURN_FREE_PLAN_CONFIRMED=false')){throw 'Integration enabled'}
 $global:turnInputValidated=$true;$global:LASTEXITCODE=0
}
& (Join-Path $testRoot 'scripts\configure-turn-hml.ps1')
if(-not $global:turnInputMasked -or -not $global:turnInputValidated){throw 'Validation not invoked'}
if((Get-Acl -LiteralPath $envPath).Access | Where-Object { $_.IsInherited }){throw 'ACL inherited'}
$before=[IO.File]::ReadAllText($envPath)
[IO.File]::WriteAllText((Join-Path $testRoot '.gitignore'),'')
$global:turnInputMasked=$false
try{& (Join-Path $testRoot 'scripts\configure-turn-hml.ps1');throw 'Missing guard'}catch{if($_.Exception.Message -notmatch 'ignorado'){throw 'Ignore guard failed'}}
if($global:turnInputMasked -or [IO.File]::ReadAllText($envPath) -ne $before){throw 'Prompt or write before ignore check'}
Write-Output 'PASS: masked input, ignored file, private ACL, disabled flags, validator and fail-closed ignore guard; fictitious key only.'
