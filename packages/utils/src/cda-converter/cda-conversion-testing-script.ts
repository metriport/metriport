import { Bundle } from "@medplum/fhirtypes";
import { generateCdaFromFhirBundle } from "@metriport/core/fhir-to-cda/cda-generators";
import { splitBundleByCompositions } from "@metriport/core/fhir-to-cda/composition-splitter";
import axios, { AxiosInstance } from "axios";
import fs from "fs";
import path from "path";
import { getEnvVarOrFail } from "../../../api/src/shared/config";

/**
 * The objective of these tests are to test two things:
 *
 *  1. That we generate valid CDA that our CDA->FHIR converter doesn't error on.
 *     We cant know if EPIC won't error on our CDA yet, but not erroring on our own CDA is a good start
 *
 *  2. That our FHIR to CDA converter generates accurate CDA, such that when our CDA is converted back to FHIR,
 *     we get the same FHIR bundle as the original FHIR bundle. Obviously this introduces a dependency on
 *     another converter, but for now its the easiest approach since short of manually having exact string
 *     comparisons between two CDAs, we can't know if our CDA is accurate.
 *
 */

const fhirBaseUrl = "http://localhost:8888";
const orgOid = getEnvVarOrFail("ORG_OID");
const baseInputFolder = "./src/cda-converter/scratch/";

async function main() {
  if (!fs.existsSync(baseInputFolder)) {
    console.error("Base input folder does not exist:", baseInputFolder);
    process.exit(1);
  }

  fs.readdir(baseInputFolder, (err, files) => {
    if (err) {
      console.error("Error reading base input folder:", err);
      process.exit(1);
    }

    files.forEach(file => {
      if (!file.endsWith(".json")) {
        return;
      }
      const filePath = path.join(baseInputFolder, file);

      const fileBaseName = path.basename(file, ".json");
      const fileSpecificBaseFolder = path.join(baseInputFolder, fileBaseName);
      const inputJsonBundlesFolder = path.join(fileSpecificBaseFolder, "input-fhir");
      const outputFolderCDA = path.join(fileSpecificBaseFolder, "output-cda");
      const outputFolderFHIR = path.join(fileSpecificBaseFolder, "output-fhir");

      [inputJsonBundlesFolder, outputFolderCDA, outputFolderFHIR].forEach(folder => {
        if (!fs.existsSync(folder)) {
          fs.mkdirSync(folder, { recursive: true });
        }
      });

      const fileContent = fs.readFileSync(filePath, "utf8");
      let fhirBundle;

      try {
        fhirBundle = JSON.parse(fileContent);
      } catch (error) {
        console.error(`Error parsing JSON for file ${file}:`, error);
        return;
      }

      convertFhirToCda(fhirBundle, file, inputJsonBundlesFolder, outputFolderCDA, orgOid);
      convertCdaToFhir(
        outputFolderCDA,
        outputFolderFHIR,
        axios.create({ baseURL: fhirBaseUrl }),
        fileBaseName,
        ".json"
      ).catch(error => console.error("Error converting CDA to FHIR:", error));

      compareFhirBundles(inputJsonBundlesFolder, outputFolderFHIR);
    });
  });
}

export function convertFhirBundleToCdaTesting(
  fhirBundle: Bundle,
  orgOid: string
): {
  cdaDocuments: string[];
  splitBundles: Bundle[];
} {
  const splitBundles = splitBundleByCompositions(fhirBundle);
  return {
    cdaDocuments: splitBundles.map(bundle => generateCdaFromFhirBundle(bundle, orgOid)),
    splitBundles: splitBundles,
  };
}

