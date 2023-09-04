import { CommonWellAPI, Patient as CommonwellPatient } from "@metriport/commonwell-sdk";
import { Organization as LocalOrg, Facility as LocalFacility } from "@metriport/api-sdk";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
const createContext = "cw.patient.create";

/**
 * For E2E testing locally and staging.
 */
export async function getOne(
  organization: LocalOrg,
  facility: LocalFacility,
  patientId: string
): Promise<CommonwellPatient | undefined> {
  let commonWell: CommonWellAPI | undefined;

  try {
    const orgName = organization.name;
    const orgOid = organization.oid;
    const facilityNPI = facility["npi"] as string; // TODO #414 move to strong type - remove `as string`

    commonWell = makeCommonWellAPI(orgName, oid(orgOid));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

    const cwPatient = await commonWell.getPatient(queryMeta, patientId);

    return cwPatient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const msg = `[E2E]: Failure getting Patient @ CW`;
    console.error(msg, err);
    capture.message(msg, {
      extra: {
        organizationId: organization.id,
        facilityId: facility.id,
        patientId: patientId,
        cwReference: commonWell?.lastReferenceHeader,
        context: createContext,
        err,
      },
    });
    throw err;
  }
}
