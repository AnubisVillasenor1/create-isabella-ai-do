import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.ATLAS_READ_TOKEN || process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER || process.env.GITHUB_REPOSITORY?.split("/")[0];
const includeForks = process.env.INCLUDE_FORKS === "true";
const maxRepos = Math.max(1, Math.min(Number(process.env.MAX_REPOS ?? 500), 5000));

if (!token || !owner) throw new Error("ATLAS_INGEST_REQUIRES_TOKEN_AND_GITHUB_OWNER");

async function github<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GITHUB_API_${response.status}`);
  return response.json() as Promise<T>;
}

interface Repo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
}

const repos: Repo[] = [];
for (let page = 1; repos.length < maxRepos; page++) {
  const batch = await github<Repo[]>(`https://api.github.com/orgs/${encodeURIComponent(owner)}/repos?per_page=100&page=${page}&type=all`).catch(async () =>
    github<Repo[]>(`https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&page=${page}&type=all`),
  );
  if (batch.length === 0) break;
  repos.push(...batch.filter((repo) => includeForks || !repo.fork));
  if (batch.length < 100) break;
}

const normalized = repos.slice(0, maxRepos).map((repo) => ({
  id: repo.id,
  name: repo.name,
  fullName: repo.full_name,
  url: repo.html_url,
  defaultBranch: repo.default_branch,
  private: repo.private,
  fork: repo.fork,
  archived: repo.archived,
  pushedAt: repo.pushed_at,
  updatedAt: repo.updated_at,
  language: repo.language,
  stars: repo.stargazers_count,
})).sort((a, b) => a.fullName.localeCompare(b.fullName));

const payload = {
  schema: "isabella.genesis.atlas.github.v1",
  owner,
  generatedAt: new Date().toISOString(),
  includeForks,
  count: normalized.length,
  repositories: normalized,
};
const canonical = JSON.stringify(payload);
const snapshotHash = createHash("sha3-256").update(canonical).digest("hex");
await mkdir("atlas", { recursive: true });
await writeFile("atlas/github-repositories.json", JSON.stringify({ ...payload, snapshotHash }, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ schema: payload.schema, owner, count: normalized.length, snapshotHash }));
