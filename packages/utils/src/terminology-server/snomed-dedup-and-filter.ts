import fs from "fs";
import path from "path";
import { getCodeDetails } from "./term-server-api";

const processDirectory = async (directory: string) => {
  // Check if the path is a directory or a file
  const stat = fs.statSync(directory);
  if (stat.isFile()) {
    // If it's a file, process it directly
    if (directory.endsWith(".json")) {
      await processFile(directory);
    }
    return; // Exit the function as there's nothing more to do for a file
  }

  const items = fs.readdirSync(directory, { withFileTypes: true });

  for (const item of items) {
    const sourcePath = path.join(directory, item.name);

    if (item.isDirectory()) {
      // Recursively process the subdirectory
      await processDirectory(sourcePath);
    } else if (item.isFile() && item.name.endsWith(".json")) {
      await processFile(sourcePath);
    }
  }
};

const processFile = async (filePath: string) => {
  const snomedSystemUrl = "http://snomed.info/sct";
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const encounteredCodes = new Set();

  const entries = data.bundle ? data.bundle.entry : data.entry;

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const resource = entry.resource;
    if (resource && resource.resourceType === "Condition") {
      const codings = resource.code?.coding || [];

      for (const coding of codings) {
        if (coding.system === snomedSystemUrl) {
          if (encounteredCodes.has(coding.code)) {
            console.log(`Removing duplicate code ${coding.code} from ${path.basename(filePath)}`);
            entries.splice(i, 1);
          } else {
            encounteredCodes.add(coding.code);
            const codeDetails = await getCodeDetails(coding.code, "SNOMEDCT_US");
            if (codeDetails && codeDetails.display) {
              if (codeDetails.category == "disorder") {
                console.log(`Identified disorder for ${coding.code}`);
              } else {
                console.log(`Filtered out ${codeDetails.category} for ${coding.code}`);
              }

              const updatedText = `${codeDetails.display} (${codeDetails.category})`;
              resource.code.text = updatedText;
              coding.text = updatedText;
            }
          }
        }
      }
    }
  }

  // Write the updated data back to the same file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const main = async () => {
  const [directoryPath] = process.argv.slice(2);
  if (!directoryPath) {
    console.error("Please provide a directory path as an argument.");
    process.exit(1);
  }

  await processDirectory(directoryPath).catch(console.error);
};

main();
