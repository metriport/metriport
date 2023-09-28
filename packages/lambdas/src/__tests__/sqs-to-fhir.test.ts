import { faker } from "@faker-js/faker";
import { DocumentReference, DocumentReferenceContent } from "@medplum/fhirtypes";
const originalEnv = process.env;
// Env vars specific to the lambda being tested
const additioanlEnv = {
  API_URL: faker.internet.url(),
  MAX_TIMEOUT_RETRIES: faker.number.int().toString(),
  DELAY_WHEN_RETRY_SECONDS: faker.number.int().toString(),
  QUEUE_URL: faker.internet.url(),
  DLQ_URL: faker.internet.url(),
  FHIR_SERVER_URL: faker.internet.url(),
  SEARCH_QUEUE_URL: faker.internet.url(),
  SEARCH_INDEX_NAME: faker.lorem.word(),
};
process.env = {
  ...originalEnv,
  ...additioanlEnv,
};
// Keep those ^ before imports
import { makeBundle } from "@metriport/core/external/fhir/__tests__/bundle";
import { makeDocumentReference } from "@metriport/core/external/fhir/__tests__/document-reference";
import { OpenSearchFileIngestorSQS } from "@metriport/core/external/opensearch/file-ingestor-sqs";
import { stringToBase64 } from "@metriport/core/util/base64";
import { ingestBase64Attachments } from "../sqs-to-fhir";

let openSearchFileIngestorSQS_storeAndIngest: jest.SpyInstance;

beforeAll(() => {
  jest.restoreAllMocks();
  openSearchFileIngestorSQS_storeAndIngest = jest
    .spyOn(OpenSearchFileIngestorSQS.prototype, "storeAndIngest")
    .mockImplementation(() => Promise.resolve());
});

afterAll(() => {
  process.env = originalEnv;
});

let cxId: string;
let patientId: string;
let s3BucketName: string;
let s3FileName: string;
let docRef: DocumentReference;

beforeEach(() => {
  cxId = faker.string.uuid();
  patientId = faker.string.uuid();
  s3BucketName = faker.lorem.word();
  s3FileName = faker.lorem.word();
  docRef = makeDocumentReference();
  jest.clearAllMocks();
});

// TO BE RUN LOCALLY NOT IN CI/CD
describe("ingestBase64Attachments", () => {
  it("ingests a single attachment", async () => {
    const attachment: DocumentReferenceContent = {
      attachment: {
        contentType: "application/pdf",
        data: stringToBase64(attachmentContent1),
      },
    };
    docRef.content = [attachment];
    const fhirDoc = makeBundle({ entries: [docRef] });

    await ingestBase64Attachments({
      cxId,
      patientId,
      fhirDoc,
      s3BucketName,
      s3FileName,
    });

    expect(openSearchFileIngestorSQS_storeAndIngest).toHaveBeenCalledTimes(1);
    expect(openSearchFileIngestorSQS_storeAndIngest).toHaveBeenCalledWith({
      cxId,
      patientId,
      entryId: docRef.id,
      content: [attachmentContent1],
      s3BucketName,
      s3FileName,
    });
  });

  it("ingests multiple attachments", async () => {
    const attachment1: DocumentReferenceContent = {
      attachment: {
        contentType: "application/pdf",
        data: stringToBase64(attachmentContent1),
      },
    };
    docRef.content = [attachment1];
    const attachment2: DocumentReferenceContent = {
      attachment: {
        contentType: "application/pdf",
        data: "SFBJIE5vdGVzOiA1OC15ZWFyLW9sZCBmZW1hbGUgcHJlc2VudHMgZm9yIGZvbGxvd3VwIGFmdGVyIGJpbGF0ZXJhbCBjZXJ1bWVuIGltcGFjdGlvbnMuIFNoZSBkaWQgdXNlIHRoZSBvaWwgYW5kIGxhc3QgdXNlZCBpdCBhYm91dCBhIHdlZWsgYWdvLiAvbXM=",
      },
    };
    docRef.content = [attachment1, attachment2];
    const fhirDoc = makeBundle({ entries: [docRef] });

    await ingestBase64Attachments({
      cxId,
      patientId,
      fhirDoc,
      s3BucketName,
      s3FileName,
    });

    expect(openSearchFileIngestorSQS_storeAndIngest).toHaveBeenCalledTimes(1);
    expect(openSearchFileIngestorSQS_storeAndIngest).toHaveBeenCalledWith({
      cxId,
      patientId,
      entryId: docRef.id,
      content: expect.arrayContaining([attachmentContent1, attachmentContent2]),
      s3BucketName,
      s3FileName,
    });
  });
});

const attachmentContent1 =
  "" +
  `<div id="id_6c12a84864b64442909904462fdb09d5__" class="template_id_2_16_840_1_113883_10_20_22_2_8"><div><h3 class="divider"><span style="font-weight:bold;"><a name="ID0E6AAC">Assessment</a></span></h3></div><div class="data-table"><table><thead><tr><th>Encounter Date</th><th>Assessment Date</th><th>Assessment</th></tr></thead><tbody><tr><td style="border-bottom-width: 5px; border-bottom-style: solid;">07/28/2023</td><td style="border-bottom-width: 5px; border-bottom-style: solid;">07/28/2023</td><td style="border-bottom-width: 5px; border-bottom-style: solid;">
    Bilateral ear exam does show minimal cerumen on the right and minimal in left mastoid,. Cerumen was removed from the mastoid cavity.  
    <br />
    Audiogram was then done and shows a mixed conductive hearing loss in the left ear which would be expected with her surgical history. SRTs are 40 dB on the right and 50 dB on the left. Word recognition scores are 82% on the right and 76% on the left.  
    <br />
    The patient is a hearing aid candidate. Will give her medical clearance and she can follow up as needed. /ms
</td></tr></tbody></table></div></div>`;

const attachmentContent2 = `HPI Notes: 58-year-old female presents for followup after bilateral cerumen impactions. She did use the oil and last used it about a week ago. /ms`;
