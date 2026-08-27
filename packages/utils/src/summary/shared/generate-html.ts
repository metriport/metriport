import fs from "fs";
import path from "path";
import { AiSummaryOutput } from "./compare";
import { initPatientDir } from "./compare";
import { execSync } from "child_process";

const benchmarkStyleElement = `
<style>
  html, body { margin: 0; padding: 0; }
    html, body, * { font-family: Arial, sans-serif; }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; }
    nav a { color: #369; font-size: 20px; text-decoration: none; }
    a.disabled { color: #ccc; }
    table { width: 100%; border-collapse: collapse; }
    th, td { vertical-align: top; padding: 8px; border: 1px solid #ccc; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .winner { background: #aaffaa; }
    .loser { background: #ffaaaa; }
</style>`;

export function generatePatientHTML({
  comparisonId,
  cxId,
  patientId,
  nextPatientId,
  previousPatientId,
  models,
  summaries,
  blindTest,
}: {
  comparisonId: string;
  cxId: string;
  patientId: string;
  nextPatientId?: string;
  previousPatientId?: string;
  models: readonly string[];
  summaries: AiSummaryOutput[];
  blindTest?: boolean;
}) {
  const patientDir = initPatientDir(comparisonId, patientId);
  const htmlTable = buildHTMLTable(models, summaries, blindTest);
  const htmlNavigation = buildHTMLNavigation({ cxId, patientId, nextPatientId, previousPatientId });
  const html =
    "<html>" +
    `<head><title>${patientId}</title>${benchmarkStyleElement}</head>` +
    `<body>${htmlNavigation}${htmlTable}</body>` +
    "</html>";
  fs.writeFileSync(path.join(patientDir, "index.html"), html);
}

export function openComparisonReport(comparisonId: string, patientIds: string[]) {
  const firstPatient = patientIds[0];
  if (!firstPatient) return;
  const firstPatientDir = initPatientDir(comparisonId, firstPatient);
  const firstPatientHtml = path.join(firstPatientDir, "index.html");
  if (!fs.existsSync(firstPatientHtml)) return;
  execSync(`open ${firstPatientHtml}`);
}

export function generateEmptyPatientHTML({
  comparisonId,
  cxId,
  patientId,
  nextPatientId,
  previousPatientId,
}: {
  comparisonId: string;
  cxId: string;
  patientId: string;
  nextPatientId?: string;
  previousPatientId?: string;
}) {
  const patientDir = initPatientDir(comparisonId, patientId);
  const htmlNavigation = buildHTMLNavigation({ cxId, patientId, nextPatientId, previousPatientId });
  const html = `<html><head><title>${patientId}</title>${benchmarkStyleElement}</head><body>
  ${htmlNavigation}
  <p>No consolidated bundle</p></body></html>`;
  fs.writeFileSync(path.join(patientDir, "index.html"), html);
}

export function buildHTML(providers: readonly string[], summaries: AiSummaryOutput[]) {
  const table = buildHTMLTable(providers, summaries);
  return `<html><body>${table}</body></html>`;
}

function buildHTMLNavigation({
  cxId,
  patientId,
  nextPatientId,
  previousPatientId,
}: {
  cxId: string;
  patientId: string;
  nextPatientId?: string;
  previousPatientId?: string;
}) {
  const htmlNavigation = `<nav>
    <a class="${previousPatientId ? "" : "disabled"}" href="../${
    previousPatientId ?? patientId
  }/index.html">Previous</a>
    <span>${cxId} (cx) - ${patientId} (patient)</span>
    <a class="${nextPatientId ? "" : "disabled"}" href="../${
    nextPatientId ?? patientId
  }/index.html">Next</a>
  </nav>`;
  return htmlNavigation;
}

function buildHTMLTable(
  providers: readonly string[],
  summaries: AiSummaryOutput[],
  blindTest?: boolean
) {
  const columnWidth = (100 / providers.length).toFixed(2) + "%";
  const winner = [...summaries].sort((a, b) => a.durationInMs - b.durationInMs)[0];

  const thead = `<tr>
    ${providers
      .map(
        (provider, index) =>
          `<th style="width: ${columnWidth}">${blindTest ? `Summary ${index + 1}` : provider}</th>`
      )
      .join("")}
  </tr>`;
  const tbody = `<tr>
    ${summaries.map(({ summary }) => `<td>${escapeHtml(summary)}</td>`).join("")}
  </tr>
  <tr>
    ${
      blindTest
        ? ""
        : summaries
            .map(
              ({ durationInMs }) =>
                `<td class="${winner.durationInMs === durationInMs ? "winner" : "loser"}">${(
                  durationInMs / 1000
                ).toFixed(2)} seconds</td>`
            )
            .join("")
    }
  </tr>
  <tr>
    ${
      blindTest
        ? ""
        : summaries
            .map(
              ({ inputTokensUsed, outputTokensUsed }) =>
                `<td>${inputTokensUsed} input tokens, ${outputTokensUsed} output tokens</td>`
            )
            .join("")
    }
  </tr>`;
  return `<table>${thead}${tbody}</table>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n", "<br>");
}
