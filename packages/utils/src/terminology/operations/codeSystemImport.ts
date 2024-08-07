import { FhirRequest, FhirResponse } from "@medplum/fhir-router";

export async function codeSystemImportHandler(req: FhirRequest): Promise<FhirResponse> {
  console.log("codeSystemImportHandler", JSON.stringify(req, null, 2));
  return [
    {
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "information",
          code: "informational",
          diagnostics: "CodeSystem import is not supported",
        },
      ],
    },
  ];
}
