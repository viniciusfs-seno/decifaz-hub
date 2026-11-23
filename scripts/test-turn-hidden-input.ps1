# Run with powershell.exe (5.1) and pwsh.exe (7). Fictitious inputs; no provider IO.
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot=Join-Path $repoRoot ('.validation\hidden-input-test-'+[guid]::NewGuid().ToString())
$engine=(Get-Process -Id $PID).Path
New-Item -ItemType Directory -Path $testRoot -Force|Out-Null
$fixtureSecret=[guid]::NewGuid().ToString();$passed=0
function Assert([bool]$Value,[string]$Label){if(-not $Value){throw ('Regression failed: '+$Label)}}
foreach($scenario in @('save','reuse','inspect','api-ok','api-refused','api-network','ignore','acl-failure','write-failure','input-failure','no-prompt')){
 $caseRoot=Join-Path $testRoot $scenario
 New-Item -ItemType Directory -Path (Join-Path $caseRoot 'scripts') -Force|Out-Null
 New-Item -ItemType Directory -Path (Join-Path $caseRoot '.validation') -Force|Out-Null
 $script=Join-Path $caseRoot 'scripts\configure-turn-hml.ps1'
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'configure-turn-hml.ps1') -Destination $script
 if($scenario -eq 'acl-failure'){
  $source=[IO.File]::ReadAllText($script).Replace('Set-TurnDacl $settingsPath $acl;',"throw [Security.AccessControl.PrivilegeNotHeldException]::new('SeSecurityPrivilege');")
  [IO.File]::WriteAllText($script,$source,(New-Object Text.UTF8Encoding($true)))
 }
 [IO.File]::WriteAllText((Join-Path $caseRoot '.gitignore'),$(if($scenario -eq 'ignore'){''}else{"/.validation/`n"}))
 & git -C $caseRoot init --quiet
 $envPath=Join-Path $caseRoot '.validation\turn-xirsys.env'
 $saved=$scenario -in @('reuse','inspect','api-ok','api-refused','api-network')
 $content="HUB_TURN_PROVIDER=xirsys`nHUB_TURN_ENABLED=false`nHUB_TURN_FREE_PLAN_CONFIRMED=false`nHUB_TURN_XIRSYS_IDENT=fictional`nHUB_TURN_XIRSYS_SECRET="+$(if($saved){$fixtureSecret}else{''})+"`nHUB_TURN_XIRSYS_CHANNEL=decifazhub`n"
 [IO.File]::WriteAllText($envPath,$content)
 $beforeWrite=(Get-Item -LiteralPath $envPath).LastWriteTimeUtc.Ticks
 if($scenario -eq 'write-failure'){(Get-Item -LiteralPath $envPath).IsReadOnly=$true}
 # Private fixture input is never passed on a command line or printed.
 [IO.File]::WriteAllText((Join-Path $caseRoot '.validation\fixture-input'),$fixtureSecret)
 $runner=@'
