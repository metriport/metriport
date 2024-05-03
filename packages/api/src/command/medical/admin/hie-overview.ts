import { GenderAtBirth, Patient, PatientData } from "@metriport/core/domain/patient";
import { genderMapping } from "@metriport/core/external/fhir/patient/index";
import NotFoundError from "@metriport/core/util/error/not-found";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryRespSuccessfulSchema,
  OutboundPatientDiscoveryRespFaultSchema,
} from "@metriport/core/external/carequality/ihe-gateway-types";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import distance from "jaro-winkler";
import { partition } from "lodash";
import { QueryTypes } from "sequelize";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { CQLink } from "../../../external/carequality/cq-patient-data";
import { CQPatientDataModel } from "../../../external/carequality/models/cq-patient-data";
import cwCommands from "../../../external/commonwell";
import { PatientModel } from "../../../models/medical/patient";
import { dtoFromCW, PatientLinksDTO } from "../../../routes/medical/dtos/linkDTO";
import { Config } from "../../../shared/config";

dayjs.extend(duration);

const readOnlyDBPool = initReadonlyDbPool(Config.getDBCreds(), Config.getDbReadReplicaEndpoint());

type DebugLevel = "info" | "success" | "error";

type HieGateway = {
  name: string;
  oid: string;
  url: string | undefined;
};

type HiePatient = {
  name: {
    family: string | undefined;
    given: string | undefined;
  }[];
  gender: string | undefined;
  birthDate: string | undefined;
  address: {
    line: string | undefined;
    city: string | undefined;
    state: string | undefined;
    postalCode: string | undefined;
    country: string | undefined;
  }[];
};

type CqPdSuccessResponse = {
  gateway: HieGateway;
  patient: HiePatient | undefined;
};

type CqPdErrorConsolidated = {
  error: string;
  gatewayNames: string[];
};

type HiePatientOverview = {
  cxId: string;
  patientId: string;
  patientData: PatientData;
  carequality: {
    links: CQLink[];
    success: CqPdSuccessResponse[];
    errors: CqPdErrorConsolidated[];
  };
  commonwell: CwLinks | undefined;
};

type CwLinks = PatientLinksDTO & { networkLinks: unknown };

type DbQueryResponseRecordBase = {
  cx_id: string;
  id: string;
  patient_data: PatientData;
  cq_links: { links: CQLink[] };
  gateway_name: string | undefined | null;
};
type DbQueryResponseRecordSuccess = DbQueryResponseRecordBase & {
  response_data: OutboundPatientDiscoveryRespSuccessfulSchema | undefined;
};
type DbQueryResponseRecordError = DbQueryResponseRecordBase & {
  response_data: OutboundPatientDiscoveryRespFaultSchema | undefined;
};
type DbQueryResponseRecord = DbQueryResponseRecordSuccess | DbQueryResponseRecordError;

export async function getHieOverview(
  patientId: string,
  facilityIdParam: string | undefined,
  debugLevel: DebugLevel
): Promise<HiePatientOverview | undefined> {
  const [patient, cqPatientData] = await Promise.all([
    PatientModel.findOne({ where: { id: patientId } }),
    CQPatientDataModel.findOne({ where: { id: patientId } }),
  ]);
  if (!patient) throw new NotFoundError("Patient not found");

  const [cqData, cwData] = await Promise.all([
    getCqData(patient, debugLevel),
    getCwData(patient, facilityIdParam, debugLevel),
  ]);
  const { success: cqSuccess, errors: cqErrors } = cqData;

  const hieOverview: HiePatientOverview = {
    cxId: patient.cxId,
    patientId: patient.id,
    patientData: patient.data,
    carequality: {
      links: cqPatientData?.data.links ?? [],
      success: cqSuccess,
      errors: cqErrors,
    },
    commonwell: cwData,
  };

  return hieOverview;
}

async function getCqData(
  patient: Patient,
  debugLevel: DebugLevel
): Promise<{ success: CqPdSuccessResponse[]; errors: CqPdErrorConsolidated[] }> {
  const queryResp = await getCqDataFromDb(patient.id, debugLevel);
  const [respSuccess, respErrors] = partition(queryResp, isQueryRespSuccessful);

  const cqErrors: CqPdErrorConsolidated[] = [];
  for (const entry of respErrors) {
    const rowErrorDetail = (
      entry.response_data?.operationOutcome?.issue[0]?.details as { text: string | undefined }
    )?.text;
    if (!rowErrorDetail) continue;
    const gatewayName = getGatewayName(entry);
    const existingErrorEntry = cqErrors.find(a => a.error === rowErrorDetail);
    if (existingErrorEntry) {
      existingErrorEntry.gatewayNames.push(gatewayName);
      continue;
    }
    cqErrors.push({
      error: rowErrorDetail,
      gatewayNames: [gatewayName],
    });
  }

  const cqSuccess: CqPdSuccessResponse[] = [];
  for (const entry of respSuccess) {
    if (!entry.response_data) continue;
    const patientOfSuccessfulResp = responseToPatient(entry.response_data, patient.data);
    const gatewayName = getGatewayName(entry);
    const gateway = responseToGateway(entry.response_data, gatewayName);
    const success = {
      patient: patientOfSuccessfulResp,
      gateway,
    };
    cqSuccess.push(success);
  }

  return { success: cqSuccess, errors: cqErrors };
}

