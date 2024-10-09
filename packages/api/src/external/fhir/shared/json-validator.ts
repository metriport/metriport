import Ajv, { ErrorObject } from "ajv";
import metaSchema from "ajv/lib/refs/json-schema-draft-06.json";
import { cloneDeep } from "lodash";
import { BadRequestError } from "@metriport/shared";
import { Bundle } from "../../../routes/medical/schemas/fhir";
import schema from "./fhir.schema.json";

type Error = {
  resourceType: string;
  resourceId: string;
  errors: ErrorObject[] | null | undefined;
};

const ajv = new Ajv({
  strict: false,
});

ajv.addMetaSchema(metaSchema);
const validate = ajv.compile(schema);
const clonedSchema = cloneDeep(schema);

export const validateFhirEntries = (bundle: Bundle): Bundle => {
  const errors: Error[] = [];

  for (const entry of bundle.entry) {
    const resourceType = entry.resource.resourceType;
    if (typeof resourceType !== "string") {
      throw new BadRequestError("Resource type must be a string", undefined, {
        actualType: typeof resourceType,
      });
    }

    const isValid = validate(entry.resource);

    if (!isValid) {
      const resourceValidate = ajv.compile(getSubSchema(resourceType));
      resourceValidate(entry.resource);
      errors.push({ resourceType, resourceId: entry.resource.id, errors: resourceValidate.errors });
      schema.oneOf = clonedSchema.oneOf;
    }
  }

  if (errors.length > 0) {
    const resourceErrors = errors.map(toErrorMessage).join(", ");
    throw new BadRequestError(`Invalid FHIR resource(s): ${resourceErrors}`);
  }

  return bundle;
};

function toErrorMessage(error: Error): string {
  return `${error.resourceType} ${error.resourceId}`;
}

const getSubSchema = (resourceType: string) => {
  const subSchema = schema;

  subSchema.oneOf = [{ $ref: `#/definitions/${resourceType}` }];

  return subSchema;
};
