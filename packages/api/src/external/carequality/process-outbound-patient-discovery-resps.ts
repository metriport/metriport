import { Patient, PatientDemographicsDiff } from "@metriport/core/domain/patient";
import { Address } from "@metriport/core/domain/address";
import { out } from "@metriport/core/util/log";
import { MedicalDataSource } from "@metriport/core/external/index";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { OutboundPatientDiscoveryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryResp, InboundPatientResource } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { CQLink } from "./cq-patient-data";
import { analytics, EventTypes } from "../../shared/analytics";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { updatePatient } from "../../command/medical/patient/update-patient";
import { getCQData, discover } from "./patient";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { resetPatientScheduledPatientDiscoveryRequestId } from "../hie/reset-scheduled-patient-discovery-request-id";
import { getDocumentsFromCQ } from "./document/query-documents";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";

dayjs.extend(duration);

const context = "cq.patient.discover";
export type PatientResourceAddress = InboundPatientResource["address"][number];
export type ValidPatientResourceAddress = Omit<
  PatientResourceAddress,
  "line" | "city" | "state" | "postalCode"
> & {
  line: [string, ...string[]];
  city: string;
  state: string;
  postalCode: string;
};

export async function processOutboundPatientDiscoveryResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundPatientDiscoveryRespParam): Promise<void> {
  const { log } = out(`CQ PD Processing results - patientId ${patientId}, requestId: ${requestId}`);
  const patientIds = { id: patientId, cxId };

  try {
    const patient = await getPatientOrFail(patientIds);

    if (results.length > 0) await updateDemographics(patient, results);

    log(`Starting to handle patient discovery results`);
    const cqLinks = await createCQLinks(
      {
        id: patientId,
        cxId,
      },
      results
    );

    const pdStartedAt = getCQData(patient.data.externalData)?.pdStartedAt;

    if (pdStartedAt) {
      analytics({
        distinctId: patient.cxId,
        event: EventTypes.patientDiscovery,
        properties: {
          hie: MedicalDataSource.CAREQUALITY,
          patientId: patient.id,
          requestId,
          pdLinks: cqLinks.length,
          duration: elapsedTimeFromNow(pdStartedAt),
        },
      });
    }

    const newPatientDiscovery = await patientDiscoveryIfScheduled(patient);

    if (!newPatientDiscovery) {
      await updatePatientDiscoveryStatus({
        patient: patientIds,
        status: "completed",
      });

      await queryDocsIfScheduled(patient);
    }
  } catch (error) {
    await updatePatientDiscoveryStatus({
      patient: patientIds,
      status: "failed",
    });
    const msg = `Error on Processing Outbound Patient Discovery Responses`;
    console.error(`${msg}. Patient ID: ${patientIds.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        results,
        context,
        error,
      },
    });
    // Why are we not throwing this error?
    throw error;
  }
}

async function queryDocsIfScheduled(patient: Patient): Promise<void> {
  const updatedPatient = await getPatientOrFail(patient);

  const scheduledDocQueryRequestId = getCQData(
    updatedPatient.data.externalData
  )?.scheduledDocQueryRequestId;

  if (scheduledDocQueryRequestId) {
    const resetPatient = await resetPatientScheduledDocQueryRequestId({
      patient: updatedPatient,
      source: MedicalDataSource.CAREQUALITY,
    });

    await getDocumentsFromCQ({
      patient: resetPatient,
      requestId: scheduledDocQueryRequestId,
    });
  }
}

async function patientDiscoveryIfScheduled(patient: Patient): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const cqData = getCQData(updatedPatient.data.externalData);

  const facilityId = cqData?.pdFacilityId;
  const scheduledPdRequestId = cqData?.scheduledPdRequestId;

  let newPatientDiscovery = false;
  if (facilityId && scheduledPdRequestId) {
    const resetPatient = await resetPatientScheduledPatientDiscoveryRequestId({
      patient: updatedPatient,
      source: MedicalDataSource.CAREQUALITY,
    });

    await discover(resetPatient, facilityId, scheduledPdRequestId);

    newPatientDiscovery = true;
  }
  return newPatientDiscovery;
}

async function createCQLinks(
  patient: Pick<Patient, "id" | "cxId">,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<CQLink[]> {
  const { id, cxId } = patient;
  const cqLinks = buildCQLinks(pdResults);

  if (cqLinks.length) await createOrUpdateCQPatientData({ id, cxId, cqLinks });

  return cqLinks;
}

function buildCQLinks(pdResults: OutboundPatientDiscoveryResp[]): CQLink[] {
  return pdResults.flatMap(pd => {
    const id = pd.externalGatewayPatient?.id;
    const system = pd.externalGatewayPatient?.system;
    const url = pd.gateway.url;
    if (!id || !system || !url) return [];
    return {
      patientId: id,
      systemId: system,
      oid: pd.gateway.oid,
      url,
      id: pd.gateway.id,
    };
  });
}

async function updateDemographics(patient: Patient, pdResults: OutboundPatientDiscoveryResp[]) {
  const patientDemographicsDiff = createPatientDemographicsDiff(patient, pdResults);
  const facilityId = getCQData(patient.data.externalData)?.pdFacilityId;
  if (facilityId && patientDemographicsDiff) {
    updatePatient({
      id: patient.id,
      cxId: patient.cxId,
      facilityId,
      ...patient.data,
      address: [...patient.data.address, ...patientDemographicsDiff.address],
    });
  }
}

function createPatientDemographicsDiff(
  patient: Patient,
  pdResults: OutboundPatientDiscoveryResp[]
): PatientDemographicsDiff | undefined {
  const patientResources = getPatientResources(pdResults);
  const newAddresses: Address[] = patientResources
    .flatMap(pr => {
      return pr.address.flatMap((prAddress: PatientResourceAddress) => {
        const validPrAddress: ValidPatientResourceAddress | undefined =
          checkAndReturnValidPrAddress(prAddress);
        if (!validPrAddress) return [];
        const isNew = patient.data.address.every((existingAddress: Address) =>
          checkNonMatchingPrAddress(validPrAddress, existingAddress)
        );
        if (!isNew) return [];
        return validPrAddress;
      });
    })
    .map(convertPrAddress);
  if (newAddresses.length > 0) {
    return {
      address: newAddresses,
    };
  }
  return;
}

function getPatientResources(pdResults: OutboundPatientDiscoveryResp[]): InboundPatientResource[] {
  return pdResults.flatMap(pd => {
    const match = pd.patientMatch;
    if (!match) return [];
    const patientResource = pd.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}

function checkAndReturnValidPrAddress(
  address: PatientResourceAddress
): ValidPatientResourceAddress | undefined {
  if (
    address.line !== undefined &&
    address.line.length > 0 &&
    address.city !== undefined &&
    address.state !== undefined &&
    address.postalCode !== undefined
  ) {
    return {
      ...address,
      line: address.line as [string, ...string[]],
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    };
  }
  return;
}

function checkNonMatchingPrAddress(
  address1: ValidPatientResourceAddress,
  address2: Address
): boolean {
  return (
    address1.line[0] !== address2.addressLine1 ||
    address1.city !== address2.city ||
    address1.state !== address2.state ||
    address1.postalCode !== address2.zip
  );
}

function convertPrAddress(address: ValidPatientResourceAddress): Address {
  return {
    addressLine1: address.line[0],
    addressLine2: address.line[1],
    city: address.city,
    state: address.state as Address["state"],
    zip: address.postalCode,
    country: address.country,
  };
}
