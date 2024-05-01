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
import { processPatientDiscoveryProgress } from "./process-patient-discovery-progress";
import { analytics, EventTypes } from "../../shared/analytics";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

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
  const baseLogMessage = `CQ PD Processing results - patientId ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);
  const { log: outerLog } = out(baseLogMessage);
  const patientIds = { id: patientId, cxId };

  try {
    if (results.length === 0) {
      log(`No patient discovery results found.`);
      await processPatientDiscoveryProgress({ patient: patientIds, status: "completed" });
      return;
    }

    const patient = await getPatientOrFail(patientIds);
    const patientDemographicsDiff: PatientDemographicsDiff | undefined =
      createPatientDemographicsDiff(patient, results);

    log(`Starting to handle patient discovery results`);
    const cqLinks = await createCQLinks(
      {
        id: patientId,
        cxId,
      },
      results
    );

    await processPatientDiscoveryProgress({
      patient: patientIds,
      status: "completed",
      patientDemographicsDiff,
    });

    const startedAt = patient.data.patientDiscovery?.startedAt;

    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.CAREQUALITY,
        patientId: patient.id,
        requestId,
        pdLinks: cqLinks.length,
        duration: elapsedTimeFromNow(startedAt),
      },
    });

    log(`Completed.`);
  } catch (error) {
    const msg = `Error on Processing Outbound Patient Discovery Responses`;
    outerLog(`${msg} - ${errorToString(error)}`);
    await processPatientDiscoveryProgress({ patient: patientIds, status: "failed" });
    capture.error(msg, {
      extra: {
        patientId,
        results,
        context,
        error,
      },
    });
  }
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
