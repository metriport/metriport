import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { badRequest } from "@medplum/core";
import { Resource } from "@medplum/fhirtypes";

export async function createResource(req: FhirRequest): Promise<FhirResponse> {
  const { resourceType } = req.params;
  const resource = req.body as Resource;
  if (resource.resourceType !== resourceType) {
    return [
      badRequest(
        `Incorrect resource type: expected ${resourceType}, but found ${
          resource.resourceType || "<EMPTY>"
        }`
      ),
    ];
  }
  return [
    {
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "information",
          code: "informational",
          diagnostics: "CodeSystem create is not supported",
        },
      ],
    },
  ];
}