function isQueryRespSuccessful(
  entry: DbQueryResponseRecord
): entry is DbQueryResponseRecordSuccess {
  return entry.response_data?.patientMatch === true;
}

// Using raw SQL because our models don't represent the joining of these tables, so not only we
// need a custom type as result, but it also it didn't work trying to join Models "on-the-fly"
// without changing their definition, like:
// https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/#complex-where-clauses-at-the-top-level
// Also, this might return a lot of records, so the alternative would be to load all CQ directory and
// and join the results in-memory.
async function getCqDataFromDb(
  patientId: string,
  debugLevel: DebugLevel
): Promise<DbQueryResponseRecord[]> {
  if (debugLevel === "info") return [];
  const matchQuery = debugLevel === "success" ? `and pdr.data->>'patientMatch' = 'true'` : "";
  const query = `
    select p.cx_id, p.id, pdr.data as response_data, de.name as gateway_name
    from patient p
      left join patient_discovery_result pdr ON pdr.patient_id = p.id::uuid ${matchQuery}
      left join cq_directory_entry de ON de.id = pdr.data->'gateway'->>'oid'
    where p.id = :patientId
  `;
  const replacements = {
    patientId,
  };
  const queryResp: DbQueryResponseRecord[] = await readOnlyDBPool.query(query, {
    replacements,
    type: QueryTypes.SELECT,
  });
  return queryResp;
}

function responseToPatient(
  resp: OutboundPatientDiscoveryRespSuccessfulSchema,
  patientOnMetriport: PatientData
): HiePatient | undefined {
  const patientOnExternalGw = resp.patientResource;
  if (!patientOnExternalGw) return undefined;
  return {
    name:
      patientOnExternalGw.name?.map(name => ({
        family: addStringDiff(name.family, patientOnMetriport.lastName),
        given: (name.given ?? [])
          .map(g => addStringDiff(g, patientOnMetriport.firstName))
          .join(", "),
      })) ?? [],
    gender: addGenderDiff(patientOnExternalGw.gender, patientOnMetriport.genderAtBirth),
    birthDate: addDobDiff(patientOnExternalGw.birthDate, patientOnMetriport.dob),
    address:
      patientOnExternalGw.address?.map(addr => ({
        line: addr.line?.join(", "),
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
      })) ?? [],
  };
}

function addStringDiff(
  name: string | undefined,
  referenceName: string | undefined
): string | undefined {
  const nameAdjusted = name?.trim().toLowerCase();
  const referenceNameAdj = referenceName?.trim().toLowerCase();
  if (!nameAdjusted || !referenceNameAdj) return name;
  const dist = formatNumber(distance(nameAdjusted, referenceNameAdj));
  const suffix = dist === 1 ? "same" : `dist: ${dist.toString()}; metriport: ${referenceName}`;
  return `${name} (${suffix})`;
}

function addGenderDiff(
  gender: string | undefined,
  referenceGender: GenderAtBirth
): string | undefined {
  const genderAdj = gender?.trim();
  if (!genderAdj) return undefined;
  const referenceGenderAdj = genderMapping[referenceGender];
  if (genderAdj === referenceGenderAdj) return `${genderAdj} (same)`;
  return `${genderAdj} (diff; metriport: ${referenceGender})`;
}

function addDobDiff(dob: string | undefined, referenceDob: string): string | undefined {
  const dobAdj = dob?.trim();
  if (dayjs(dobAdj).isSame(referenceDob)) return `${dobAdj} (same)`;
  return `${dobAdj} (diff); metriport: ${referenceDob}`;
}

function responseToGateway(resp: OutboundPatientDiscoveryResp, name: string): HieGateway {
  return {
    name,
    oid: resp.gateway.oid,
    url: resp.gateway.url,
  };
}

function getGatewayName(row: DbQueryResponseRecordBase): string {
  return row.gateway_name || "Unknown";
}

async function getCwData(
  patient: Patient,
  facilityIdParam: string | undefined,
  debugLevel: DebugLevel
): Promise<CwLinks | undefined> {
  if (debugLevel === "info") {
    return undefined;
  }
  const facilityId = getFacilityIdOrFail(patient, facilityIdParam);

  const cwPersonLinks = await cwCommands.link.get(patient.id, patient.cxId, facilityId);
  const cwConvertedLinks = dtoFromCW({
    cwPotentialPersons: cwPersonLinks.potentialLinks,
    cwCurrentPersons: cwPersonLinks.currentLinks,
  });

  return {
    currentLinks: cwConvertedLinks.currentLinks,
    potentialLinks: cwConvertedLinks.potentialLinks,
    networkLinks: cwPersonLinks.networkLinks,
  };
}
