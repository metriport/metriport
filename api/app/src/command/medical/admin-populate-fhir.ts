import BadRequestError from "../../errors/bad-request";
import { tenantExists } from "../../external/fhir/admin";
import { makeFhirAdminApi, makeFhirApi } from "../../external/fhir/api/api-factory";
import { toFHIR as orgToFHIR } from "../../external/fhir/organization";
import { toFHIR as patientToFHIR } from "../../external/fhir/patient";
import { Util } from "../../shared/util";
import { getOrganizationOrFail } from "./organization/get-organization";
import { getPatients } from "./patient/get-patient";

const { log } = Util.out("populateFhirServer");

export type PopulateFhirServerResponse = { patientsOK: number; patientsError: number };

export async function populateFhirServer({
  cxId,
  createIfNotExists = false,
}: {
  cxId: string;
  createIfNotExists?: boolean;
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

  log("Creating patients on FHIR server...");
  const patientsOnDB = await getPatients({ cxId });
  const res = await Promise.allSettled(
    patientsOnDB.map(async patient => {
      try {
        const patientToFhir = patientToFHIR(patient);
        await fhirApi.updateResource(patientToFhir);
      } catch (err) {
        log("Failed to create patient on FHIR server: ", patient.id);
        throw err;
      }
    })
  );

  return {
    patientsOK: res.filter(r => r.status === "fulfilled").length,
    patientsError: res.filter(r => r.status === "rejected").length,
  };
}
