import { GenderAtBirth, Patient, PatientData } from "@metriport/core/domain/patient";
import { genderMapping } from "@metriport/core/external/fhir/patient/index";
import NotFoundError from "@metriport/core/util/error/not-found";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryRespSuccessfulSchema,
} from "@metriport/ihe-gateway-sdk";
import { OutboundPatientDiscoveryRespFaultSchema } from "@metriport/ihe-gateway-sdk/models/patient-discovery/patient-discovery-responses";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import distance from "jaro-winkler";
import { partition } from "lodash";
import { QueryTypes } from "sequelize";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { CQLink } from "../../../external/carequality/cq-patient-data";
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
};

type DbQueryResponseRecordBase = {
  cx_id: string;
  id: string;
  patient_data: PatientData;
  cq_links: { links: CQLink[] };
  name: string | undefined | null;
};
type DbQueryResponseRecordSuccess = DbQueryResponseRecordBase & {
  response_data: OutboundPatientDiscoveryRespSuccessfulSchema | undefined;
};
type DbQueryResponseRecordError = DbQueryResponseRecordBase & {
  response_data: OutboundPatientDiscoveryRespFaultSchema | undefined;
};
type DbQueryResponseRecord = DbQueryResponseRecordSuccess | DbQueryResponseRecordError;

type CwLinks = PatientLinksDTO & { networkLinks: unknown };

export async function getHieOverview(
  patientId: string,
  facilityIdParam: string | undefined,
  debugLevel: DebugLevel
): Promise<HiePatientOverview | undefined> {
  const patient = await PatientModel.findOne({ where: { id: patientId } });
  if (!patient) throw new NotFoundError("Patient not found");

  const getCqData = async () => {
    const queryResp = await getDataFromDb(patientId, debugLevel);
    const [respSuccess, respErrors] = partition(queryResp, isQueryRespSuccessful);
    return { cqSuccess: respSuccess, cqErrors: respErrors };
  };
  const getCwData = async () => await getDataFromCw(patient, facilityIdParam, debugLevel);

  const [cqData, cwData] = await Promise.all([getCqData(), getCwData()]);
  const { cqSuccess, cqErrors } = cqData;

  const errors: CqPdErrorConsolidated[] = cqErrors.reduce(
    (acc: CqPdErrorConsolidated[], curr: DbQueryResponseRecordError) => {
      const rowErrorDetail = (
        curr.response_data?.operationOutcome?.issue[0]?.details as { text: string | undefined }
      )?.text;
      if (!rowErrorDetail) return acc;
      const gatewayName = getGatewayName(curr);
      const existingErrorEntry = acc.find(a => a.error === rowErrorDetail);
      if (existingErrorEntry) {
        existingErrorEntry.gatewayNames.push(gatewayName);
        return acc;
      }
      acc.push({
        error: rowErrorDetail,
        gatewayNames: [gatewayName],
      });
      return acc;
    },
    new Array<CqPdErrorConsolidated>()
  );

  const hieOverview = cqSuccess.reduce(
    (acc: HiePatientOverview | undefined, curr: DbQueryResponseRecordSuccess) => {
      if (!curr.response_data) return acc;
      const patientOfSuccessfulResp = responseToPatient(curr.response_data, patient.data);
      const gatewayName = getGatewayName(curr);
      const gateway = responseToGateway(curr.response_data, gatewayName);
      const success = {
        patient: patientOfSuccessfulResp,
        gateway,
      };
      if (acc) {
        acc.carequality.success.push(success);
        return acc;
      }
      const cqLinks = responseToCqLinks(curr);
      return {
        cxId: curr.cx_id,
        patientId: curr.id,
        patientData: patient.data,
        carequality: {
          links: cqLinks,
          success: [success],
          errors,
        },
        commonwell: cwData,
      };
    },
    undefined
  );
  return hieOverview;
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
async function getDataFromDb(
  patientId: string,
  debugLevel: DebugLevel
): Promise<DbQueryResponseRecord[]> {
  const matchQuery = debugLevel === "success" ? `and pdr.data->>'patientMatch' = 'true'` : "";
  const query =
    debugLevel !== "info"
      ? `
          select p.cx_id, p.id, p.data as patient_data, pd.data as cq_links, pdr.data as response_data, de.name as gateway_name
          from patient p
            left outer join cq_patient_data pd ON pd.id = p.id
            left join patient_discovery_result pdr ON pdr.patient_id::text = p.id ${matchQuery}
            left join cq_directory_entry de ON de.id = pdr.data->>'gatewayHomeCommunityId'
          where p.id = :patientId
        `
      : `
        select p.cx_id, p.id, p.data as patient_data, pd.data as cq_links, null as response_data, null as gateway_name
        from patient p
          left outer join cq_patient_data pd ON pd.id = p.id
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
  return row.name || "Unknown";
}

function responseToCqLinks(resp: DbQueryResponseRecordBase): CQLink[] {
  return resp.cq_links.links;
}

async function getDataFromCw(
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
