import { Bundle } from "@medplum/fhirtypes";
import Ajv from "ajv";
import metaSchema from "ajv/lib/refs/json-schema-draft-06.json";
import { BadRequestError } from "@metriport/shared/error/bad-request";
import { Bundle as ValidBundle } from "../../../routes/medical/schemas/fhir";
import schema from "./fhir.schema.json";

type LocalError = {
  resourceType: string;
  resourceId: string;
};

/**
 * Make sure not to modify these as they are reused across different requests
 */
const ajv = new Ajv({ strict: false });
ajv.addMetaSchema(metaSchema);
const validate = ajv.compile(schema);

export function validateFhirEntries(bundle: Bundle): ValidBundle {
  if (bundle.type !== "collection") throw new BadRequestError("Bundle must be a collection");
  if (!bundle.entry) throw new BadRequestError("Bundle must have entries");

  const errors: LocalError[] = [];
  for (const entry of bundle.entry) {
    if (!entry.resource) throw new BadRequestError("Entry must have a resource");
    if (!entry.resource.id) throw new BadRequestError("Entry's resource must have an id");

    const resourceType = entry.resource?.resourceType;
    if (typeof resourceType !== "string") {
      throw new BadRequestError("Resource type must be a string", undefined, {
        actualType: typeof resourceType,
      });
    }
    const isValid = validate(entry.resource);
    if (!isValid) errors.push({ resourceType, resourceId: entry.resource.id });
  }

  if (errors.length > 0) {
    const resourceErrors = errors.map(toErrorMessage).join(", ");
    throw new BadRequestError(`Invalid FHIR resource(s): ${resourceErrors}`);
  }

  return {
    ...bundle,
    type: bundle.type,
    entry: bundle.entry,
  };
}

function toErrorMessage(error: LocalError): string {
  return `${error.resourceType} ${error.resourceId}`;
}
