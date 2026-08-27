import { Patient } from "@metriport/core/domain/patient";

export async function runOrScheduleEhexPatientDiscovery({
  patient, // eslint-disable-line @typescript-eslint/no-unused-vars
  facilityId,
  requestId,
  rerunPdOnNewDemographics,
  forcePd,
  forceEhex,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  rerunPdOnNewDemographics?: boolean;
  forcePd?: boolean;
  // START TODO #1572 - remove
  forceEhex?: boolean;
  // END TODO #1572 - remove
}): Promise<void> {
  console.log(
    `forcePd: ${forcePd}, forceEhex: ${forceEhex}, rerunPdOnNewDemographics: ${rerunPdOnNewDemographics}, requestId: ${requestId}, facilityId: ${facilityId}`
  );
  // TODO: 1588 - Implement this
  throw new Error("Not implemented");
}
