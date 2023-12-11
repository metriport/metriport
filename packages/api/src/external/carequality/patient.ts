import { IHEGateway, PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { Organization } from "../../domain/medical/organization";
import { Patient, PatientExternalData } from "../../domain/medical/patient";
import { capture } from "../../shared/notifications";
import { makeIheGatewayAPI } from "./api";
import { toFHIR } from "../fhir/patient";
import { patientToIheGateway } from "./patient-conversion";
import { setCarequalityId } from "./patient-external-data";
import { PatientDataCarequality } from "./patient-shared";
import { MedicalDataSource } from "..";

const createContext = "cq.patient.create";

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
  let iheGateway: IHEGateway | undefined;
  try {
    console.log(`IHE Gateway patient discovery - M patientId ${patient.id}`);

    iheGateway = makeIheGatewayAPI();

    const fhirPatient = toFHIR(patient);

    const iheGatewayRequest = patientToIheGateway({
      patient: fhirPatient,
      cxId: patient.cxId,
      xcpdGateways: [], // TODO ADD XCPD GATEWAYS WHEN WE HAVE THEM
      facilityNPI: facilityNPI,
      orgName: organization.data.name,
      orgOid: organization.oid,
    });

    iheGateway.startPatientDiscovery(iheGatewayRequest);
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
      `No patient match in IHE Gatway for patientId ${patientId}, cxId ${cxId}, gatewayUrl ${gateway.url}, gatewayId ${gateway.oid}`
    );
  }
}
