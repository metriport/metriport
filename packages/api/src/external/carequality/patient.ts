import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import pTimeout from "p-timeout";
import { MedicalDataSource } from "..";
import { searchNearbyCQOrganizations } from "../../command/medical/cq-directory/search-cq-directory";
import { getPatientDiscoveryResults } from "../../command/medical/patient-discovery-result/get-patient-discovery-result";
import {
  PatientExternalUpdateCmd,
  updateExternalData,
} from "../../command/medical/patient/update-external-data";
import { Organization } from "../../domain/medical/organization";
import { Patient, PatientExternalData } from "../../domain/medical/patient";
import { capture } from "../../shared/notifications";
import { toFHIR } from "../fhir/patient";
// import { makeIheGatewayAPI } from "./api";
import { cqOrgsToXCPDGateways } from "./organization-conversion";
import { patientToIheGateway } from "./patient-conversion";
import { setCarequalityId } from "./patient-external-data";
import { PatientDataCarequality } from "./patient-shared";
import { mockLongExecution } from "./mock-patient-discovery";

dayjs.extend(duration);

const createContext = "cq.patient.discover";
export const PATIENT_DISCOVERY_TIMEOUT = dayjs.duration({ seconds: 10 });

export function getCQData(
  data: PatientExternalData | undefined
): PatientDataCarequality | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.CAREQUALITY] as PatientDataCarequality;
}

export async function discover(
  patient: Patient,
  organization: Organization,
  facilityNPI: string
): Promise<void> {
  try {
    const { id, cxId, data, eTag } = patient;
    // const iheGateway = makeIheGatewayAPI();
    console.log(`IHE Gateway patient discovery - M patientId ${id}`);

    const fhirPatient = toFHIR(patient);
    const nearbyCQOrgs = await searchNearbyCQOrganizations({
      cxId,
      patientId: id,
    });
    const xcpdGateways = cqOrgsToXCPDGateways(nearbyCQOrgs);
    const iheGatewayRequest = patientToIheGateway({
      patient: fhirPatient,
      cxId: patient.cxId,
      xcpdGateways,
      facilityNPI: facilityNPI,
      orgName: organization.data.name,
      orgOid: organization.oid,
    });
    try {
      // TODO: Uncomment this when testing is done
      // await pTimeout(
      //   iheGateway.startPatientDiscovery(iheGatewayRequest),
      //   PATIENT_DISCOVERY_TIMEOUT.asMilliseconds(),
      //   "startPatientDiscovery function timed out!"
      // );

      // TODO: Remove this when testing is done
      await pTimeout(
        mockLongExecution(iheGatewayRequest),
        PATIENT_DISCOVERY_TIMEOUT.asMilliseconds(),
        "startPatientDiscovery function timed out!"
      );
      // Handle successful completion faster than timeout. Think event listeners/emitters?
    } catch (error) {
      if (error instanceof pTimeout.TimeoutError) {
        console.log(error.message);
      } else {
        const msg = `Failure while starting patient discovery for ${patient.id} @ IHE Gateway`;
        console.error(`${msg}. Cause: ${error}`);
        capture.message(msg, {
          extra: {
            facilityNPI,
            patientId: patient.id,
            context: createContext,
            error,
          },
          level: "error",
        });
      }
    }

    // At this point, discovery results are stored in the database, so we can retrieve them
    const discoveryResults = await getPatientDiscoveryResults(iheGatewayRequest.id);
    const linkedGateways = discoveryResults.map(result => result.data.gateway);

    const updateData: PatientExternalUpdateCmd = {
      id: patient.id,
      cxId,
      eTag,
      COMMONWELL: data.externalData?.COMMONWELL ?? undefined,
      CAREQUALITY: {
        ...data.externalData?.CAREQUALITY,
        gateways: linkedGateways,
      },
    };
    await updateExternalData(updateData);
    console.log("CQ Patient discovery complete!");
  } catch (err) {
    const msg = `Failure while starting patient discovery for ${patient.id} @ IHE Gateway`;
    console.error(msg, err);
    capture.message(msg, {
      extra: {
        facilityNPI,
        patientId: patient.id,
        context: createContext,
        error: err,
      },
      level: "error",
    });
  }
}

export async function handleDiscoverResponse(
  patientDiscoveryResponse: PatientDiscoveryResponse
): Promise<void> {
  const { cxId, patientId, xcpdPatientId, patientMatch, gateway } = patientDiscoveryResponse;

  if (patientMatch) {
    await setCarequalityId({
      patientId,
      cxId,
      carequalityPatientId: xcpdPatientId?.id ?? "",
      carequalityPatientSystemId: xcpdPatientId?.system ?? "",
    });
  } else {
    // WE SHOULD EXPECT THIS TO HAPPEN SO SHOULD WE ADD SENTRY MESSAGE?
    // DONT WANT TO BOMBARD ALERTS CHANNEL
    console.log(
      `No patient match in IHE Gateway for patientId ${patientId}, cxId ${cxId}, gatewayUrl ${gateway.url}, gatewayOid ${gateway.oid}`
    );
  }
}
