import Ajv, { ErrorObject } from "ajv";
import { cloneDeep } from "lodash";
import schema from "./fhir.schema.json";
import metaSchema from "ajv/lib/refs/json-schema-draft-06.json";
import { Bundle } from "../../../routes/medical/schemas/fhir";
import BadRequestError from "../../../errors/bad-request";

type Error = {
  resourceType: string;
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
      errors.push({ resourceType, errors: resourceValidate.errors });
      schema.oneOf = clonedSchema.oneOf;
    }
  }

  if (errors.length > 0) {
    const resourceErrors = errors.map(e => e.resourceType).join(", ");
    throw new BadRequestError(`Invalid FHIR resource(s) ${resourceErrors}`);
  }

  return bundle;
};

const getSubSchema = (resourceType: string) => {
  const subSchema = schema;

  subSchema.oneOf = [{ $ref: `#/definitions/${resourceType}` }];

  return subSchema;
};
