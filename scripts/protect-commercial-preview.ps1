$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$path=Join-Path $root '.validation/commercial-preview-access.json'
& git -C $root check-ignore -q -- '.validation/commercial-preview-access.json'
if($LASTEXITCODE -ne 0){throw 'O arquivo privado deve estar ignorado antes da gravação'}
if(-not(Test-Path -LiteralPath $path)){[IO.File]::WriteAllText($path,'')}
$acl=[IO.File]::GetAccessControl($path,[Security.AccessControl.AccessControlSections]::Access);$acl.SetAccessRuleProtection($true,$false)
foreach($rule in @($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))){$acl.PurgeAccessRules($rule.IdentityReference)}
foreach($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))){$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow')))}
[IO.File]::SetAccessControl($path,$acl)
Write-Output 'Arquivo de acesso local protegido; nenhum valor exibido.'
