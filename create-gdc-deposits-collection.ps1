# create-gdc-deposits-collection.ps1
$ErrorActionPreference = "Stop"
$base = "https://l1-hanlim.hondi.net"
$email    = Read-Host "PocketBase admin email"
$password = Read-Host "PocketBase admin password" -AsSecureString
$plainPw  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
              [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
$authBody = @{ identity = $email; password = $plainPw } | ConvertTo-Json
$authRes  = Invoke-RestMethod -Method POST -Uri "$base/api/admins/auth-with-password" -ContentType "application/json" -Body $authBody
$token = $authRes.token
if (-not $token) { Write-Host "로그인 실패" -ForegroundColor Red; exit 1 }
$headers = @{ Authorization = $token }

$existing = $null
try { $existing = Invoke-RestMethod -Method GET -Uri "$base/api/collections/gdc_deposits" -Headers $headers -ErrorAction Stop } catch {}
if ($existing) {
    Write-Host "gdc_deposits 컬렉션이 이미 있습니다 — 건너뜁니다." -ForegroundColor Yellow
} else {
    $body = @{
        id = "tv4axq0f580cv3j"; name = "gdc_deposits"; type = "base"
        schema = @(
            @{ system=$false; id="atm7tcmq5qbbot1"; name="user_guid";     type="text";   required=$true;  presentable=$true; unique=$false; options=@{ min=$null; max=$null; pattern="" } }
            @{ system=$false; id="zquzug52ptj8qrb"; name="product_type"; type="text";   required=$true;  presentable=$true; unique=$false; options=@{ min=$null; max=$null; pattern="" } }
            @{ system=$false; id="naii0fkvggoytuy"; name="principal";    type="number"; required=$true;  presentable=$true; unique=$false; options=@{ min=0; max=$null } }
            @{ system=$false; id="d8xw08y8sweddti"; name="interest_rate";type="number"; required=$false; presentable=$true; unique=$false; options=@{ min=$null; max=$null } }
            @{ system=$false; id="aphhy0jptw8ee54"; name="vault_tx_hash";type="text";   required=$true;  presentable=$true; unique=$false; options=@{ min=$null; max=$null; pattern="" } }
            @{ system=$false; id="saygyqubs8ptbp9"; name="status";       type="text";   required=$true;  presentable=$true; unique=$false; options=@{ min=$null; max=$null; pattern="" } }
        )
        indexes = @("CREATE INDEX idx_gdc_deposits_user_guid ON gdc_deposits (user_guid)")
        listRule = $null; viewRule = $null; createRule = $null; updateRule = $null; deleteRule = $null
    } | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Method POST -Uri "$base/api/collections" -Headers $headers -ContentType "application/json" -Body $body | Out-Null
        Write-Host "gdc_deposits 컬렉션 생성 완료." -ForegroundColor Green
    } catch {
        Write-Host "생성 실패:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        exit 1
    }
}
