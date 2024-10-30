const github = require("@actions/github");

/**
 * This script checks if a PR is targeting the correct branch based on its title.
 * It will add a comment to the PR if it is not targeting the correct branch.
 */

const TRIGGER_KEYWORDS = ["release", "patch", "hotfix"];
const REQUIRED_BASE_BRANCH = "master";

const ghToken = process.env.GITHUB_TOKEN;

async function run() {
  if (!ghToken) {
    const msg = "GITHUB_TOKEN is not set";
    console.log(msg);
    throw new Error(msg);
  }
  try {
    const context = github.context;
    const octokit = github.getOctokit(ghToken);

    // Only run on pull request events
    if (context.eventName !== "pull_request") {
      console.log("Not a pull request event");
      return;
    }
    console.log("Pull request event:");

    const pr = context.payload.pull_request;
    const prTitle = pr.title.toLowerCase();
    const baseBranch = pr.base.ref;
    console.log("- baseBranch", baseBranch);
    console.log("- requiredBaseBranch", REQUIRED_BASE_BRANCH);
    console.log("- prTitle", prTitle);
    console.log("- triggerKeywords", TRIGGER_KEYWORDS);

    const hasProtectedKeyword = TRIGGER_KEYWORDS.some(keyword =>
      prTitle.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasProtectedKeyword && baseBranch !== REQUIRED_BASE_BRANCH) {
      console.log(
        "PR title contains a trigger keyword and is not targeting the required base branch, adding a comment..."
      );
      const comment =
        `⚠️ This PR is titled PATCH or RELEASE but its not targeting the ` +
        `\`${REQUIRED_BASE_BRANCH}\` branch. Please update the base branch to ` +
        `\`${REQUIRED_BASE_BRANCH}\` or update the PR title.`;

      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: pr.number,
        body: comment,
      });
      console.log("Comment added successfully!");
      return;
    }
    console.log(
      "PR title does not contain a trigger keyword or is targeting the required base branch, no comment needed."
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    throw error;
  }
}

run();
