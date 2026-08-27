// Licensed under Apache. See LICENSE-APACHE in the repo root for license information.
import { OperationDefinition } from "@medplum/fhirtypes";

/** Operation for looking up codes by display text within a target system (e.g. ICD-10). */
export const lookupByDisplayOperationDefinition: OperationDefinition = {
  resourceType: "OperationDefinition",
  id: "CodeSystem-lookup-by-display",
  url: "http://hl7.org/fhir/OperationDefinition/CodeSystem-lookup-by-display",
  version: "1.0.0",
  name: "Lookup by Display",
  status: "draft",
  kind: "operation",
  code: "lookup-by-display",
  description:
    "Given a display name (e.g. condition name like 'hyperlipidemia') and target system (e.g. ICD-10-CM), " +
    "returns matching codes with their displays.",
  resource: ["CodeSystem"],
  system: false,
  type: true,
  instance: false,
  parameter: [
    {
      name: "display",
      use: "in",
      min: 1,
      max: "1",
      documentation: "The display text to search for (e.g. condition name)",
      type: "string",
    },
    {
      name: "system",
      use: "in",
      min: 1,
      max: "1",
      documentation: "The target code system to search in (e.g. http://hl7.org/fhir/sid/icd-10-cm)",
      type: "uri",
    },
    {
      name: "name",
      use: "out",
      min: 1,
      max: "1",
      documentation: "A display name for the code system",
      type: "string",
    },
    {
      name: "display",
      use: "out",
      min: 1,
      max: "1",
      documentation: "The preferred display for this concept",
      type: "string",
    },
    {
      name: "code",
      use: "out",
      min: 1,
      max: "1",
      documentation: "The code that was found",
      type: "code",
    },
  ],
};
