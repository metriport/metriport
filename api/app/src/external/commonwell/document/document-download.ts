import { CommonwellError } from "@metriport/commonwell-sdk";
import * as stream from "stream";
// import NotFoundError from "../../../errors/not-found";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { getPatientData } from "../patient-shared";

// const NUM_OF_RETRIES = 3;

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
        cwReference: commonWell.lastReferenceHeader,
        ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
      },
    });
  }

  // let retries = 0;
  // let done = false;

  // // COMMENT OUT RETRY LOGIC
  // while (!done && retries < NUM_OF_RETRIES) {
  //   try {
  //     await commonWell.retrieveDocument(queryMeta, location, stream);
  //     done = true;
  //   } catch (err) {
  //     // ALSO ADD SIZE = 0
  //     const has404Error = err instanceof CommonwellError && err.cause?.response?.status === 404;
  //     const lastTry = retries === NUM_OF_RETRIES - 1;

  //     if (has404Error && !lastTry) {
  //       retries = retries + 1;
  //       throw err;
  //     }

  //     capture.error(err, {
  //       extra: {
  //         context: `cw.retrieveDocument`,
  //         cwReference: commonWell.lastReferenceHeader,
  //         ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
  //       },
  //     });
  //     done = true;
  //     throw new NotFoundError("Document not found");
  //   }
  // }
}
