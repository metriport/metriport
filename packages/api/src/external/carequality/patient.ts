import { IHEGateway, PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { Organization } from "../../domain/medical/organization";
import { Patient } from "../../domain/medical/patient";
import { capture } from "../../shared/notifications";
import { makeIheGatewayAPI } from "./api";
import { toFHIR } from "../fhir/patient";
import { patientToIheGateway } from "./patient-conversion";
import { setCarequalityId } from "./patient-external-data";

const createContext = "cq.patient.create";

export async function discover(
  patient: Patient,
  organization: Organization,
  facilityId: string
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
      facilityNPI: facilityId,
      orgName: organization.data.name,
      orgOid: organization.oid,
    });

    iheGateway.startPatientDiscovery(iheGatewayRequest);
  } catch (err) {
    console.error(
      `Failure while starting patient discovery for ${patient.id} @ IHE Gateway: `,
      err
    );
    capture.error(err, {
      extra: {
        facilityId,
        patientId: patient.id,
        context: createContext,
      },
    });
    throw err;
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
