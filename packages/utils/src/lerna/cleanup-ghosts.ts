import { execSync } from "child_process";
import readline from "readline";

/**
 * Script to find and clean up "ghost" git tags - tags that exist on GitHub
 * but don't have corresponding published NPM versions.
 *
 * Run from the root of the monorepo:
 *
 * Usage:
 *   npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts <package-name> [package-name...]
 *   npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts --all
 *
 * Examples:
 *   npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts @metriport/shared
 *   npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts @metriport/shared @metriport/core
 *   npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts --all
 *
 * Configuration:
 *   UNSCOPED_MIN_VERSION - Only unscoped tags (v*.*.*) with versions higher than this
 *                          threshold will be considered for removal. This prevents
 *                          accidentally removing old legitimate tags.
 *   MIN_TAG_DATE - Only tags created ON or AFTER this date will be considered for removal.
 *                  Set to undefined to disable date filtering.
 */

const REMOTE = "origin";

/**
 * Minimum version threshold for unscoped tags (v*.*.*)
 * Only unscoped ghost tags with versions HIGHER than this will be flagged for removal.
 * This prevents accidentally removing old legitimate tags.
 */
const UNSCOPED_MIN_VERSION = "5.9.2";

/**
 * Minimum date threshold for tags.
 * Only tags created ON or AFTER this date will be considered for removal.
 * Set to undefined to disable date filtering.
 * Format: "YYYY-MM-DD"
 */
const MIN_TAG_DATE: string | undefined = "2026-01-27";

type TagWithDate = {
  name: string;
  date: Date | undefined;
};

type ParsedArgs = {
  runAll: boolean;
  packageNames: string[];
};

type LernaPackage = {
  name: string;
  version: string;
  private: boolean;
  location: string;
};

function printUsageAndExit(): never {
  console.log(`
Usage:
  npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts <package-name> [package-name...]
  npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts --all

Examples:
  npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts @metriport/shared
  npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts @metriport/shared @metriport/core
  npx ts-node packages/utils/src/lerna/cleanup-ghosts.ts --all

Options:
  --all    Check all public packages in the monorepo
`);
  process.exit(1);
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const runAll = args.includes("--all");
  const packageNames = args.filter(arg => !arg.startsWith("--"));

  // Require either --all or at least one package name
  if (!runAll && packageNames.length === 0) {
    console.error("❌ Error: You must specify at least one package name or use --all\n");
    printUsageAndExit();
  }

  return { runAll, packageNames };
}

