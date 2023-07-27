import Ajv, { ErrorObject } from "ajv";
import schema from "./fhir.schema.json";
import metaSchema from "ajv/lib/refs/json-schema-draft-06.json";
import { Bundle } from "../../../routes/medical/schemas/fhir";
import BadRequestError from "../../../errors/bad-request";

type Error = {
  resourceType: string;
  errors: ErrorObject[] | null | undefined;
};

export const validateFhirEntries = (bundle: Bundle): Bundle => {
  const ajv = new Ajv({
    // I need to use strict as an option but its not in the AJV.Options
    // eslint-disable-next-line
    // @ts-ignore
    strict: false,
  });

  ajv.addMetaSchema(metaSchema);

  const errors: Error[] = [];

  for (const resource of bundle.entry) {
    const resourceType = resource.resource.resourceType;

    const validate = ajv.compile(schema);

    const isValid = validate(resource.resource);

    if (!isValid) {
      const resourceValidate = ajv.compile(getSubSchema(resourceType));
      resourceValidate(resource.resource);
      errors.push({ resourceType, errors: resourceValidate.errors });
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
  schema.oneOf = [{ $ref: `#/definitions/${resourceType}` }];
  return subSchema;
};