function convertFhirToCda(
  fhirBundle: Bundle,
  inputFileName: string,
  outputFolderBundles: string,
  outputFolderCDA: string,
  orgOid: string
) {
  let cdaDocuments;
  let splitBundles;
  try {
    const result = convertFhirBundleToCdaTesting(fhirBundle, orgOid);
    cdaDocuments = result.cdaDocuments;
    splitBundles = result.splitBundles;
  } catch (error) {
    console.error("Error converting FHIR bundle to CDA:", error);
    return;
  }

  splitBundles.forEach((bundle, bundleIndex) => {
    const outputFileName = `${path.basename(inputFileName, ".json")}_${bundleIndex + 1}.json`;
    const outputPath = path.join(outputFolderBundles, outputFileName);
    fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2));
  });

  cdaDocuments.forEach((cda, cdaIndex) => {
    const outputFileName = `${path.basename(inputFileName, ".json")}_${cdaIndex + 1}.xml`;
    const outputPath = path.join(outputFolderCDA, outputFileName);
    fs.writeFileSync(outputPath, cda);
  });
}

async function convertCdaToFhir(
  inputFolder: string,
  outputFolderFHIR: string,
  api: AxiosInstance,
  fileBaseName: string,
  fhirExtension: ".json"
) {
  if (!fs.existsSync(outputFolderFHIR)) {
    fs.mkdirSync(outputFolderFHIR, { recursive: true });
  }

  const files = fs.readdirSync(inputFolder);

  for (const file of files) {
    if (path.extname(file) === ".xml") {
      const filePath = path.join(inputFolder, file);
      const cdaContent = fs.readFileSync(filePath, "utf8");
      try {
        const url = `/api/convert/cda/ccd.hbs`;
        const unusedSegments = false;
        const invalidAccess = false;
        const patientId = fileBaseName;
        const fileName = `${fileBaseName}.xml`;
        const params = { patientId, fileName, unusedSegments, invalidAccess };
        const payload = (cdaContent ?? "").trim();
        const res = await api.post(url, payload, {
          params,
          headers: { "Content-Type": "text/plain" },
        });
        const fhirBundle = res.data.fhirResource;

        const outputFileName = file.replace(".xml", fhirExtension);
        const outputPath = path.join(outputFolderFHIR, outputFileName);
        fs.writeFileSync(outputPath, JSON.stringify(fhirBundle, null, 2));
      } catch (error) {
        console.error(`Error converting CDA to FHIR for file ${file}:`, error);
      }
    }
  }
}

async function compareFhirBundles(
  inputJsonBundlesFolder: string,
  outputFolderFHIR: string
): Promise<void> {
  const inputFiles: string[] = fs.readdirSync(inputJsonBundlesFolder);
  const outputFiles: string[] = fs.readdirSync(outputFolderFHIR);

  for (const inputFile of inputFiles) {
    if (outputFiles.includes(inputFile)) {
      const inputFilePath: string = path.join(inputJsonBundlesFolder, inputFile);
      const outputFilePath: string = path.join(outputFolderFHIR, inputFile);

      const inputBundle: Bundle = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));
      const outputBundle: Bundle = JSON.parse(fs.readFileSync(outputFilePath, "utf8"));

      const inputResourcesCount: Record<string, number> = countResources(inputBundle);
      const outputResourcesCount: Record<string, number> = countResources(outputBundle);

      if (compareResourceCounts(inputResourcesCount, outputResourcesCount)) {
        console.log(
          `✅ Test passed for ${inputFile}: Both input and output FHIR bundles have identical resource counts.`
        );
      } else {
        console.log(
          `❌ Test failed for ${inputFile}: Resource counts do not match.\nInput counts: ${JSON.stringify(
            inputResourcesCount,
            null,
            2
          )}\nOutput counts: ${JSON.stringify(outputResourcesCount, null, 2)}`
        );
      }
    }
  }
}

function countResources(bundle: Bundle): Record<string, number> {
  const counts: Record<string, number> = {};
  bundle.entry?.forEach(entry => {
    if (!entry.resource) return;
    const resourceType: string = entry.resource.resourceType;
    counts[resourceType] = (counts[resourceType] || 0) + 1;
  });
  return counts;
}

function compareResourceCounts(
  inputCounts: Record<string, number>,
  outputCounts: Record<string, number>
): boolean {
  const inputKeys: string[] = Object.keys(inputCounts);
  const outputKeys: string[] = Object.keys(outputCounts);

  if (inputKeys.length !== outputKeys.length) return false;

  for (const key of inputKeys) {
    if (inputCounts[key] !== outputCounts[key]) return false;
  }

  return true;
}

main();
