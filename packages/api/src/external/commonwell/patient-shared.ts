import {
  CommonWellAPI,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
  StrongId,
} from "@metriport/commonwell-sdk";
import { intersectionBy } from "lodash";
import { filterTruthy } from "../../shared/filter-map-utils";
import { PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { LinkStatus } from "../patient-link";

export const cqLinkStatus = ["unlinked", "processing", "linked"] as const;
/**
 * Status of the patient's link to CareQuality.
 */
export type CQLinkStatus = (typeof cqLinkStatus)[number];

export class PatientDataCommonwell extends PatientExternalDataEntry {
  constructor(
    public patientId: string,
    public personId?: string,
    public cqLinkStatus?: CQLinkStatus,
    /**
     * The start of the patient discovery.
     */
    public pdStartedAt?: Date,
    /**
     * The facility ID used for the patient discovery.
     */
    public pdFacilityId?: string,
    /**
     * The request Id the patient discovery.
     */
    public pdRequestId?: string,
    /**
     * The status of the patient discovery.
     */
    public status?: LinkStatus,
    /**
     * The request ID for the next patient discovery while the current patient discovery was processing.
     */
    public scheduledPdRequestId?: string,
    /**
     * The request ID for the document query triggered while the patient discovery was processing.
     */
    public scheduledDocQueryRequestId?: string
  ) {
    super();
  }
}

export function getMatchingStrongIds(
  person: CommonwellPerson,
  patient: CommonwellPatient
): StrongId[] {
  const personIds = person.details?.identifier;
  const patientIds = patient.details?.identifier;
  if (!personIds || !personIds.length || !patientIds || !patientIds.length) return [];
  return intersectionBy(personIds, patientIds, id => `${id.system}|${id.key}`);
}

export async function searchPersons({
  commonWell,
  queryMeta,
  strongIds,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  strongIds: StrongId[];
}): Promise<CommonwellPerson[]> {
  const { log } = out(`CW searchPersons`);
  const respSearches = await Promise.allSettled(
    strongIds.map(id =>
      commonWell.searchPerson(queryMeta, id.key, id.system).catch(error => {
        const msg = `Failed to search for person with strongId`;
        log(`${msg}. Cause: ${error}`);
        capture.message(msg, { extra: { context: `cw.searchPersons`, error }, level: "error" });
        throw error;
      })
    )
  );
  const fulfilled = respSearches
    .flatMap(r => (r.status === "fulfilled" ? r.value._embedded?.person : []))
    .flatMap(filterTruthy);

  return fulfilled;
}
