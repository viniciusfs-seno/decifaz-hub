# Local write and read-only API validation are separate modes.
[CmdletBinding()]
param([switch]$Inspect,[switch]$ValidateApi,[switch]$NoPrompt)
$ErrorActionPreference='Stop'
$stage='arguments';$turnSecret=$null;$secretPointer=[IntPtr]::Zero
function Write-TurnStage([string]$Name,[string]$Status){@{stage=$Name;status=$Status}|ConvertTo-Json -Compress|Write-Output}
function Get-TurnDacl([string]$Path){
 if($PSVersionTable.PSVersion.Major -ge 6){return [IO.FileSystemAclExtensions]::GetAccessControl([IO.FileInfo]::new($Path),[Security.AccessControl.AccessControlSections]::Access)}
 return [IO.File]::GetAccessControl($Path,[Security.AccessControl.AccessControlSections]::Access)
}
function Set-TurnDacl([string]$Path,[Security.AccessControl.FileSecurity]$Dacl){
 if($PSVersionTable.PSVersion.Major -ge 6){[IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]::new($Path),$Dacl)}else{[IO.File]::SetAccessControl($Path,$Dacl)}
}
try {
 if($Inspect -and $ValidateApi){throw [ArgumentException]::new('Choose one mode')}
 $repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
 $relativePath='.validation/turn-xirsys.env';$settingsPath=Join-Path $repoRoot $relativePath
 $stage='git_ignore';Write-TurnStage $stage 'started'
 & git -C $repoRoot check-ignore --quiet -- $relativePath 2>$null
 if($LASTEXITCODE -ne 0){throw [InvalidOperationException]::new('Ignored file required')}
 Write-TurnStage $stage 'passed'
 $stage='read_local';$turnSettings=@{}
 foreach($line in [IO.File]::ReadAllLines($settingsPath)){
  if($line -match '^([A-Z_]+)=(.*)$'){$turnSettings[$Matches[1]]=$Matches[2].Trim().Trim('"',"'")}
 }
 $fields=@{};foreach($key in @('HUB_TURN_PROVIDER','HUB_TURN_ENABLED','HUB_TURN_FREE_PLAN_CONFIRMED','HUB_TURN_XIRSYS_IDENT','HUB_TURN_XIRSYS_SECRET','HUB_TURN_XIRSYS_CHANNEL')){$fields[$key]=-not [string]::IsNullOrWhiteSpace($turnSettings[$key])}
 @{stage=$stage;status='passed';fields=$fields;turnDisabled=($turnSettings['HUB_TURN_ENABLED'] -eq 'false');planEnabled=($turnSettings['HUB_TURN_FREE_PLAN_CONFIRMED'] -eq 'true');powershell=$PSVersionTable.PSVersion.ToString()}|ConvertTo-Json -Compress -Depth 3|Write-Output
 $stage='acl_read';$existingAcl=Get-Acl -LiteralPath $settingsPath
 @{stage=$stage;status='passed';protected=$existingAcl.AreAccessRulesProtected}|ConvertTo-Json -Compress|Write-Output
 if($Inspect){exit 0}
 $stage='validate_local'
 if([string]::IsNullOrWhiteSpace($turnSettings['HUB_TURN_XIRSYS_IDENT']) -or $turnSettings['HUB_TURN_XIRSYS_CHANNEL'] -ne 'decifazhub'){throw [ArgumentException]::new('Local identity or channel invalid')}
 $hasSecret=-not [string]::IsNullOrWhiteSpace($turnSettings['HUB_TURN_XIRSYS_SECRET'])
 if($ValidateApi){
  if(-not $hasSecret){throw [InvalidOperationException]::new('Secret missing; API never prompts')}
  if($turnSettings['HUB_TURN_ENABLED'] -ne 'false'){throw [InvalidOperationException]::new('TURN must be disabled')}
  $stage='api_query';Write-TurnStage $stage 'started'
  $apiOutput=@(& node (Join-Path $PSScriptRoot 'turn-account-validation.mjs') 2>$null)
  $apiExit=$LASTEXITCODE;$api=($apiOutput -join "`n")|ConvertFrom-Json
  $code='invalid_validator_result'
  if($api.code -in @('channel_verified','configuration_missing','authorization_refused','provider_unavailable','channel_not_verified','network_or_response_failure')){$code=$api.code}
  $ok=$apiExit -eq 0 -and $api.channelVerified -eq $true -and $code -eq 'channel_verified'
  @{stage=$stage;status=$(if($ok){'passed'}else{'failed'});code=$code;channelVerified=$ok}|ConvertTo-Json -Compress|Write-Output
  if(-not $ok){exit 1};exit 0
 }
 if($hasSecret){$plainSecret=$turnSettings['HUB_TURN_XIRSYS_SECRET'];Write-TurnStage 'secret_input' 'reused_saved'}else{
  $stage='secret_input';if($NoPrompt){throw [InvalidOperationException]::new('Secret absent; prompt disabled')}
  $turnSecret=Read-Host 'Segredo Xirsys (entrada oculta)' -AsSecureString
  if($turnSecret.Length -lt 16){throw [ArgumentException]::new('Secret incomplete')}
  $secretPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($turnSecret)
  $plainSecret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
 }
 if($plainSecret -match '[\r\n]'){throw [ArgumentException]::new('Invalid secret format')}
 $stage='acl_build';Write-TurnStage $stage 'started'
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $system=New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
 # Request/persist only Access (DACL), not owner, group or audit/SACL.
 $acl=Get-TurnDacl $settingsPath
 $acl.SetAccessRuleProtection($true,$false)
 foreach($rule in @($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))){$acl.PurgeAccessRules($rule.IdentityReference)}
 # SID avoids translated account names; change the DACL only.
 $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','Allow')))
 $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($system,'FullControl','Allow')))
 Write-TurnStage $stage 'passed'
 $stage='acl_apply';Write-TurnStage $stage 'started';Set-TurnDacl $settingsPath $acl;Write-TurnStage $stage 'passed'
 $stage='acl_verify';$actual=Get-Acl -LiteralPath $settingsPath
 $rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $actual.AreAccessRulesProtected -or $rules.Count -ne 2){throw [Security.SecurityException]::new('Unexpected ACL')}
 foreach($rule in $rules){if($rule.IsInherited -or $rule.IdentityReference.Value -notin @($identity.Value,$system.Value) -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl'){throw [Security.SecurityException]::new('Unexpected ACL rule')}}
 Write-TurnStage $stage 'passed'
 $stage='file_write';Write-TurnStage $stage 'started'
 $lines=@('HUB_TURN_PROVIDER=xirsys','HUB_TURN_ENABLED=false','HUB_TURN_FREE_PLAN_CONFIRMED=false',('HUB_TURN_XIRSYS_IDENT='+$turnSettings['HUB_TURN_XIRSYS_IDENT']),('HUB_TURN_XIRSYS_SECRET='+$plainSecret),'HUB_TURN_XIRSYS_CHANNEL=decifazhub','')
 $expected=$lines -join "`n"
 [IO.File]::WriteAllText($settingsPath,$expected,(New-Object Text.UTF8Encoding($false)))
 Write-TurnStage $stage 'passed'
 $stage='file_verify';if([IO.File]::ReadAllText($settingsPath) -cne $expected){throw [IO.IOException]::new('Verification failed')};Write-TurnStage $stage 'passed'
 @{stage='local_complete';status='passed';secretReused=$hasSecret;turnDisabled=$true;apiQueried=$false}|ConvertTo-Json -Compress|Write-Output
 exit 0
}catch{
 # Never serialize ErrorRecord, Message, TargetObject or stack: they may contain secrets.
 $exception=$_.Exception;$leaf=$exception;while($leaf.InnerException){$leaf=$leaf.InnerException}
 $privilege='not_reported';if($leaf.PrivilegeName -in @('SeSecurityPrivilege','SeRestorePrivilege','SeTakeOwnershipPrivilege')){$privilege=$leaf.PrivilegeName}
 @{stage=$stage;status='failed';exceptionType=$exception.GetType().FullName;causeType=$leaf.GetType().FullName;hresult=('0x{0:X8}' -f $leaf.HResult);errorCode=($leaf.HResult -band 65535);privilege=$privilege}|ConvertTo-Json -Compress|Write-Output
 exit 1
}finally{
 if($secretPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)}
 if($turnSecret){$turnSecret.Dispose()}
 $plainSecret=$null;$lines=$null;$expected=$null;$turnSettings=$null
}
