import { CommonwellError } from "@metriport/commonwell-sdk";
import * as stream from "stream";
import MetriportError from "../../../errors/metriport-error";
import NotFoundError from "../../../errors/not-found";
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
  const orgOID = organization.oid;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgOID));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  try {
    await commonWell.retrieveDocument(queryMeta, location, stream);
  } catch (err) {
    const additionalInfo = {
      cwReferenceHeader: commonWell.lastReferenceHeader,
      documentLocation: location,
    };
    if (err instanceof CommonwellError && err.cause?.response?.status === 404) {
      throw new NotFoundError("CW - Document not found", err, additionalInfo);
    }
    throw new MetriportError(`CW - Error downloading document`, err, additionalInfo);
  }
}