param([string]$Scenario)
$ErrorActionPreference='Stop'
$fake=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '.validation\fixture-input'))
function Read-Host {param([string]$Prompt,[switch]$AsSecureString)
 if($Scenario -notin @('save','acl-failure','write-failure','input-failure')){throw 'Must not prompt'}
 if(-not $AsSecureString){throw 'Unmasked input'}
 if($Scenario -eq 'input-failure'){throw [InvalidOperationException]::new($fake+' Authorization: Basic private-fixture')}
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot '.validation\prompted'),'yes')
 ConvertTo-SecureString $fake -AsPlainText -Force
}
function node {param([string]$Path)
 if($Scenario -notin @('api-ok','api-refused','api-network')){throw 'API called during local mode'}
 [IO.File]::WriteAllText((Join-Path $PSScriptRoot '.validation\queried'),'yes')
 $global:LASTEXITCODE=1;$code='authorization_refused'
 if($Scenario -eq 'api-ok'){$global:LASTEXITCODE=0;$code='channel_verified'}
 if($Scenario -eq 'api-network'){$code='network_or_response_failure'}
 @{code=$code;channelVerified=($Scenario -eq 'api-ok');secret=$fake;Authorization='Basic private-fixture'}|ConvertTo-Json -Compress
}
$options=@{}
if($Scenario -like 'api-*'){$options.ValidateApi=$true}
if($Scenario -eq 'inspect'){$options.Inspect=$true}
if($Scenario -eq 'no-prompt'){$options.NoPrompt=$true}
& (Join-Path $PSScriptRoot 'scripts\configure-turn-hml.ps1') @options
exit $LASTEXITCODE
'@
 $runnerPath=Join-Path $caseRoot 'run.ps1';[IO.File]::WriteAllText($runnerPath,$runner,(New-Object Text.UTF8Encoding($true)))
 $output=@(& $engine -NoProfile -File $runnerPath $scenario 2>&1);$code=$LASTEXITCODE;$text=$output -join "`n"
 Assert (-not $text.Contains($fixtureSecret) -and -not $text.Contains('Authorization') -and -not $text.Contains('private-fixture')) ($scenario+' redaction')
 $rows=@($output|ForEach-Object {$_|ConvertFrom-Json});$last=$rows[-1]
 $success=$scenario -in @('save','reuse','inspect','api-ok')
 Assert (($code -eq 0) -eq $success) ($scenario+' exit code')
 if($scenario -in @('save','reuse')){
  Assert ([IO.File]::ReadAllText($envPath).Contains('HUB_TURN_XIRSYS_SECRET='+$fixtureSecret)) ($scenario+' saved')
  Assert ($last.stage -eq 'local_complete' -and $last.apiQueried -eq $false -and $last.turnDisabled) ($scenario+' local result')
  Assert ((Get-Acl -LiteralPath $envPath).AreAccessRulesProtected) ($scenario+' ACL')
  Assert ((Test-Path (Join-Path $caseRoot '.validation\prompted')) -eq ($scenario -eq 'save')) ($scenario+' prompt policy')
 }else{
  Assert ([IO.File]::ReadAllText($envPath) -ceq $content) ($scenario+' preserved file')
  Assert ((Get-Item -LiteralPath $envPath).LastWriteTimeUtc.Ticks -eq $beforeWrite) ($scenario+' no write')
 }
 if($scenario -like 'api-*'){
  Assert (Test-Path (Join-Path $caseRoot '.validation\queried')) ($scenario+' separate API')
  Assert ($last.stage -eq 'api_query') ($scenario+' result stage')
 }else{Assert (-not (Test-Path (Join-Path $caseRoot '.validation\queried'))) ($scenario+' no API')}
 if($scenario -eq 'acl-failure'){Assert ($last.stage -eq 'acl_apply' -and $last.causeType -eq 'System.Security.AccessControl.PrivilegeNotHeldException' -and $last.hresult -eq '0x80070005') 'ACL error diagnostics'}
 if($scenario -eq 'write-failure'){Assert ($last.stage -eq 'file_write' -and $last.errorCode -eq 5) 'Write error diagnostics'}
 if($scenario -eq 'ignore'){Assert ($last.stage -eq 'git_ignore' -and -not (Test-Path (Join-Path $caseRoot '.validation\prompted'))) 'Ignore before prompt/write'}
 if($scenario -eq 'input-failure'){Assert ($last.stage -eq 'secret_input' -and $last.causeType -eq 'System.InvalidOperationException') 'Input redaction'}
 if($scenario -eq 'inspect'){Assert ($last.stage -eq 'acl_read' -and $rows[2].fields.HUB_TURN_XIRSYS_SECRET -eq $true) 'Presence only'}
 if($scenario -eq 'write-failure'){(Get-Item -LiteralPath $envPath).IsReadOnly=$false}
 $passed++
}
Write-Output ('PASS: '+$passed+' scenarios; PowerShell '+$PSVersionTable.PSVersion.ToString()+'; local/API separate, saved key reused, ACL/write failures sanitized; fictitious inputs only.')
