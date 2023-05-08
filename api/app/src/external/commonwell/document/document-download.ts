import { CommonwellError } from "@metriport/commonwell-sdk";
import * as stream from "stream";
import NotFoundError from "../../../errors/not-found";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { getPatientData } from "../patient-shared";

export async function downloadDocument({
  cxId,
  patientId,
  facilityId,
  location,
  stream,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  location: string;
  stream: stream.Writable;
}): Promise<void> {
  const { organization, facility } = await getPatientData({ id: patientId, cxId }, facilityId);
  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  try {
    await commonWell.retrieveDocument(queryMeta, location, stream);
  } catch (err) {
    capture.error(err, {
      extra: {
        context: `cw.retrieveDocument`,
        patientId,
        documentLocation: location,
        cwReference: commonWell.lastReferenceHeader,
        err,
      },
    });
    if (err instanceof CommonwellError && err.cause?.response?.status === 404) {
      throw new NotFoundError("Document not found", err);
    }
    throw err;
  }
}
