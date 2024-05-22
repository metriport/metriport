import { getPersonId, getPersonIdFromUrl } from "@metriport/commonwell-sdk";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import MetriportError from "../../../errors/metriport-error";
import { autoUpgradeNetworkLinks } from "../link/shared";
import { updatePatientAndPersonIds } from "../command/update-patient-and-person-ids";
import { updatePatientDiscoveryStatus } from "../command/update-patient-discovery-status";
import { isEnrolledBy } from "../person-shared";
import { getCWAccessForPatient } from "./shared";

/**
 * IMPORTANT: This is an Admin-only function, it should not be executed outside of internal endpoints.
 *
 * Patch duplicated persons in CommonWell - sibling of find-patient-duplicates.ts
 *
 * Links the patient to the chosen person.
 * Additionally, unenroll those enrolled by Metriport:
 * - any other person linked to the patient; AND
 * - all other persons matching the patient's demographics if the `unenrollByDemographics`
 *   param is set to true (defaults to false).
 */
export async function patchDuplicatedPersonsForPatient(
  cxId: string,
  patientId: string,
  chosenPersonId: string,
  unenrollByDemographics = false,
  orgIdExcludeList: () => Promise<string[]>
): Promise<void> {
  const context = "patchDuplicatedPersonsForPatient";
  const { log } = out(`${context} ${patientId}`);

  const patient = await getPatientOrFail({ cxId, id: patientId });
  const cwAccess = await getCWAccessForPatient(patient);
  if (cwAccess.error != null) throw new MetriportError(cwAccess.error);
  const { commonWell, queryMeta, cwPatientId, orgName } = cwAccess;

  try {
    // make sure the person exists @ CW
    await commonWell.getPersonById(queryMeta, chosenPersonId);

    // get the linked person
    const cwPatient = await commonWell.getPatient(queryMeta, cwPatientId);
    const cwPatientUri = cwPatient._links?.self?.href;
    if (!cwPatientUri) throw new Error(`Missing patient URI for patient ${cwPatientId}`);
    const currentLinkedPersonId = cwPatient._links?.person?.href
      ? getPersonIdFromUrl(cwPatient._links.person?.href)
      : undefined;

    // if not the same, unlink/unenroll the currently linked person
    if (currentLinkedPersonId && currentLinkedPersonId !== chosenPersonId) {
      log(`unlinking/unenrolling current person ${currentLinkedPersonId}...`);
      await commonWell.resetPatientLink(queryMeta, currentLinkedPersonId, cwPatientId);
      const currentLinkedPerson = await commonWell.getPersonById(queryMeta, currentLinkedPersonId);
      if (isEnrolledBy(orgName, currentLinkedPerson)) {
        await commonWell.unenrollPerson(queryMeta, currentLinkedPersonId);
        await commonWell.deletePerson(queryMeta, currentLinkedPersonId);
      }
    }

    // link the chosen person to the patient...
    await commonWell.addPatientLink(queryMeta, chosenPersonId, cwPatientUri);
    // ...and upgrade the network links w/ that person's patients
    await autoUpgradeNetworkLinks(
      commonWell,
      queryMeta,
      cwPatientId,
      chosenPersonId,
      context,
      orgIdExcludeList
    );

    // update Metriport's DB
    await updatePatientAndPersonIds({
      patient,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: chosenPersonId,
    });
    await updatePatientDiscoveryStatus({ patient, status: "completed" });

    if (unenrollByDemographics) {
      log(`unenrolling by demographics...`);
      const respSearch = await commonWell.searchPersonByPatientDemo(queryMeta, cwPatientId);
      const persons = respSearch._embedded?.person
        ? respSearch._embedded.person.flatMap(p => (p && getPersonId(p) ? p : []))
        : [];
      for (const person of persons) {
        const personId = getPersonId(person);
        if (!personId) continue;
        if (personId === chosenPersonId) continue; // don't unenroll the chosen person!
        if (isEnrolledBy(orgName, person)) {
          await commonWell.unenrollPerson(queryMeta, personId);
        }
      }
    }
  } catch (error) {
    const msg = `Error on patchDuplicatedPersonsForPatient`;
    log(`${msg}. Error: ${error}`);
    capture.error(msg, {
      extra: {
        patientId: patient.id,
        cxId: patient.cxId,
        cwReference: commonWell.lastReferenceHeader,
        error,
      },
    });
    throw error;
  }
}
