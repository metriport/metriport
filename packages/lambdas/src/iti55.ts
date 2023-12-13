import * as Sentry from "@sentry/serverless";
import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
  PatientDiscoveryRequestIncomingSchema,
  PatientResource,
} from "@metriport/ihe-gateway-sdk";
// import { Patient, patientCreateSchema} from "@metriport/api-sdk";

// Function to extract necessary fields and construct the responses
async function processRequest(
  payload: PatientDiscoveryRequestIncoming
): Promise<PatientDiscoveryResponseOutgoing> {
  const validationResult = PatientDiscoveryRequestIncomingSchema.safeParse(payload);

  if (!validationResult.success) {
    return constructErrorResponse(payload);
  }
  return constructSuccessResponse(payload, true);
}

// Function to construct error response
function constructErrorResponse(
  payload: PatientDiscoveryRequestIncoming
): PatientDiscoveryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: false,
    xcpdHomeCommunityId: payload.samlAttributes.homeCommunityId,
    operationOutcome: {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "structure",
          details: { text: "Invalid structure" },
        },
      ],
    },
  };
}

// Function to construct success response
function constructSuccessResponse(
  payload: PatientDiscoveryRequestIncoming,
  patientMatch: boolean
): PatientDiscoveryResponseOutgoing {
  const patientResource: PatientResource = {
    resourceType: "Patient",
    identifier: [
      {
        system: "http://hl7.org/fhir/sid/us-ssn",
        value: "666-10-0001",
      },
    ],
    name: [
      {
        family: "NWHINZZZTESTPATIENT",
        given: ["NWHINONE"],
      },
    ],
    gender: "male",
    birthDate: "1981-01-01",
    address: [
      {
        line: ["1100 Test Street"],
        city: "Helena",
        state: "AL",
        postalCode: "35080",
        country: "USA",
      },
    ],
  } as PatientResource;

  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientId: payload.patientResource.id || undefined,
    patientMatch: patientMatch,
    xcpdHomeCommunityId: payload.samlAttributes.homeCommunityId,
    xcpdPatientId: {
      id: payload.patientResource.id || "",
      system: payload.samlAttributes.homeCommunityId,
    },
    patientResource: patientResource,
  };
}

export const handler = Sentry.AWSLambda.wrapHandler(processRequest);
