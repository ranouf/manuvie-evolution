Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-CiStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "== $Name =="

  $stepWatch = [System.Diagnostics.Stopwatch]::StartNew()
  & $Command
  $exitCode = $LASTEXITCODE
  $stepWatch.Stop()

  if ($exitCode -ne 0) {
    throw "$Name failed with exit code $exitCode"
  }

  Write-Host "== $Name completed in $([math]::Round($stepWatch.Elapsed.TotalSeconds, 2))s =="
}

$entryWatch = [System.Diagnostics.Stopwatch]::StartNew()

Invoke-CiStep "Install dependencies" { npm ci }
Invoke-CiStep "Prettier" {
  npm run format:check
  if ($LASTEXITCODE -ne 0) {
    npm run format
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }

    git diff --exit-code --ignore-cr-at-eol
  }
}
Invoke-CiStep "ESLint" { npm run lint }
Invoke-CiStep "Typecheck" { npm run typecheck }
Invoke-CiStep "Release note" { npm run release-note:check }
Invoke-CiStep "Jest" { npm test }
Invoke-CiStep "Coverage summary" { npm run coverage:summary }
Invoke-CiStep "Playwright" { npm run test:visual }
Invoke-CiStep "Build" { npm run build }

$entryWatch.Stop()
Write-Host ""
Write-Host "Total ci-build execution time: $([math]::Round($entryWatch.Elapsed.TotalSeconds, 2))s"
