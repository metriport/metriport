import fs from "fs";
import path from "path";
import { Command } from "commander";
import { parseResponseFile } from "@metriport/core/external/quest/file/file-parser";

const command = new Command();

const QUEST_DIR = path.join(__dirname, "../..", "runs", "quest");

command
  .name("analysis")
  .option("--cx-name <cxName>", "The customer name")
  .description("Analysis of Quest data")
  .action(runAnalysis);

async function runAnalysis({ cxName }: { cxName: string }) {
  if (!cxName) {
    throw new Error("Customer name is required");
  }
  const cxDir = path.join(QUEST_DIR, cxName);
  const patientIdMap = getQuestPatientMapping(cxDir);
  const patientIds = new Set(Object.keys(patientIdMap));
  const foundPatientIds = new Set();
  const countPatient: Record<string, number> = {};
  const reversePatientIdMap = Object.fromEntries(
    Object.entries(patientIdMap).map(([k, v]) => [v, k])
  );
  const files = fs.readdirSync(cxDir).filter(file => file.endsWith(".txt"));

  for (const file of files) {
    console.log("-----" + file + "---------------------------");
    const fileContent = fs.readFileSync(path.join(cxDir, file));
    const details = parseResponseFile(fileContent);
    console.log("Parsed " + details.length + " rows");

    for (const detail of details) {
      const patientId = detail.patientId;
      if (patientId && reversePatientIdMap[patientId]) {
        const metriportId = reversePatientIdMap[patientId];
        foundPatientIds.add(metriportId);
        countPatient[metriportId] = (countPatient[metriportId] || 0) + 1;
      } else {
        console.log("unknown patient ID: " + patientId);
      }
    }
  }
  console.log("found " + foundPatientIds.size + " patient ids");
  console.log("missing " + (patientIds.size - foundPatientIds.size) + " patient ids");
  console.log(
    "coverage percent: " + ((foundPatientIds.size / patientIds.size) * 100).toFixed(2) + "%"
  );

  const averageCount =
    Object.values(countPatient).reduce((a, b) => a + b, 0) / Object.keys(countPatient).length;
  console.log("average labs per patient: " + averageCount.toFixed(3));

  const maxCounts = Object.values(countPatient).sort((a, b) => b - a)[0];
  console.log("max labs per patient: " + maxCounts);

  const minCounts = Object.values(countPatient).sort((a, b) => a - b)[0];
  console.log("min labs per patient: " + minCounts);
}

function getQuestPatientMapping(dirPath: string): Record<string, string> {
  const fileContent = fs.readFileSync(path.join(dirPath, "job.json"), "utf8");
  const job = JSON.parse(fileContent);
  const patientIdMap = job.patientIdMap;
  return patientIdMap;
}
export default command;
