/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import { areDocumentsProcessing } from "../../../../command/medical/document/document-query";
import { E2eContext, medicalApi } from "../shared";

dayjs.extend(isBetween);
dayjs.extend(duration);

const dqCheckStatusMaxRetries = 30;
const dqCheckStatusWaitTime = dayjs.duration({ seconds: 10 });

export function runDocumentQueryTests(e2e: E2eContext) {
  it("triggers a document query", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    if (!e2e.facility) throw new Error("Missing facility");
    const docQueryProgress = await medicalApi.startDocumentQuery(e2e.patient.id, e2e.facility.id);
    expect(docQueryProgress).toBeTruthy();
    expect(areDocumentsProcessing(docQueryProgress as DocumentQueryProgress)).toBeTruthy();
  });

  it("gets successful response from document query", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    const expectedDocRefs = (e2e.contributed?.bundle.entry ?? []).flatMap(e =>
      isDocumentReference(e.resource) ? e.resource : []
    );
    let status = await medicalApi.getDocumentQueryStatus(e2e.patient.id);
    let retryLimit = 0;
    while (areDocumentsProcessing(status as DocumentQueryProgress)) {
      if (retryLimit++ > dqCheckStatusMaxRetries) {
        console.log(`Gave up waiting for Document Query`);
        break;
      }
      console.log(
        `Document query still processing, retrying in ${dqCheckStatusWaitTime.asSeconds()} seconds...`
      );
      await sleep(dqCheckStatusWaitTime.asMilliseconds());
      status = await medicalApi.getDocumentQueryStatus(e2e.patient.id);
    }
    const { documents } = await medicalApi.listDocuments(e2e.patient.id);
    expect(documents).toBeTruthy();
    expect(documents.length).toEqual(expectedDocRefs.length);
    // TODO 1634 compare documents vs. expectedDocRefs
  });
}
