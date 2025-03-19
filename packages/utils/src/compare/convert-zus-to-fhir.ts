import { Bundle, Patient, Resource } from "@medplum/fhirtypes";
import { deduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import * as fs from "fs/promises";
import { join } from "path";
import path from "path";
import { cloneDeep } from "lodash";

export const zusDir = "/Users/orta21/Documents/phi/form-health/zus";
export const convertedDir = "/Users/orta21/Documents/phi/form-health/converted";

export const readAndConvertZusDirectory = async (): Promise<string[]> => {
  let convertedFiles: string[] = [];

  const existingFiles = await fs.readdir(convertedDir);
  const jsonFiles = existingFiles.filter(file => file.endsWith(".json"));

  if (jsonFiles.length > 0) {
    console.log(`Found ${jsonFiles.length} existing converted files. Skipping conversion.`);
    convertedFiles = jsonFiles.map(file => join(convertedDir, file));
  } else {
    // Directory exists but is empty, run conversion
    convertedFiles = await convertZusDirectoryToJson();
  }

  return convertedFiles;
};

export const convertZusDirectoryToJson = async (): Promise<string[]> => {
  try {
    // Get all files in the directory
    const files = await fs.readdir(zusDir, { withFileTypes: true });
    const txtFiles = files.filter(file => file.name.endsWith(".txt"));

    if (txtFiles.length === 0) {
      console.warn(`No .txt files found in ${zusDir}`);
      return [];
    }

    // Process each file and collect results
    const conversionPromises = txtFiles.map(file => convertZusFileToJson(join(zusDir, file.name)));

    return await Promise.all(conversionPromises);
  } catch (error) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to convert Zus directory to JSON: ${originalError.message}`, {
      cause: originalError,
    });
  }
};

/**
 * Reads a single Zus file and converts it to a FHIR Bundle JSON
 * @param filePath - Path to the Zus text file
 * @returns The path to the saved JSON file
 */
const convertZusFileToJson = async (filePath: string): Promise<string> => {
  try {
    const textContent = await fs.readFile(filePath, "utf-8");
    const fhirBundle = convertZusTextToFhirBundle(textContent, filePath);

    // Extract patient ID for deduplication
    const patientResource = fhirBundle.entry?.find(
      entry => entry.resource?.resourceType === "Patient"
    )?.resource as Patient | undefined;

    const patientId = patientResource?.id ?? "unknown-patient-id";
    const fileId = path.basename(filePath);

    // Create a copy of the bundle to deduplicate
    const bundleToProcess = cloneDeep(fhirBundle) as Bundle<Resource>;

    // Extract allergies before deduplication
    const allergies =
      bundleToProcess.entry?.filter(
        entry => entry.resource?.resourceType === "AllergyIntolerance"
      ) ?? [];

    // Remove allergies from the bundle to deduplicate
    if (bundleToProcess.entry) {
      bundleToProcess.entry = bundleToProcess.entry.filter(
        entry => entry.resource?.resourceType !== "AllergyIntolerance"
      );
    }

    // Deduplicate the bundle (excluding allergies)
    const deduplicatedBundle = deduplicateFhir(
      bundleToProcess,
      fileId, // Using file ID as customer ID since we don't have a specific cxId
      patientId
    );

    // Add the allergies back to the deduplicated bundle
    if (deduplicatedBundle.entry && allergies.length > 0) {
      deduplicatedBundle.entry.push(...allergies);
    }

    const outputFilename = `${convertedDir}/${filePath.split("/").pop()}.json`;

    await fs.mkdir(convertedDir, { recursive: true });
    await fs.writeFile(outputFilename, JSON.stringify(deduplicatedBundle, null, 2));

    return outputFilename;
  } catch (error) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to convert file ${filePath}: ${originalError.message}`, {
      cause: originalError,
    });
  }
};

/**
 * Converts text content from a Zus file to a properly formatted FHIR R4 Bundle
 * @param textContent - The raw text content from a Zus file
 * @returns A properly formatted FHIR R4 Bundle
 */
export const convertZusTextToFhirBundle = (
  textContent: string,
  fileName: string
): Bundle<Resource> => {
  try {
    // Parse the JSON content from text
    const parsedContent = JSON.parse(textContent);

    // Create a new FHIR Bundle to hold all resources
    const outputBundle: Bundle<Resource> = {
      resourceType: "Bundle",
      type: "collection",
      entry: [] as Array<{
        resource: Resource;
        fullUrl?: string;
      }>,
    };

    // Process all resource keys in the content
    for (const resourceKey of Object.keys(parsedContent)) {
      const resourceBundles = parsedContent[resourceKey];

      // Handle case where resourceBundles is an array of Bundles
      if (Array.isArray(resourceBundles)) {
        for (const resourceBundle of resourceBundles) {
          // Validate that this is a proper Bundle
          if (resourceBundle?.resourceType !== "Bundle") {
            console.warn(
              `Skipping bundle in ${resourceKey}: not a valid FHIR Bundle - ${fileName}`
            );
            continue;
          }

          // Extract all entries from this bundle and add to our output bundle
          if (Array.isArray(resourceBundle.entry)) {
            for (const entry of resourceBundle.entry) {
              if (entry.resource) {
                outputBundle.entry?.push({
                  resource: entry.resource,
                  fullUrl: entry.fullUrl,
                });
              }
            }
          }
        }
      } else {
        // Handle case where resourceBundle is a single Bundle (backward compatibility)
        const resourceBundle = resourceBundles;

        // Validate that this is a proper Bundle
        if (resourceBundle?.resourceType !== "Bundle") {
          console.warn(`Skipping ${resourceKey}: not a valid FHIR Bundle - ${fileName}`);
          continue;
        }

        // Extract all entries from this bundle and add to our output bundle
        if (Array.isArray(resourceBundle.entry)) {
          for (const entry of resourceBundle.entry) {
            if (entry.resource) {
              outputBundle.entry?.push({
                resource: entry.resource,
                fullUrl: entry.fullUrl,
              });
            }
          }
        }
      }
    }

    if (outputBundle.entry?.length === 0) {
      console.warn("No valid FHIR resources found in Zus text content");
    }

    return outputBundle;
  } catch (error) {
    // Preserve stack trace
    const originalError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to convert Zus text to FHIR Bundle: ${originalError.message}`, {
      cause: originalError,
    });
  }
};
