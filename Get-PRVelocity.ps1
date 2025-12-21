<#
.SYNOPSIS
    Queries Azure DevOps for completed PRs over the last 2 years.

.DESCRIPTION
    Iterates all repositories in the itkennel organization, fetches completed PRs
    with pagination, and exports author/project/date data to CSV.

.PARAMETER Organization
    Azure DevOps organization name (default: itkennel)

.PARAMETER OutputPath
    Path for CSV output (default: pr-velocity.csv)

.PARAMETER YearsBack
    Number of years to look back (default: 2)

.EXAMPLE
    .\Get-PRVelocity.ps1
    .\Get-PRVelocity.ps1 -OutputPath "data.csv" -YearsBack 1
#>

param(
    [string]$Organization = "itkennel",
    [string]$OutputPath = "pr-velocity.csv",
    [int]$YearsBack = 2
)

# Get PAT from environment
$Pat = $env:AZURE_DEVOPS_PAT
if (-not $Pat) {
    throw "AZURE_DEVOPS_PAT environment variable is required."
}

# Setup auth
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$Pat"))
$headers = @{
    Authorization = "Basic $base64Auth"
    "Content-Type" = "application/json"
}

$baseUrl = "https://dev.azure.com/$Organization"
$cutoffDate = (Get-Date).AddYears(-$YearsBack)

Write-Host "Querying Azure DevOps organization: $Organization" -ForegroundColor Cyan
Write-Host "Cutoff date: $($cutoffDate.ToString('yyyy-MM-dd'))" -ForegroundColor Cyan

# Get all repositories in the organization
Write-Host "`nFetching repositories..." -ForegroundColor Yellow
$reposUrl = "$baseUrl/_apis/git/repositories?api-version=7.0"
try {
    $reposResponse = Invoke-RestMethod -Uri $reposUrl -Headers $headers -Method Get
    $repos = $reposResponse.value
    Write-Host "Found $($repos.Count) repositories" -ForegroundColor Green
} catch {
    throw "Failed to get repositories: $_"
}

# Collect all completed PRs
$allPRs = @()

foreach ($repo in $repos) {
    $repoName = $repo.name
    $projectName = $repo.project.name

    Write-Host "`nProcessing: $projectName/$repoName" -ForegroundColor Yellow

    $skip = 0
    $top = 1000  # Max allowed by API
    $hasMore = $true

    while ($hasMore) {
        $prsUrl = "$baseUrl/$projectName/_apis/git/repositories/$($repo.id)/pullrequests?searchCriteria.status=completed&`$top=$top&`$skip=$skip&api-version=7.0"

        try {
            $prsResponse = Invoke-RestMethod -Uri $prsUrl -Headers $headers -Method Get
            $prs = $prsResponse.value

            if ($prs.Count -eq 0) {
                $hasMore = $false
                continue
            }

            # Filter by date and extract data
            foreach ($pr in $prs) {
                $closedDate = [DateTime]::Parse($pr.closedDate)

                if ($closedDate -ge $cutoffDate) {
                    $allPRs += [PSCustomObject]@{
                        Author = $pr.createdBy.displayName
                        AuthorEmail = $pr.createdBy.uniqueName
                        Project = $projectName
                        Repository = $repoName
                        ClosedDate = $closedDate.ToString("yyyy-MM-dd")
                        PRId = $pr.pullRequestId
                        Title = $pr.title
                    }
                }
            }

            Write-Host "  Fetched $($prs.Count) PRs (skip=$skip)" -ForegroundColor Gray

            # Check if we need to paginate
            if ($prs.Count -lt $top) {
                $hasMore = $false
            } else {
                $skip += $top
            }

        } catch {
            Write-Warning "Failed to get PRs for $projectName/$repoName : $_"
            $hasMore = $false
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Total completed PRs found: $($allPRs.Count)" -ForegroundColor Green

if ($allPRs.Count -eq 0) {
    Write-Host "No PRs found. Nothing to export." -ForegroundColor Yellow
    exit 0
}

# Export to CSV
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputFullPath = Join-Path $scriptDir $OutputPath

$allPRs | Export-Csv -Path $outputFullPath -NoTypeInformation -Encoding UTF8
Write-Host "Exported to: $outputFullPath" -ForegroundColor Green

# Summary by author
Write-Host "`nPRs by Author:" -ForegroundColor Cyan
$allPRs | Group-Object Author | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)" -ForegroundColor White
}

# Summary by project
Write-Host "`nPRs by Project:" -ForegroundColor Cyan
$allPRs | Group-Object Project | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)" -ForegroundColor White
}
