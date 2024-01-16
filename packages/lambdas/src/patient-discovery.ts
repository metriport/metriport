import * as Sentry from "@sentry/serverless";
import {
  PatientDiscoveryReqFromExternalGW,
  PatientDiscoveryRespToExternalGW,
  baseRequestSchema,
} from "@metriport/ihe-gateway-sdk";
import { getEnvVar } from "@metriport/core/util/env-var";

const version = getEnvVar(`METRIPORT_VERSION`);

export const handler = Sentry.AWSLambda.wrapHandler(processRequest);

// Function to extract necessary fields and construct the responses
async function processRequest(
  payload: PatientDiscoveryReqFromExternalGW
): Promise<PatientDiscoveryRespToExternalGW> {
  console.log(`Running with patientId: ${payload.patientId}; version: ${version}`);

  // validate with zod schema
  const baseRequest = baseRequestSchema.parse({
    id: payload.id,
    timestamp: payload.timestamp,
    samlAttributes: payload.samlAttributes,
    patientId: payload.patientId,
  });

  const fullRequest: PatientDiscoveryReqFromExternalGW = {
    ...baseRequest,
    patientResource: payload.patientResource,
  };

  if (Math.random() > 0.5) {
    return constructErrorResponse(fullRequest);
  }
  return constructErrorResponse(fullRequest);
}

// Function to construct error response
function constructErrorResponse(
  payload: PatientDiscoveryReqFromExternalGW
): PatientDiscoveryRespToExternalGW {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: false,
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
// OUTDATED UPDATED BY JONAHS PR
// function constructSuccessResponse(
//   payload: PatientDiscoveryReqFromExternalGW,
//   patientMatch: boolean
// ): PatientDiscoveryRespToExternalGW {
//   const patientResource: Patient = {
//     resourceType: "Patient",
//     identifier: [
//       {
//         system: "http://hl7.org/fhir/sid/us-ssn",
//         value: "666-10-0001",
//       },
//     ],
//     name: [
//       {
//         family: "NWHINZZZTESTPATIENT",
//         given: ["NWHINONE"],
//       },
//     ],
//     gender: "male",
//     birthDate: "1981-01-01",
//     address: [
//       {
//         line: ["1100 Test Street"],
//         city: "Helena",
//         state: "AL",
//         postalCode: "35080",
//         country: "USA",
//       },
//     ],
//   };

//   return {
//     id: payload.id,
//     timestamp: payload.timestamp,
//     responseTimestamp: new Date().toISOString(),
//     patientMatch: true,
//     externalGatewayPatient: {
//       id: patient.id,
//       system: "000", // TBD	- what is this
//     },
//     patientResource: convertPatientToFHIR(patient),
//     xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
//   };
// }
