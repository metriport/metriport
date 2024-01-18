import { chunk } from "lodash";
import BadRequestError from "../../../errors/bad-request";
import { tenantExists } from "../../../external/fhir/admin";
import { makeFhirAdminApi, makeFhirApi } from "../../../external/fhir/api/api-factory";
import { toFHIR as orgToFHIR } from "../../../external/fhir/organization";
import { toFHIR as patientToFHIR } from "@metriport/core/external/fhir/patient/index";
import { Util } from "../../../shared/util";
import { queryDocumentsAcrossHIEs } from "../document/document-query";
import { getOrganizationOrFail } from "../organization/get-organization";
import { getPatients } from "../patient/get-patient";

const PATIENT_CHUNK_SIZE = 20;

const JITTER_DELAY_MAX_MS = 2_000; // in milliseconds
const JITTER_DELAY_MIN_PCT = 10; // 1-100% of max delay

const CHUNK_DELAY_MAX_MS = 20_000; // in milliseconds
const CHUNK_DELAY_MIN_PCT = 50; // 1-100% of max delay

const { log } = Util.out("populateFhirServer");

export type PopulateFhirServerResponse = { patientsOK: number; patientsError: number };

/**
 * @deprecated Should no longer be used. Does not handle multiple hies.
 */
export async function populateFhirServer({
  cxId,
  createIfNotExists = false,
  triggerDocQuery = false,
}: {
  cxId: string;
  createIfNotExists?: boolean;
  triggerDocQuery?: boolean;
}): Promise<PopulateFhirServerResponse> {
  const fhirApi = makeFhirApi(cxId);
  const adminFhirApi = makeFhirAdminApi();
  const orgOnDB = await getOrganizationOrFail({ cxId });

  const exists = await tenantExists(cxId);
  if (!exists && !createIfNotExists) {
    throw new BadRequestError(`FHIR Server it not setup for this customer`);
  }
  if (!exists && createIfNotExists) {
    log("Creating Tenant on FHIR server: ", cxId);
    await adminFhirApi.createTenant(orgOnDB);
  }

  const orgToFhir = orgToFHIR(orgOnDB);
  log("Creating organization on FHIR server: ", orgOnDB.id);
  await fhirApi.updateResource(orgToFhir);

  if (!triggerDocQuery) {
    log(`NOT Triggering doc queries`);
  }

  const patientsOnDB = await getPatients({ cxId });

  let patientsOK = 0;
  let patientsError = 0;
  // TODO move to executeAsynchronously() from core
  const chunks = chunk(patientsOnDB, PATIENT_CHUNK_SIZE);
  const n = chunks.length;
  for (const [i, patientChunk] of chunks.entries()) {
    log(`Creating ${patientChunk.length} patients on FHIR server (chunk ${i}/${n})...`);
    const res = await Promise.allSettled(
      patientChunk.map(async patient => {
        try {
          await jitterPerPatient(); // add some randomness to avoid overloading the FHIR server
          const patientToFhir = patientToFHIR(patient);
          await fhirApi.updateResource(patientToFhir);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          log(`Failed to create patient on FHIR server, id ${patient.id}: `, err.message);
          throw err;
        }
      })
    );

    if (triggerDocQuery) {
      log(`Triggering ASYNC doc query for ${patientChunk.length} patients (chunk ${i}/${n})...`);
      patientChunk.forEach(patient => {
        if (patient.facilityIds.length < 1) return;
        queryDocumentsAcrossHIEs({
          cxId,
          patientId: patient.id,
          facilityId: patient.facilityIds[0],
          override: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).catch((err: any) => {
          log(`Failed to init query of documents for patient ${patient.id}: `, err.message);
        });
      });
    }

    patientsOK += res.filter(r => r.status === "fulfilled").length;
    patientsError += res.filter(r => r.status === "rejected").length;

    await sleepBetweenChunks();
  }

  const result = { patientsOK, patientsError };
  log(`Finished processing patients of cx ${cxId} - `, result);
  return result;
}

async function jitterPerPatient(): Promise<void> {
  return Util.sleepRandom(JITTER_DELAY_MAX_MS, JITTER_DELAY_MIN_PCT / 100);
}

async function sleepBetweenChunks(): Promise<void> {
  return Util.sleepRandom(CHUNK_DELAY_MAX_MS, CHUNK_DELAY_MIN_PCT / 100);
}
