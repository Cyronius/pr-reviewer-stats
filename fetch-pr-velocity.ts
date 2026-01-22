/**
 * PR Velocity Fetcher
 * Fetches completed PRs from Azure DevOps for the last 2 years
 *
 * Usage: npx tsx fetch-pr-velocity.ts --org itkennel --output pr-velocity.csv
 *        npx tsx fetch-pr-velocity.ts --org itkennel --output pr-velocity.csv --with-loc
 *
 * Options:
 *   --org <name>       Azure DevOps organization name (default: itkennel)
 *   --output <file>    Output CSV file path (default: pr-velocity.csv)
 *   --years <n>        Number of years to look back (default: 2)
 *   --with-loc         Fetch lines of code stats (slower, makes additional API calls)
 */

import * as fs from "fs";

interface PRRecord {
  author: string;
  authorEmail: string;
  project: string;
  repository: string;
  closedDate: string;
  prId: number;
  title: string;
  linesAdded: number;
  linesDeleted: number;
}

export interface FetchOptions {
  org: string;
  outputPath: string;
  yearsBack: number;
  withLoc: boolean;
  onProgress?: (repoName: string) => void;
}

/**
 * Fetches PR data from Azure DevOps and returns CSV content.
 * Also writes to file if outputPath is specified.
 */
