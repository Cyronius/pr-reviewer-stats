/**
 * PR Velocity Fetcher
 * Fetches completed PRs from Azure DevOps for the last 2 years
 *
 * Usage: npx tsx fetch-pr-velocity.ts --org itkennel --output pr-velocity.csv
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
}

async function main() {
  const args = process.argv.slice(2);
  const orgIndex = args.indexOf("--org");
  const outputIndex = args.indexOf("--output");
  const yearsIndex = args.indexOf("--years");

  const org = orgIndex >= 0 ? args[orgIndex + 1] : "itkennel";
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : "pr-velocity.csv";
  const yearsBack = yearsIndex >= 0 ? parseInt(args[yearsIndex + 1], 10) : 2;

  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!pat) {
    console.error("Error: AZURE_DEVOPS_PAT environment variable is required");
    process.exit(1);
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
    console.error(`Failed to fetch repos: ${reposResponse.status} ${reposResponse.statusText}`);
    process.exit(1);
  }
  const reposData = await reposResponse.json() as { value: any[] };
  const repos = reposData.value;
  console.log(`Found ${repos.length} repositories`);

  const allRecords: PRRecord[] = [];

  for (const repo of repos) {
    const projectName = repo.project?.name;
    const repoName = repo.name;
    const repoId = repo.id;

    if (!projectName || !repoName) continue;

    console.log(`Processing: ${projectName}/${repoName}`);

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
            allRecords.push({
              author: pr.createdBy?.displayName || "Unknown",
              authorEmail: pr.createdBy?.uniqueName || "",
              project: projectName,
              repository: repoName,
              closedDate: closedDate.toISOString().split("T")[0],
              prId: pr.pullRequestId || 0,
              title: pr.title || "",
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
  const csvLines = ["Author,AuthorEmail,Project,Repository,ClosedDate,PRId,Title"];
  for (const r of allRecords) {
    const escapedTitle = `"${r.title.replace(/"/g, '""')}"`;
    csvLines.push(`${r.author},${r.authorEmail},${r.project},${r.repository},${r.closedDate},${r.prId},${escapedTitle}`);
  }

  fs.writeFileSync(outputPath, csvLines.join("\n"), "utf-8");
  console.log(`\nExported to: ${outputPath}`);

  // Summary by author
  const byAuthor: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  for (const r of allRecords) {
    byAuthor[r.author] = (byAuthor[r.author] || 0) + 1;
    byProject[r.project] = (byProject[r.project] || 0) + 1;
    const month = r.closedDate.substring(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
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
    JSON.stringify({ byAuthor, byProject, byMonth, totalPRs: allRecords.length }, null, 2),
    "utf-8"
  );
  console.log(`\nSummary exported to: ${summaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
