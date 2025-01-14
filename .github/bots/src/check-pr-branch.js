const axios = require("axios");
const github = require("@actions/github");

/**
 * This script checks if a PR is targeting the correct branch based on its title.
 * It will add a comment to the PR if it is not targeting the correct branch.
 */

const TRIGGER_KEYWORDS = ["release", "patch"];
const REQUIRED_BASE_BRANCH = "master";

const ghToken = process.env.GITHUB_TOKEN;
const slackUrl = process.env.SLACK_URL_GH_ALERTS;

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
    const pr = context.payload.pull_request;
    const prTitle = pr.title;
    const prUrl = pr.html_url;
    const prBaseBranch = pr.base.ref;
    const keywords = TRIGGER_KEYWORDS.join(" or ");
    console.log("Pull request event:");
    console.log("- url", prUrl);
    console.log("- baseBranch", prBaseBranch);
    console.log("- requiredBaseBranch", REQUIRED_BASE_BRANCH);
    console.log("- prTitle", prTitle);
    console.log("- triggerKeywords", keywords);

    const hasProtectedKeyword = TRIGGER_KEYWORDS.some(keyword =>
      prTitle.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasProtectedKeyword && prBaseBranch !== REQUIRED_BASE_BRANCH) {
      const mainMsg = `is titled PATCH or RELEASE but its not targeting the \`${REQUIRED_BASE_BRANCH}\` branch. Please update the base branch to \`${REQUIRED_BASE_BRANCH}\` or update the PR title.`;
      const prComment = `⚠️ This PR ${mainMsg}`;
      const slackComment = `⚠️ The PR ${prUrl} ${mainMsg}`;
      console.log(`${slackComment}, adding a comment...`);
      await Promise.all([
        octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: pr.number,
          body: prComment,
        }),
        sendToSlack(slackComment),
      ]);
      console.log("Comment added successfully!");
      return;
    }

    if (!hasProtectedKeyword && prBaseBranch === REQUIRED_BASE_BRANCH) {
      const mainMsg = `points to \`${REQUIRED_BASE_BRANCH}\` but it doesn't contain ${keywords} on its title. Please update the title or base branch to \`${REQUIRED_BASE_BRANCH}\`.`;
      const prComment = `⚠️ This PR ${mainMsg}`;
      const slackComment = `⚠️ The PR ${prUrl} ${mainMsg}`;
      console.log(`${slackComment}, adding a comment...`);
      await Promise.all([
        octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: pr.number,
          body: prComment,
        }),
        sendToSlack(slackComment),
      ]);
      console.log("Comment added successfully!");
      return;
    }

    console.log("PR title matches the base branch, no comment needed.");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    throw error;
  }
}

async function sendToSlack(notif) {
  let subject;
  let message = undefined;
  if (typeof notif === "string") {
    subject = notif;
  } else {
    message = notif.message;
    subject = notif.subject;
  }
  if (!slackUrl) {
    console.log(`Could not send to Slack, missing SLACK_URL`);
    return;
  }
  const payload = JSON.stringify({
    text: subject + (message ? `:${"\n```\n"}${message}${"\n```"}` : ""),
    icon_emoji: ":github:",
  });
  return axios.post(slackUrl, payload, {
    headers: { "Content-Type": "application/json" },
  });
}

run();
