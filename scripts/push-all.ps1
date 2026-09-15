#!/usr/bin/env pwsh
<#
.SYNOPSIS
    One-click push to GitHub + Gitee (three-way linkage)
.DESCRIPTION
    Run in a repository directory to automatically push to all configured remotes.
    Usage: push-all [-Branch <branch>]
#>
param(
    [Parameter(Mandatory=$false)]
    [string]$Branch = ""
)

$ErrorActionPreference = "Stop"

if ($Branch -eq "") {
    $Branch = git branch --show-current 2>$null
    if (-not $Branch) {
        $Branch = "main"
    }
}

Write-Host " => Pushing branch $Branch to all remotes" -ForegroundColor Cyan

$remotes = git remote -v | Select-String "(git@|https://)" | ForEach-Object {
    ($_ -split "\s+")[0]
} | Sort-Object -Unique

if (-not $remotes) {
    Write-Host "x No remote repositories configured" -ForegroundColor Red
    exit 1
}

foreach ($remote in $remotes) {
    $url = git remote get-url $remote 2>$null
    Write-Host ""
    Write-Host ">> Pushing to $remote ($url)" -ForegroundColor Yellow
    git push $remote $Branch 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($?) {
        Write-Host "  OK: $remote push succeeded" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $remote push failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "OK All pushes completed" -ForegroundColor Green