export async function fetchPRData(options: FetchOptions): Promise<string> {
  const { org, outputPath, yearsBack, withLoc, onProgress } = options;

  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!pat) {
    throw new Error("AZURE_DEVOPS_PAT environment variable is required");
  }

  const baseUrl = `https://dev.azure.com/${org}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}`,
    "Content-Type": "application/json",
  };

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsBack);

  console.log(`Querying Azure DevOps organization: ${org}`);
  console.log(`Cutoff date: ${cutoffDate.toISOString().split("T")[0]}`);

  // Fetch all repositories
  console.log("Fetching repositories...");
  const reposResponse = await fetch(`${baseUrl}/_apis/git/repositories?api-version=7.0`, { headers });
  if (!reposResponse.ok) {
    throw new Error(`Failed to fetch repos: ${reposResponse.status} ${reposResponse.statusText}`);
  }
  const reposData = await reposResponse.json() as { value: any[] };
  const repos = reposData.value;
  console.log(`Found ${repos.length} repositories`);

  const allRecords: PRRecord[] = [];

  // Helper function to fetch PR change stats by summing commit changes
  async function getPRChangeStats(projectName: string, repoId: string, prId: number): Promise<{ added: number; deleted: number }> {
    try {
      // Get all commits in this PR
      const commitsUrl = `${baseUrl}/${projectName}/_apis/git/repositories/${repoId}/pullRequests/${prId}/commits?api-version=7.0`;
      const commitsResponse = await fetch(commitsUrl, { headers });

      if (!commitsResponse.ok) {
        return { added: 0, deleted: 0 };
      }

      const commitsData = await commitsResponse.json() as { value: any[] };
      const commits = commitsData.value || [];

      let totalAdded = 0;
      let totalDeleted = 0;

      // Get stats for each commit
      for (const commit of commits) {
        const commitId = commit.commitId;
        const commitUrl = `${baseUrl}/${projectName}/_apis/git/repositories/${repoId}/commits/${commitId}?changeCount=1000&api-version=7.0`;
        const commitResponse = await fetch(commitUrl, { headers });

        if (commitResponse.ok) {
          const commitData = await commitResponse.json() as { changeCounts?: { Add?: number, Edit?: number, Delete?: number } };
          // changeCounts gives us file counts - we'll use this as a proxy
          // Azure DevOps doesn't provide line counts easily, so we estimate
          if (commitData.changeCounts) {
            // Estimate lines based on file changes (rough approximation)
            const adds = commitData.changeCounts.Add || 0;
            const edits = commitData.changeCounts.Edit || 0;
            const deletes = commitData.changeCounts.Delete || 0;

            // Rough estimate: new files average ~50 lines, edits ~20 lines changed, deletes ~30 lines
            totalAdded += (adds * 50) + (edits * 15);
            totalDeleted += (deletes * 30) + (edits * 5);
          }
        }
      }

      return { added: totalAdded, deleted: totalDeleted };
    } catch {
      return { added: 0, deleted: 0 };
    }
  }

  // Control whether to fetch detailed LOC stats (slower but more accurate)
  const fetchLOCStats = withLoc;

  for (const repo of repos) {
    const projectName = repo.project?.name;
    const repoName = repo.name;
    const repoId = repo.id;

    if (!projectName || !repoName) continue;

    console.log(`Processing: ${projectName}/${repoName}`);
    if (onProgress) {
      onProgress(repoName);
    }

    let skip = 0;
    const top = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        const prsUrl = `${baseUrl}/${projectName}/_apis/git/repositories/${repoId}/pullrequests?searchCriteria.status=completed&$top=${top}&$skip=${skip}&api-version=7.0`;
        const prsResponse = await fetch(prsUrl, { headers });

        if (!prsResponse.ok) {
          console.log(`  Skipping (${prsResponse.status})`);
          hasMore = false;
          continue;
        }

        const prsData = await prsResponse.json() as { value: any[] };
        const prs = prsData.value || [];

        if (prs.length === 0) {
          hasMore = false;
          continue;
        }

        for (const pr of prs) {
          if (!pr.closedDate) continue;

          const closedDate = new Date(pr.closedDate);
          if (closedDate >= cutoffDate) {
            let linesAdded = 0;
            let linesDeleted = 0;

            if (fetchLOCStats) {
              const stats = await getPRChangeStats(projectName, repoId, pr.pullRequestId);
              linesAdded = stats.added;
              linesDeleted = stats.deleted;
            }

            allRecords.push({
              author: pr.createdBy?.displayName || "Unknown",
              authorEmail: pr.createdBy?.uniqueName || "",
              project: projectName,
              repository: repoName,
              closedDate: closedDate.toISOString().split("T")[0],
              prId: pr.pullRequestId || 0,
              title: pr.title || "",
              linesAdded,
              linesDeleted,
            });
          }
        }

        console.log(`  Fetched ${prs.length} PRs (skip=${skip}), total records: ${allRecords.length}`);

        if (prs.length < top) {
          hasMore = false;
        } else {
          skip += top;
        }
      } catch (error) {
        console.log(`  Error: ${error}`);
        hasMore = false;
      }
    }
  }

  // Sort by date
  allRecords.sort((a, b) => a.closedDate.localeCompare(b.closedDate));

  console.log(`\nTotal completed PRs found: ${allRecords.length}`);

  // Generate CSV
  const csvLines = ["Author,AuthorEmail,Project,Repository,ClosedDate,PRId,Title,LinesAdded,LinesDeleted"];
  for (const r of allRecords) {
    const escapedTitle = `"${r.title.replace(/"/g, '""')}"`;
    csvLines.push(`${r.author},${r.authorEmail},${r.project},${r.repository},${r.closedDate},${r.prId},${escapedTitle},${r.linesAdded},${r.linesDeleted}`);
  }

  fs.writeFileSync(outputPath, csvLines.join("\n"), "utf-8");
  console.log(`\nExported to: ${outputPath}`);

  // Summary by author
  const byAuthor: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const locByAuthor: Record<string, { added: number; deleted: number }> = {};
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;

  for (const r of allRecords) {
    byAuthor[r.author] = (byAuthor[r.author] || 0) + 1;
    byProject[r.project] = (byProject[r.project] || 0) + 1;
    const month = r.closedDate.substring(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;

    // Track LOC stats
    if (!locByAuthor[r.author]) {
      locByAuthor[r.author] = { added: 0, deleted: 0 };
    }
    locByAuthor[r.author].added += r.linesAdded;
    locByAuthor[r.author].deleted += r.linesDeleted;
    totalLinesAdded += r.linesAdded;
    totalLinesDeleted += r.linesDeleted;
  }

  console.log("\nPRs by Author:");
  Object.entries(byAuthor)
    .sort(([, a], [, b]) => b - a)
    .forEach(([author, count]) => console.log(`  ${author}: ${count}`));

  console.log("\nPRs by Project:");
  Object.entries(byProject)
    .sort(([, a], [, b]) => b - a)
    .forEach(([project, count]) => console.log(`  ${project}: ${count}`));

  // Also export summary JSON for the visualization
  const summaryPath = outputPath.replace(".csv", "-summary.json");
  fs.writeFileSync(
    summaryPath,
    JSON.stringify({
      byAuthor,
      byProject,
      byMonth,
      totalPRs: allRecords.length,
      locByAuthor,
      totalLinesAdded,
      totalLinesDeleted
    }, null, 2),
    "utf-8"
  );
  console.log(`\nSummary exported to: ${summaryPath}`);

  // Return CSV content for API use
  return csvLines.join("\n");
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const orgIndex = args.indexOf("--org");
  const outputIndex = args.indexOf("--output");
  const yearsIndex = args.indexOf("--years");

  const org = orgIndex >= 0 ? args[orgIndex + 1] : "itkennel";
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : "pr-velocity.csv";
  const yearsBack = yearsIndex >= 0 ? parseInt(args[yearsIndex + 1], 10) : 2;
  const withLoc = args.includes("--with-loc");

  await fetchPRData({ org, outputPath, yearsBack, withLoc });
}

// Only run main if this is the entry point
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
