/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { isDocumentReference } from "@metriport/core/external/fhir/document/document-reference";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import { areDocumentsProcessing } from "../../../../command/medical/document/document-status";
import { E2eContext, fhirApi, fhirHeaders, medicalApi } from "../shared";

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
    expect(areDocumentsProcessing(docQueryProgress)).toBeTruthy();
  });

  it("gets successful response from document query", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    const expectedDocRefs = (e2e.consolidatedPayload?.entry ?? []).flatMap(e =>
      e.resource && isDocumentReference(e.resource) ? e.resource : []
    );
    let status = await medicalApi.getDocumentQueryStatus(e2e.patient.id);
    let retryLimit = 0;
    while (areDocumentsProcessing(status)) {
      if (retryLimit++ > dqCheckStatusMaxRetries) {
        console.log(`Gave up waiting for Document Query`);
        break;
      }
      console.log(
        `Document query still processing, retrying in ${dqCheckStatusWaitTime.asSeconds} seconds...`
      );
      await sleep(dqCheckStatusWaitTime.asMilliseconds());
      status = await medicalApi.getDocumentQueryStatus(e2e.patient.id);
    }
    const { documents } = await medicalApi.listDocuments(e2e.patient.id);
    expect(documents).toBeTruthy();
    expect(documents.length).toEqual(expectedDocRefs.length);
    // TODO 1634 compare documents vs. expectedDocRefs
  });

  it("contains expected data on FHIR server", async () => {
    // TODO 1634 implement this
    // do we need a dedicated one for MR's data or does it come from consolidated?
  });

  it("deletes a patient's consolidated data", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    const consolidated = await medicalApi.getPatientConsolidated(e2e.patient.id);
    if (consolidated && consolidated.entry) {
      for (const docEntry of consolidated.entry) {
        if (docEntry.resource && docEntry.resource.id) {
          await fhirApi.deleteResource(
            docEntry.resource.resourceType,
            docEntry.resource.id,
            fhirHeaders
          );
        }
      }
    }
    const count = await medicalApi.countPatientConsolidated(e2e.patient.id);
    expect(count.total).toEqual(0);
  });
}
