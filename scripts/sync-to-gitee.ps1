#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sync GitHub repository to Gitee (GitHub -> Gitee)
.DESCRIPTION
    Usage: sync-to-gitee [-RepoName <repo-name>] [-RemoteName gitee]
    Run in a repository directory.
.EXAMPLE
    sync-to-gitee -RepoName my-project
#>
param(
    [Parameter(Mandatory=$false)]
    [string]$RepoName = "",
    [Parameter(Mandatory=$false)]
    [string]$RemoteName = "gitee",
    [Parameter(Mandatory=$false)]
    [string]$GiteeUser = "Zeon7744"
)

$ErrorActionPreference = "Stop"

if ($RepoName -eq "") {
    $originUrl = git remote get-url origin 2>$null
    if ($originUrl -match "[:/]([^/]+/[^/]+?)(\.git)?$") {
        $RepoName = $matches[1] -replace "\.git$", ""
        $RepoName = $RepoName.Split("/")[-1]
    } else {
        Write-Host "x Cannot auto-detect repo name, please use -RepoName" -ForegroundColor Red
        exit 1
    }
}

$GiteeRemote = "git@gitee.com:${GiteeUser}/${RepoName}.git"

Write-Host "=> Syncing repo: $RepoName" -ForegroundColor Cyan
Write-Host ">> Gitee remote: $GiteeRemote" -ForegroundColor Cyan

$existing = git remote get-url $RemoteName 2>$null
if ($existing) {
    git remote set-url $RemoteName $GiteeRemote
    Write-Host "OK Updated Gitee remote URL" -ForegroundColor Green
} else {
    git remote add $RemoteName $GiteeRemote
    Write-Host "OK Added Gitee remote" -ForegroundColor Green
}

git fetch $RemoteName 2>$null

$branches = git branch --format "%(refname:short)"
foreach ($branch in $branches) {
    Write-Host "> Pushing branch: $branch" -ForegroundColor Yellow
    git push $RemoteName $branch 2>&1 | ForEach-Object { Write-Host "  $_" }
}

$tags = git tag
if ($tags) {
    Write-Host "> Pushing tags" -ForegroundColor Yellow
    git push $RemoteName --tags 2>&1 | ForEach-Object { Write-Host "  $_" }
}

Write-Host "`nOK Sync completed: $RepoName -> Gitee" -ForegroundColor Green
