import { faker } from "@faker-js/faker";
import { DocumentContent } from "@metriport/commonwell-sdk-v1";
import {
  makeDocument,
  makeDocumentContent,
} from "@metriport/commonwell-sdk-v1/models/__tests__/document";
import { makePatient } from "@metriport/core/domain/__tests__/patient";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { CWDocumentWithMetriportData } from "../../../commonwell-v1/document/shared";
import { makePeriod } from "../../shared/__tests__/date";
import { cwToFHIR, getBestDateFromCWDocRef } from "../index";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("cwToFHIR", () => {
  it("returns format on attachment", async () => {
    const cwDoc = makeDocument();
    const expectedFormat = `format/${uuidv4()}`;
    const doc: CWDocumentWithMetriportData = {
      ...cwDoc,
      originalId: uuidv4(),
      metriport: {
        fileName: "test.pdf",
        location: "https://test.com",
        fileSize: 100,
        fileContentType: "application/pdf",
      },
      content: {
        ...cwDoc.content,
        format: expectedFormat,
      },
    };
    const patient = makePatient();
    const res = cwToFHIR(uuidv4(), doc, patient);
    expect(res).toBeTruthy();
    expect(res.content).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const content of res.content!) {
      expect(content.format).toEqual({ code: expectedFormat });
    }
  });
});

describe("getBestDateFromCWDocRef", () => {
  it("returns indexed when indexed is not today", async () => {
    const indexed = dayjs(faker.date.past()).toISOString();
    const period = makePeriod();
    const content: DocumentContent = makeDocumentContent({
      indexed,
      context: { period },
    });
    const res = getBestDateFromCWDocRef(content);
    expect(res).toEqual(indexed);
  });

  it("returns start when present and indexed is today", async () => {
    const indexed = dayjs().toISOString();
    const period = makePeriod();
    const content: DocumentContent = makeDocumentContent({
      indexed,
      context: { period },
    });
    const res = getBestDateFromCWDocRef(content);
    expect(res).toEqual(period.start);
  });

  it("returns end when start not present and indexed is today", async () => {
    const indexed = dayjs().toISOString();
    const period = makePeriod();
    const content: DocumentContent = makeDocumentContent({
      indexed,
      context: { period: { end: period.end } },
    });
    const res = getBestDateFromCWDocRef(content);
    expect(res).toEqual(period.end);
  });

  it("returns indexed when no start or end and indexed is today", async () => {
    const indexed = dayjs().toISOString();
    const content: DocumentContent = makeDocumentContent({
      indexed,
      context: { period: undefined },
    });
    const res = getBestDateFromCWDocRef(content);
    expect(res).toEqual(indexed);
  });
});
