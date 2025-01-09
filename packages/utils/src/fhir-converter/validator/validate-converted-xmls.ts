import { Bundle, Resource } from "@medplum/fhirtypes";
import Axios from "axios";
import fs from "fs";
import { ValidationError, Validator } from "jsonschema";
import { getFileNames } from "../../shared/fs";
import { convert } from "../convert";

const schema = JSON.parse(fs.readFileSync("fhir.schema.json", "utf8"));
const validator = new Validator();

const converterBaseUrl = "http://localhost:8777";
const samplesFolderPath = "";

const converterApi = Axios.create({ baseURL: converterBaseUrl });

type ValidationErrorWithResourceType = ValidationError & {
  resourceType: string;
};

export async function main() {
  const ccdaFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "xml",
  });

  console.log(`Found ${ccdaFileNames.length} files`);

  const output: {
    [key: string]: {
      [key: string]: {
        error: ValidationErrorWithResourceType;
        fileNames: string[];
      };
    };
  } = {};

  for (const [index, fileName] of ccdaFileNames.entries()) {
    console.log(`Processing ${index + 1}/${ccdaFileNames.length}. Filename: ${fileName}`);

    try {
      const bundle = await convert("", fileName, converterApi);

      if (!bundle) {
        console.log("Skipping file");
        continue;
      }

      const validationErrors = validateXml(bundle);

      if (validationErrors && validationErrors.length > 0) {
        console.log(`Found ${validationErrors.length} validation errors`);
        for (const error of validationErrors) {
          console.log(`Resource: ${error.resourceType}`);
          console.log(`Error: ${error.message}`);
          if (!output[error.resourceType]) {
            output[error.resourceType] = {};
          }

          if (!output[error.resourceType][error.message]) {
            output[error.resourceType][error.message] = {
              fileNames: [fileName],
              error,
            };
          } else {
            output[error.resourceType][error.message] = {
              fileNames: [...output[error.resourceType][error.message].fileNames, fileName],
              error,
            };
          }
        }

        fs.writeFileSync("output.json", JSON.stringify(output, null, 2));
      }
    } catch (error) {
      console.error(`Error processing ${fileName}`);
      console.error(error);
    }
  }
}

function validateXml(bundle: Bundle<Resource>): ValidationErrorWithResourceType[] | undefined {
  if (!bundle.entry) {
    return;
  }
  let outputs: ValidationErrorWithResourceType[] = [];

  for (const entry of bundle.entry) {
    if (!entry.resource) {
      continue;
    }

    const resourceType = entry.resource.resourceType;
    const newSchema = { ...schema };
    newSchema.oneOf = newSchema.oneOf.filter((x: { $ref: string }) => {
      const refResource = x.$ref.split("/")[2];

      return refResource === resourceType;
    });

    const output = validator.validate(entry.resource, newSchema, { nestedErrors: true });
    const filterErrors = output.errors
      .filter((x: ValidationError) => !x.message.includes("is not exactly one"))
      .map((x: ValidationError) => {
        return {
          resourceType,
          ...x,
        };
      });

    if (output.errors.length > 0) {
      outputs = [...outputs, ...filterErrors];
    }
  }

  return outputs;
}

main();
