#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Initialize a new repository with three-way linkage (GitHub + Gitee + AFDian)
.DESCRIPTION
    Usage: init-tri-link.ps1 -RepoName "my-repo"
    Creates the standard project structure for tri-link development.
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$false)]
    [string]$Description = "",
    [Parameter(Mandatory=$false)]
    [string]$GitHubUser = "Zeon7744",
    [Parameter(Mandatory=$false)]
    [string]$GiteeUser = "Zeon7744",
    [Parameter(Mandatory=$false)]
    [string]$AFDianUser = "Zeon7744"
)

$ErrorActionPreference = "Stop"

Write-Host "[INIT] Starting three-way linkage: $RepoName" -ForegroundColor Cyan
Write-Host "       GitHub:  $GitHubUser/$RepoName"
Write-Host "       Gitee:   $GiteeUser/$RepoName"
Write-Host "       AFDian:  afdian.com/a/$AFDianUser"
Write-Host ""

# 1. Initialize git repo
if (-not (Test-Path ".git")) {
    git init
    Write-Host "[OK] Git repo initialized" -ForegroundColor Green
}
else {
    Write-Host "[INFO] Git repo already exists" -ForegroundColor Yellow
}

# 2. Set remotes
$ghRemote = "git@github.com:${GitHubUser}/${RepoName}.git"
$geRemote = "git@gitee.com:${GiteeUser}/${RepoName}.git"

git remote add origin $ghRemote 2>$null
Write-Host "[OK] GitHub remote: $ghRemote" -ForegroundColor Green

git remote add gitee $geRemote 2>$null
Write-Host "[OK] Gitee remote: $geRemote" -ForegroundColor Green

# 3. Create .github/FUNDING.yml
$fundingDir = ".github"
if (-not (Test-Path $fundingDir)) {
    New-Item -ItemType Directory -Path $fundingDir -Force | Out-Null
}

$fundingContent = "# Support me on AFDian`ncustom: [`"https://afdian.com/a/$AFDianUser`"]"
Set-Content -Path "$fundingDir\FUNDING.yml" -Value $fundingContent -Encoding UTF8
Write-Host "[OK] FUNDING.yml created" -ForegroundColor Green

# 4. Create README.md
if (-not (Test-Path "README.md")) {
    $readmeContent = @"
# $RepoName

$Description

## AFDian Sponsor

If this project is helpful, consider sponsoring:
- https://afdian.com/a/$AFDianUser

## Mirror

| Platform | URL |
|----------|-----|
| GitHub | https://github.com/$GitHubUser/$RepoName |
| Gitee | https://gitee.com/$GiteeUser/$RepoName |

## Quick Start

\`\`\`bash
# Push to all platforms
git push-all

# Sync to Gitee
git sync-gitee
\`\`\`
"@
    Set-Content -Path "README.md" -Value $readmeContent -Encoding UTF8
    Write-Host "[OK] README.md created" -ForegroundColor Green
}

# 5. Create .gitignore
if (-not (Test-Path ".gitignore")) {
    $gitignoreContent = @"
# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Node
node_modules/

# Python
__pycache__/
*.pyc
.venv/

# Env
.env
"@
    Set-Content -Path ".gitignore" -Value $gitignoreContent -Encoding UTF8
    Write-Host "[OK] .gitignore created" -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Create repos on GitHub and Gitee"
Write-Host "  2. Push to both remotes:"
Write-Host "     git add -A"
Write-Host "     git commit -m 'init: three-way linkage'"
Write-Host "     git push -u origin main"
Write-Host "     git push -u gitee main"
Write-Host ""
Write-Host "     Or use:  git push-all"
