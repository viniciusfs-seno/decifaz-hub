# Run interactively in your own terminal. The secret is never an argument or output.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$relativePath='.validation/turn-xirsys.env'
$settingsPath=Join-Path $repoRoot $relativePath
& git -C $repoRoot check-ignore --quiet -- $relativePath
if($LASTEXITCODE -ne 0){throw 'O arquivo precisa estar ignorado pelo Git antes da configuração.'}
if(-not (Test-Path -LiteralPath $settingsPath)){throw 'Modelo local ausente. Prepare o identificador e o canal no arquivo ignorado.'}
$turnSettings=@{}
foreach($line in [IO.File]::ReadAllLines($settingsPath)){
 if($line -match '^([A-Z_]+)=(.*)$'){$turnSettings[$Matches[1]]=$Matches[2].Trim().Trim('"',"'")}
}
if([string]::IsNullOrWhiteSpace($turnSettings['HUB_TURN_XIRSYS_IDENT']) -or $turnSettings['HUB_TURN_XIRSYS_CHANNEL'] -ne 'decifazhub'){throw 'Identificador local ou canal não preparado. Nenhum segredo solicitado.'}
$turnSecret=$null
$secretPointer=[IntPtr]::Zero
try{
 $turnSecret=Read-Host 'Segredo Xirsys (entrada oculta; não será impresso)' -AsSecureString
 if($turnSecret.Length -lt 16){throw 'Segredo incompleto'}
 $secretPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($turnSecret)
 $plainSecret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
 if($plainSecret -match '[\r\n]'){throw 'Formato inválido'}
 $lines=@('HUB_TURN_PROVIDER=xirsys','HUB_TURN_ENABLED=false','HUB_TURN_FREE_PLAN_CONFIRMED=false',('HUB_TURN_XIRSYS_IDENT='+$turnSettings['HUB_TURN_XIRSYS_IDENT']),('HUB_TURN_XIRSYS_SECRET='+$plainSecret),'HUB_TURN_XIRSYS_CHANNEL=decifazhub','')
 # Restrict the already ignored file before persisting any secret.
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=New-Object Security.AccessControl.FileSecurity
 $acl.SetAccessRuleProtection($true,$false)
 $acl.SetOwner($identity)
 $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','Allow')))
 $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule('SYSTEM','FullControl','Allow')))
 Set-Acl -LiteralPath $settingsPath -AclObject $acl
 [IO.File]::WriteAllText($settingsPath,($lines -join "`n"),(New-Object Text.UTF8Encoding($false)))
 $plainSecret=$null;$lines=$null
 Write-Host 'Configuração local salva. TURN permanece desligado. Validando somente o canal pela API…'
 & node (Join-Path $PSScriptRoot 'turn-account-validation.mjs')
 if($LASTEXITCODE -ne 0){throw 'Validação não concluída'}
}catch{
 Write-Error 'Configuração ou validação não concluída. Nenhum segredo foi impresso; a integração continua desligada.'
 exit 1
}finally{
 if($secretPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)}
 if($turnSecret){$turnSecret.Dispose()}
 $plainSecret=$null;$lines=$null
}
