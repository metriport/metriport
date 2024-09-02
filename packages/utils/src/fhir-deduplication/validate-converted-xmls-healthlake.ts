import fs from "fs";
import Axios from "axios";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileNames, getFileContents } from "../shared/fs";
import { FHIRBundle } from "../fhir-converter/convert";
import { sleep } from "@metriport/core/util/sleep";

const samplesFolderPath = "";

const region = "";
const datastoreId = "";
const baseURL = `healthlake.${region}.amazonaws.com`;

const fhirApi = Axios.create({
  baseURL: `https://${baseURL}/datastore/${datastoreId}/r4/`,
});

const signer = new SignatureV4({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
  region: region,
  service: "healthlake",
  sha256: Sha256,
});

type ValidationErrorWithResourceType = {
  resource: string;
  location: string;
  message: string;
};

export async function main() {
  const bundleFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "json",
  });

  console.log(`Found ${bundleFileNames.length} files`);

  const output: {
    [key: string]: {
      [key: string]: {
        error: ValidationErrorWithResourceType;
        fileNames: string[];
      };
    };
  } = {};

  await executeAsynchronously(
    bundleFileNames,
    async (fileName, index) => {
      console.log(`Processing ${index + 1}/${bundleFileNames.length}. Filename: ${fileName}`);
      try {
        const stringBundle = getFileContents(fileName);
        const bundle = JSON.parse(stringBundle) as FHIRBundle;

        const start = Date.now();

        if (!bundle) {
          console.log("Skipping file");
          return;
        }

        const validationErrors = await validateFhirBundle(bundle, start);
        await sleep(5000);
        console.log(`Error validate in ${Date.now() - start}ms`);

        if (validationErrors && validationErrors.length > 0) {
          console.log(`Found ${validationErrors.length} validation errors`);
          for (const error of validationErrors) {
            const messageHasDisplayName = error.message
              .toLowerCase()
              .includes("wrong display name");

            if (messageHasDisplayName) {
              continue;
            }

            if (!output[error.resource]) {
              output[error.resource] = {};
            }

            if (!output[error.resource][error.message]) {
              output[error.resource][error.message] = {
                fileNames: [fileName],
                error,
              };
            } else {
              const hasFileName =
                output[error.resource][error.message].fileNames.includes(fileName);
              const has3OrMore = output[error.resource][error.message].fileNames.length >= 3;

              output[error.resource][error.message] = {
                fileNames:
                  hasFileName || has3OrMore
                    ? output[error.resource][error.message].fileNames
                    : [...output[error.resource][error.message].fileNames, fileName],
                error,
              };
            }
          }

          console.log(`Created errors in ${Date.now() - start}ms`);

          fs.writeFileSync("output.json", JSON.stringify(output, null, 2));
        }
      } catch (error) {
        console.error(`Error processing ${fileName}`);
        console.error(error);
      }
    },
    { numberOfParallelExecutions: 1, keepExecutingOnError: true }
  );
}

async function validateFhirBundle(
  bundle: FHIRBundle,
  start: number
): Promise<ValidationErrorWithResourceType[]> {
  console.log(`Validated in ${Date.now() - start}ms`);

  const errorsFromHealthLake: ValidationErrorWithResourceType[] = [];

  const signed = await signer.sign({
    method: "POST",
    hostname: baseURL,
    path: `/datastore/${datastoreId}/r4/Bundle`,
    headers: {
      host: baseURL,
      "Content-Type": "application/json",
    },
    protocol: "https:",
    body: JSON.stringify(bundle),
  });

  try {
    await fhirApi.post(`Bundle`, signed.body, {
      headers: signed.headers,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (fhirError: any) {
    console.log(fhirError.response?.data);
    const fhirErrorIssues = fhirError.response?.data.issue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const severIssues = fhirErrorIssues?.filter((issue: any) => issue.severity === "error");

    console.log(`Found ${severIssues.length} errors`);

    for (const issue of fhirErrorIssues) {
      if (issue.severity === "error") {
        const resource = issue.location?.[0]?.split("ofType")[1];

        // IF YOU WANT TO SKIP CERTAIN ERRORS
        // const isReferenceError = issue.diagnostics.includes("Reference");
        // const isContainedError = issue.diagnostics.includes("contained");

        // if (isReferenceError || isContainedError) {
        //   continue;
        // }

        errorsFromHealthLake.push({
          resource: resource,
          location: issue.location?.[0],
          message: issue.diagnostics,
        });
      }
    }
  }

  console.log(`HealthLake errors in ${Date.now() - start}ms`);

  return errorsFromHealthLake;
}

main();