function getAllPackageNames(): string[] {
  try {
    const output = execSync("npx lerna list --json", {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();

    const packages: LernaPackage[] = JSON.parse(output);
    return packages.filter(pkg => !pkg.private).map(pkg => pkg.name);
  } catch (error) {
    console.error("❌ Failed to get package list from lerna. Make sure lerna is installed.");
    process.exit(1);
  }
}

function fetchNpmVersions(packageName: string): string[] {
  try {
    const npmOutput = execSync(`npm view ${packageName} versions --json`, {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();

    const parsed: unknown = JSON.parse(npmOutput);

    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    if (typeof parsed === "string") {
      return [parsed];
    }
    return [];
  } catch {
    console.log(
      `⚠️  Could not fetch versions for ${packageName}. (Package might be new or private).`
    );
    console.log(`   Proceeding assuming 0 published versions.`);
    return [];
  }
}

type TagInfo = {
  name: string;
  date: Date | undefined;
  source: "local" | "remote" | "both";
};

function fetchAllGitTags(): string[] {
  console.log(`📡 Fetching tags from local and remote (${REMOTE})...`);

  // Get remote tags
  const remoteTags = getRemoteTags();
  console.log(`   Found ${remoteTags.length} remote tag(s)`);

  // Fetch remote tags to local so we can get their dates for filtering
  execSync(`git fetch --tags --force ${REMOTE}`, { stdio: ["pipe", "pipe", "ignore"] });

  // Get local tags with dates
  const localTagsWithDates = getLocalTagsWithDates();
  console.log(`   Found ${localTagsWithDates.length} local tag(s)`);

  // Merge remote and local tags (union)
  const allTagNames = new Set<string>([...remoteTags, ...localTagsWithDates.map(t => t.name)]);

  // Create a map of tag info for date filtering
  const tagInfoMap = new Map<string, TagInfo>();

  for (const name of allTagNames) {
    const isRemote = remoteTags.includes(name);
    const localTag = localTagsWithDates.find(t => t.name === name);
    const isLocal = !!localTag;

    tagInfoMap.set(name, {
      name,
      date: localTag?.date,
      source: isRemote && isLocal ? "both" : isRemote ? "remote" : "local",
    });
  }

  // Report tags that only exist locally (potential leftover ghosts)
  const localOnlyTags = Array.from(tagInfoMap.values()).filter(t => t.source === "local");
  if (localOnlyTags.length > 0) {
    console.log(
      `   ⚠️  Found ${localOnlyTags.length} tag(s) that exist only locally (not on remote)`
    );
  }

  // Filter by date
  const tagsWithDates: TagWithDate[] = Array.from(tagInfoMap.values()).map(t => ({
    name: t.name,
    date: t.date,
  }));
  const filteredTags = filterTagsByDate(tagsWithDates);

  return filteredTags.map(t => t.name).filter(isValidSemVerTag);
}

function getRemoteTags(): string[] {
  const gitTagsRaw = execSync(`git ls-remote --tags ${REMOTE}`, {
    stdio: ["pipe", "pipe", "ignore"],
  })
    .toString()
    .trim();

  if (!gitTagsRaw) return [];

  return gitTagsRaw
    .split("\n")
    .map(extractTagNameFromRemote)
    .filter((tag): tag is string => tag !== undefined);
}

function extractTagNameFromRemote(line: string): string | undefined {
  // Format: "<sha>\trefs/tags/<tag-name>"
  // For scoped packages, tag name contains "/", e.g., "@metriport/shared@1.0.0"
  // So we need to capture everything after "refs/tags/"
  const match = line.match(/refs\/tags\/(.+)$/);
  if (!match) return undefined;

  const tagName = match[1];

  // Skip dereferenced tag entries (annotated tags show both the tag and the commit it points to)
  // These appear as "tagname^{}" and are not actual tags we can delete
  if (tagName.endsWith("^{}")) {
    return undefined;
  }

  return tagName;
}

function getLocalTagsWithDates(): TagWithDate[] {
  // Get all local tags with their creation dates
  const output = execSync(
    `git for-each-ref --format='%(refname:short)|%(creatordate:iso8601)' refs/tags`,
    { stdio: ["pipe", "pipe", "ignore"] }
  )
    .toString()
    .trim();

  if (!output) return [];

  return output.split("\n").map(line => {
    const [name, dateStr] = line.split("|");
    const date = dateStr ? new Date(dateStr) : undefined;
    return { name: name ?? "", date };
  });
}

function filterTagsByDate(tags: TagWithDate[]): TagWithDate[] {
  if (!MIN_TAG_DATE) {
    return tags;
  }

  const minDate = new Date(MIN_TAG_DATE);
  console.log(`📅 Filtering tags created on or after ${MIN_TAG_DATE}...`);

  const filtered = tags.filter(tag => {
    // If tag has no date, include it (conservative approach)
    if (!tag.date) return true;
    return tag.date >= minDate;
  });

  const filteredOut = tags.length - filtered.length;
  if (filteredOut > 0) {
    console.log(`   Filtered out ${filteredOut} tag(s) older than ${MIN_TAG_DATE}`);
  }

  return filtered;
}

/**
 * Check if a tag is a valid SemVer tag.
 * Matches tags like 'v1.0.0' or scoped tags like '@scope/pkg@1.0.0'
 */
function isValidSemVerTag(tag: string): boolean {
  return tag.startsWith("v") || tag.includes("@");
}

/**
 * Extract version number from a tag.
 * Handles both 'v1.0.0' and 'pkg@1.0.0' formats.
 * Also handles prerelease versions like '1.0.0-alpha.0' or '1.0.0-beta.1'
 */
function extractVersionFromTag(tag: string): string | undefined {
  // Match semver with optional prerelease suffix (e.g., 1.0.0, 1.0.0-alpha.0, 1.0.0-beta.1)
  const versionMatch = tag.match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
  return versionMatch?.[0];
}

type SemVer = {
  major: number;
  minor: number;
  patch: number;
};

function parseSemVer(version: string): SemVer | undefined {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return undefined;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two semver versions.
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
function compareSemVer(a: string, b: string): number {
  const semverA = parseSemVer(a);
  const semverB = parseSemVer(b);
  if (!semverA || !semverB) return 0;

  if (semverA.major !== semverB.major) return semverA.major - semverB.major;
  if (semverA.minor !== semverB.minor) return semverA.minor - semverB.minor;
  return semverA.patch - semverB.patch;
}

/**
 * Check if version is greater than the minimum threshold.
 */
function isVersionAboveThreshold(version: string, threshold: string): boolean {
  return compareSemVer(version, threshold) > 0;
}

function findGhostTags(gitTags: string[], npmVersions: string[]): string[] {
  return gitTags.filter(tag => {
    const version = extractVersionFromTag(tag);
    if (!version) return false;
    return !npmVersions.includes(version);
  });
}

function promptForDeletion(ghostTags: string[]): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(
      `\n❓ Do you want to delete ${ghostTags.length} tags from GitHub? (y/N) `,
      answer => {
        rl.close();
        resolve(answer.toLowerCase() === "y");
      }
    );
  });
}

function deleteGhostTags(tags: string[]): void {
  // First, check which tags exist on remote
  const remoteTags = new Set(getRemoteTags());
  const tagsOnRemote = tags.filter(t => remoteTags.has(t));
  const tagsOnlyLocal = tags.filter(t => !remoteTags.has(t));

  // Delete from remote (only tags that exist there)
  if (tagsOnRemote.length > 0) {
    console.log(`\n🗑  Deleting ${tagsOnRemote.length} tag(s) from remote...`);
    try {
      execSync(`git push --delete ${REMOTE} ${tagsOnRemote.join(" ")}`, { stdio: "inherit" });
      console.log("✅ Remote tags deleted.");
    } catch {
      console.error("⚠️  Some remote tags could not be deleted.");
    }
  }

  if (tagsOnlyLocal.length > 0) {
    console.log(`\nℹ️  ${tagsOnlyLocal.length} tag(s) exist only locally (not on remote):`);
    for (const tag of tagsOnlyLocal) {
      console.log(`   - ${tag}`);
    }
  }

  // Delete all local tags
  console.log(`\n🗑  Deleting ${tags.length} local tag(s)...`);
  let deletedCount = 0;
  for (const tag of tags) {
    try {
      execSync(`git tag -d "${tag}"`, { stdio: ["pipe", "pipe", "ignore"] });
      deletedCount++;
    } catch {
      // Tag might not exist locally, that's ok
    }
  }
  console.log(`✅ Deleted ${deletedCount} local tag(s).`);

  console.log("\n✅ Cleanup complete!");
}

function analyzeGhostTagsForPackage(
  packageName: string,
  gitTags: string[]
): { packageName: string; ghostTags: string[] } {
  console.log(`\n🔍 Checking status for ${packageName}...`);

  const npmVersions = fetchNpmVersions(packageName);

  // Filter git tags that belong to this package (scoped tags like @metriport/shared@1.0.0)
  const packageTags = gitTags.filter(tag => tag.startsWith(`${packageName}@`));
  const ghostTags = findGhostTags(packageTags, npmVersions);

  if (ghostTags.length > 0) {
    console.log(`   Found ${ghostTags.length} ghost tag(s) for ${packageName}`);
  } else {
    console.log(`   ✅ No ghost tags for ${packageName}`);
  }

  return { packageName, ghostTags };
}

function runForPackages(packageNames: string[]): string[] {
  console.log(`\n📦 Checking ${packageNames.length} package(s):`);
  for (const name of packageNames) {
    console.log(`   - ${name}`);
  }

  const gitTags = fetchAllGitTags();

  const allGhostTags: string[] = [];
  for (const packageName of packageNames) {
    const { ghostTags } = analyzeGhostTagsForPackage(packageName, gitTags);
    allGhostTags.push(...ghostTags);
  }

  return allGhostTags;
}

function runForAllPackages(): string[] {
  const packageNames = getAllPackageNames();
  console.log(`\n📦 Found ${packageNames.length} public packages in the monorepo:`);
  for (const name of packageNames) {
    console.log(`   - ${name}`);
  }

  const gitTags = fetchAllGitTags();

  const allGhostTags: string[] = [];
  for (const packageName of packageNames) {
    const { ghostTags } = analyzeGhostTagsForPackage(packageName, gitTags);
    allGhostTags.push(...ghostTags);
  }

  // Also check for unscoped version tags (v1.0.0) that don't match any NPM version
  // Only consider tags with versions higher than UNSCOPED_MIN_VERSION
  const unscopedTags = gitTags.filter(tag => tag.startsWith("v") && !tag.includes("@"));
  const unscopedTagsAboveThreshold = unscopedTags.filter(tag => {
    const version = extractVersionFromTag(tag);
    return version && isVersionAboveThreshold(version, UNSCOPED_MIN_VERSION);
  });

  if (unscopedTagsAboveThreshold.length > 0) {
    console.log(
      `\n🔍 Checking ${unscopedTagsAboveThreshold.length} unscoped version tags above v${UNSCOPED_MIN_VERSION}...`
    );
    // Collect all NPM versions from all packages
    const allNpmVersions = new Set<string>();
    for (const packageName of packageNames) {
      const versions = fetchNpmVersions(packageName);
      for (const v of versions) {
        allNpmVersions.add(v);
      }
    }
    const unscopedGhosts = findGhostTags(unscopedTagsAboveThreshold, Array.from(allNpmVersions));
    if (unscopedGhosts.length > 0) {
      console.log(`   Found ${unscopedGhosts.length} unscoped ghost tag(s)`);
      allGhostTags.push(...unscopedGhosts);
    } else {
      console.log(`   ✅ No unscoped ghost tags above v${UNSCOPED_MIN_VERSION}`);
    }
  } else {
    console.log(`\n🔍 No unscoped version tags above v${UNSCOPED_MIN_VERSION} to check`);
  }

  return allGhostTags;
}

async function main(): Promise<void> {
  const { runAll, packageNames } = parseArgs();

  let ghostTags: string[];

  if (runAll) {
    console.log("🚀 Running for ALL packages in the monorepo...");
    ghostTags = runForAllPackages();
  } else {
    ghostTags = runForPackages(packageNames);
  }

  if (ghostTags.length === 0) {
    console.log("\n✅ No ghost tags found. GitHub and NPM are in sync.");
    process.exit(0);
  }

  console.log(`\n🚨 Found ${ghostTags.length} total ghost tag(s) on GitHub that are NOT on NPM:`);
  for (const tag of ghostTags) {
    console.log(`   - ${tag}`);
  }

  const shouldDelete = await promptForDeletion(ghostTags);

  if (shouldDelete) {
    deleteGhostTags(ghostTags);
  } else {
    console.log("❌ Operation cancelled.");
  }
}

main();
