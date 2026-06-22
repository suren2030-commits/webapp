# deploy.ps1 — Build, push, and restart APOC services
#
# Usage:
#   .\deploy.ps1              # deploy both frontend and backend
#   .\deploy.ps1 -Service frontend
#   .\deploy.ps1 -Service backend
#   .\deploy.ps1 -NoCache     # force full Docker rebuild (no layer cache)

param(
    [ValidateSet('frontend', 'backend', 'all')]
    [string]$Service = 'all',
    [switch]$NoCache
)

$REGISTRY  = 'host.docker.internal:5000'
$NAMESPACE = 'apoc'
$ROOT      = $PSScriptRoot

$SERVICES = @{
    frontend = @{ context = "$ROOT\frontend"; image = 'apoc-frontend' }
    backend  = @{ context = "$ROOT\backend";  image = 'apoc-backend'  }
}

function Write-Step([string]$msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Write-Ok([string]$msg) {
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Fail([string]$msg) {
    Write-Host "    [FAIL] $msg" -ForegroundColor Red
}

function Deploy-Service([string]$name) {
    $svc    = $SERVICES[$name]
    $local  = "$($svc.image):latest"
    $remote = "$REGISTRY/$($svc.image):latest"

    Write-Step "Building $name image"
    $buildArgs = @('build', '-t', $local)
    if ($NoCache) { $buildArgs += '--no-cache' }
    $buildArgs += $svc.context

    docker @buildArgs
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker build failed"; return $false }
    Write-Ok "Built $local"

    Write-Step "Pushing $name to registry"
    docker tag $local $remote
    docker push $remote
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker push failed"; return $false }
    Write-Ok "Pushed $remote"

    Write-Step "Restarting $name deployment in Kubernetes"
    kubectl rollout restart deployment/$name -n $NAMESPACE
    kubectl rollout status deployment/$name -n $NAMESPACE --timeout=90s
    if ($LASTEXITCODE -ne 0) { Write-Fail "rollout did not complete cleanly"; return $false }
    Write-Ok "$name is live"

    return $true
}

# ── Main ──────────────────────────────────────────────────────────────────────

$targets = if ($Service -eq 'all') { @('frontend', 'backend') } else { @($Service) }

$start   = Get-Date
$results = @{}

foreach ($t in $targets) {
    $results[$t] = Deploy-Service $t
}

# ── Summary ───────────────────────────────────────────────────────────────────

$elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds)
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  Deploy summary  ($elapsed s)" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

foreach ($t in $targets) {
    if ($results[$t]) {
        Write-Host "  $t  " -NoNewline; Write-Host "DEPLOYED" -ForegroundColor Green
    } else {
        Write-Host "  $t  " -NoNewline; Write-Host "FAILED" -ForegroundColor Red
    }
}
Write-Host ""
