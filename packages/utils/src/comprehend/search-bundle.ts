import fs from "fs";
import path from "path";
import { Command } from "commander";
import { Bundle } from "@medplum/fhirtypes";

const program = new Command();
program
  .name("search-bundle")
  .description("Search a bundle of documents")
  .argument("<bundle-id>", "The ID of the bundle to search")
  .option(
    "--wc, --word-count <number>",
    "The minimum number of words in the valueString to search for"
  )
  .action(searchBundle);

async function searchBundle(bundleId: string, { wordCount = 2 }: { wordCount?: number }) {
  if (!bundleId.endsWith(".json")) {
    bundleId += ".json";
  }
  const bundlePath = path.join(process.cwd(), "runs", "comprehend", bundleId);
  if (!fs.existsSync(bundlePath)) throw new Error("Could not find bundle " + bundleId);

  const observationSet: Set<string> = new Set();
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8")) as Bundle;
  bundle.entry?.forEach(entry => {
    const resource = entry.resource;
    if (!resource) return;
    if (resource.resourceType === "Observation") {
      if (resource.valueString && resource.valueString.split(" ").length > wordCount) {
        observationSet.add(resource.valueString.trim());
      }
    }
    if (resource.resourceType === "DocumentReference") {
      console.log(resource.content);
    }
  });

  console.log(Array.from(observationSet).join("\n"));
}

export default program;
