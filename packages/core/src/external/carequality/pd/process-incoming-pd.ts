import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { Patient } from "../../../domain/patient";
import { MPI } from "../../../mpi/mpi";
import { patientMPIToPartialPatient } from "../../../mpi/shared";
import { toFHIR as convertPatientToFHIR } from "../../fhir/patient";
import { validateFHIRAndExtractPatient } from "./validating-pd";
import {
  XDSRegistryError,
  constructPDNoMatchResponse,
  constructPDErrorResponse,
  IHEGatewayError,
} from "../error";
import { METRIPORT_HOME_COMMUNITY_ID } from "../shared";

function constructMatchResponse(
  payload: InboundPatientDiscoveryReq,
  patient: Pick<Patient, "id" | "data">
): InboundPatientDiscoveryResp {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: true,
    externalGatewayPatient: {
      id: patient.id,
      system: "000", // TBD	- what is this
    },
    patientResource: convertPatientToFHIR(patient),
    gatewayHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export async function processIncomingRequest(
  payload: InboundPatientDiscoveryReq,
  mpi: MPI
): Promise<InboundPatientDiscoveryResp> {
  try {
    const patient = validateFHIRAndExtractPatient(payload);
    const matchingPatient = await mpi.findMatchingPatient(patient);
    if (!matchingPatient) {
      return constructPDNoMatchResponse(payload);
    }
    return constructMatchResponse(payload, patientMPIToPartialPatient(matchingPatient));
  } catch (error) {
    if (error instanceof IHEGatewayError) {
      return constructPDErrorResponse(payload, error);
    } else {
      return constructPDErrorResponse(
        payload,
        new XDSRegistryError("Internal Server Error", error)
      );
    }
  }
}
