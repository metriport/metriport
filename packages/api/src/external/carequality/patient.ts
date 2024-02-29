import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { getOrgs } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { isCQDirectEnabledForCx } from "../aws/appConfig";
import { makeIheGatewayAPIForPatientDiscovery } from "../ihe-gateway/api";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { getOrganizationsWithXCPD } from "./command/cq-directory/cq-gateways";
import {
  CQOrgBasicDetails,
  filterCQOrgsToSearch,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "./command/cq-directory/search-cq-directory";
import { deleteCQPatientData } from "./command/cq-patient-data/delete-cq-data";
import { createOutboundPatientDiscoveryReq } from "./create-outbound-patient-discovery-req";
import { CQDirectoryEntryModel } from "./models/cq-directory";
import { cqOrgsToXCPDGateways, generateIdsForGateways } from "./organization-conversion";
import { PatientDataCarequality } from "./patient-shared";

dayjs.extend(duration);

const context = "cq.patient.discover";
const iheGateway = makeIheGatewayAPIForPatientDiscovery();
const resultPoller = makeOutboundResultPoller();
const cqOrgsHydrated = getOrgs();

export async function discover(patient: Patient, facilityNPI: string): Promise<void> {
  const baseLogMessage = `CQ PD - patientId ${patient.id}`;
  const { log: outerLog } = out(baseLogMessage);
  const { cxId } = patient;

  if (!iheGateway) return outerLog(`IHE GW not available, skipping PD`);
  if (!(await isCQDirectEnabledForCx(cxId))) {
    return outerLog(`CQ disabled for cx ${cxId}, skipping PD`);
  }

  try {
    const pdRequest = await prepareForPatientDiscovery(patient, facilityNPI);
    const numGateways = pdRequest.gateways.length;

    const { log } = out(`${baseLogMessage}, requestId: ${pdRequest.id}`);

    log(`Kicking off patient discovery`);
    await iheGateway.startPatientDiscovery(pdRequest);

    await resultPoller.pollOutboundPatientDiscoveryResults({
      requestId: pdRequest.id,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: numGateways,
    });
  } catch (error) {
    const msg = `Error on Patient Discovery`;
    outerLog(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityNPI,
        patientId: patient.id,
        context,
        error,
      },
    });
  }
}

export function getCQData(
  data: PatientExternalData | undefined
): PatientDataCarequality | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.CAREQUALITY] as PatientDataCarequality; // TODO validate the type
}

export async function remove(patient: Patient): Promise<void> {
  console.log(`Deleting CQ data - M patientId ${patient.id}`);
  await deleteCQPatientData({ id: patient.id, cxId: patient.cxId });
}

async function prepareForPatientDiscovery(
  patient: Patient,
  facilityNPI: string
): Promise<OutboundPatientDiscoveryReq> {
  const { cxId } = patient;
  const fhirPatient = toFHIR(patient);
  const [organization, nearbyOrgs, allOrgs] = await Promise.all([
    getOrganizationOrFail({ cxId }),
    searchCQDirectoriesAroundPatientAddresses({ patient }),
    getOrganizationsWithXCPD(),
  ]);
  const [gateways, orgs] = splitGatewaysAndNonGateways(allOrgs);
  const sortedGateways = sortCQOrganizationsByPrio(gateways);
  const sortedNearbyOrgs = sortCQOrganizationsByPrio(nearbyOrgs);
  const sortedOrgs = sortCQOrganizationsByPrio(orgs);

  const orgsToSearch = filterCQOrgsToSearch([
    ...sortedGateways,
    ...sortedNearbyOrgs,
    ...sortedOrgs,
  ]);
  const xcpdGatewaysWithoutIds = cqOrgsToXCPDGateways(orgsToSearch);
  const xcpdGateways = generateIdsForGateways(xcpdGatewaysWithoutIds);

  const pdRequest = createOutboundPatientDiscoveryReq({
    patient: fhirPatient,
    cxId: patient.cxId,
    xcpdGateways,
    facilityNPI,
    orgName: organization.data.name,
    orgOid: organization.oid,
  });
  return pdRequest;
}

function splitGatewaysAndNonGateways(
  cqOrgs: CQDirectoryEntryModel[]
): [CQDirectoryEntryModel[], CQDirectoryEntryModel[]] {
  return [cqOrgs.filter(o => o.gateway), cqOrgs.filter(o => !o.gateway)];
}

function sortCQOrganizationsByPrio(cqOrgs: CQDirectoryEntryModel[]): CQOrgBasicDetails[] {
  const orgsWithPrio = mapCQOrganizationPriorities(cqOrgs);
  const sortedOrgs = sortByPrio(orgsWithPrio);
  const sortedOrgBasics = sortedOrgs.map(toBasicOrgAttributes);
  return sortedOrgBasics;
}

type CQOrganizationWithPrio = CQDirectoryEntryModel & { prio: string | undefined };

function mapCQOrganizationPriorities(cqOrgs: CQDirectoryEntryModel[]): CQOrganizationWithPrio[] {
  const res = cqOrgs.map(org => {
    const matchingOrg = cqOrgsHydrated.find(o => o.id === org.id);
    return {
      ...org.dataValues,
      prio: matchingOrg ? matchingOrg.prio : undefined,
    } as CQOrganizationWithPrio;
  });
  return res;
}

function sortByPrio(orgs: CQOrganizationWithPrio[]): CQOrganizationWithPrio[] {
  const high = orgs.filter(o => o.prio === "high");
  const medium = orgs.filter(o => o.prio === "medium");
  const low = orgs.filter(o => o.prio === "low" || !o.prio);
  return [...high, ...medium, ...low];
}
