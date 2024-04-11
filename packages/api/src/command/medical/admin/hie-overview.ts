import { GenderAtBirth, PatientData } from "@metriport/core/domain/patient";
import { genderMapping } from "@metriport/core/external/fhir/patient/index";
import { initReadonlyDBPool } from "@metriport/core/util/sequelize";
import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import distance from "jaro-winkler";
import { partition } from "lodash";
import { QueryTypes } from "sequelize";
import { CQLink } from "../../../external/carequality/cq-patient-data";
import { Config } from "../../../shared/config";

dayjs.extend(duration);

const readOnlyDBPool = initReadonlyDBPool(Config.getDBCreds(), Config.getDBReadReplicaEndpoint());

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
  patient: HiePatient;
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

type DbQueryResponseRecord = {
  cx_id: string;
  id: string;
  patient_data: PatientData;
  cq_links: { links: CQLink[] };
  response_data: OutboundPatientDiscoveryResp | undefined;
  name: string | undefined | null;
};

export async function getHieOverview(
  patientId: string,
  debugLevel: DebugLevel
): Promise<HiePatientOverview | undefined> {
  const queryResp: DbQueryResponseRecord[] = await getDataFromDb(patientId, debugLevel);
  const [respErrors, respSuccess] = partition(
    queryResp,
    r => r.response_data?.patientMatch === false
  );
  const patientData = respSuccess[0]?.patient_data;

  const errors: CqPdErrorConsolidated[] = respErrors.reduce(
    (acc: CqPdErrorConsolidated[], row: DbQueryResponseRecord) => {
      const rowErrorDetail = (
        row.response_data?.operationOutcome?.issue[0]?.details as { text: string | undefined }
      )?.text;
      if (!rowErrorDetail) return acc;
      const gatewayName = getGatewayName(row);
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

  const hieOverview = respSuccess.reduce(
    (acc: HiePatientOverview | undefined, row: DbQueryResponseRecord) => {
      if (!row.response_data) return acc;
      const patientOfSuccessfulResp = responseToPatient(row.response_data, patientData);
      if (!patientOfSuccessfulResp) {
        console.log(`Skipping response with missing patient data: ${row.response_data.id}`);
        return acc;
      }
      const gatewayName = getGatewayName(row);
      const gateway = responseToGateway(row.response_data, gatewayName);
      const success = {
        patient: patientOfSuccessfulResp,
        gateway,
      };
      if (acc) {
        acc.carequality.success.push(success);
        return acc;
      }
      const cqLinks = responseToCqLinks(row);
      return {
        cxId: row.cx_id,
        patientId: row.id,
        patientData,
        carequality: {
          links: cqLinks,
          success: [success],
          errors,
        },
      };
    },
    undefined
  );
  return hieOverview;
}

async function getDataFromDb(
  patientId: string,
  debugLevel: DebugLevel
): Promise<DbQueryResponseRecord[]> {
  const matchQuery = debugLevel === "success" ? `and r.data->>'patientMatch' = 'true'` : "";
  const query =
    debugLevel !== "info"
      ? `
          select p.cx_id, p.id, p.data as patient_data, pd.data as cq_links, r.data as response_data, d.name as gateway_name
          from patient p
            left outer join cq_patient_data pd on pd.id = p.id
            left join patient_discovery_result r on r.patient_id::text = p.id ${matchQuery}
            left join cq_directory_entry d on d.id = r.data->>'gatewayHomeCommunityId'
          where p.id = ':patientId'
        `
      : `
        select p.cx_id, p.id, p.data as patient_data, pd.data as cq_links, null as response_data, null as gateway_name
        from patient p
          left outer join cq_patient_data pd on pd.id = p.id
        where p.id = ':patientId'
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
  resp: OutboundPatientDiscoveryResp,
  patientOnMetriport: PatientData
): HiePatient | undefined {
  if (!resp.patientMatch) return undefined;
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
  const nameAdj = name?.trim().toLowerCase();
  const referenceNameAdj = referenceName?.trim().toLowerCase();
  if (!nameAdj || !referenceNameAdj) return name;
  const dist = distance(nameAdj, referenceNameAdj);
  const suffix = dist === 1 ? "same" : dist.toString();
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
  return `${genderAdj} (diff)`;
}

function addDobDiff(dob: string | undefined, referenceDob: string): string | undefined {
  const dobAdj = dob?.trim();
  if (dayjs(dobAdj).isSame(referenceDob)) return `${dobAdj} (same)`;
  return `${dobAdj} (diff)`;
}

function responseToGateway(resp: OutboundPatientDiscoveryResp, name: string): HieGateway {
  return {
    name,
    oid: resp.gateway.oid,
    url: resp.gateway.url,
  };
}

function getGatewayName(row: DbQueryResponseRecord): string {
  return row.name || "Unknown";
}

function responseToCqLinks(resp: DbQueryResponseRecord): CQLink[] {
  return resp.cq_links.links;
}
