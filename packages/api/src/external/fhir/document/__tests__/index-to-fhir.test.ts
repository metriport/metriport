import { makeDocument } from "@metriport/commonwell-sdk/models/__tests__/document";
import { v4 as uuidv4 } from "uuid";
import { makePatient } from "../../../../models/medical/__tests__/patient";
import { CWDocumentWithMetriportData } from "../../../commonwell/document/shared";
import { toFHIR } from "../index";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("toFHIR", () => {
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
      },
      content: {
        ...cwDoc.content,
        format: expectedFormat,
      },
    };
    const patient = makePatient();
    const res = toFHIR(uuidv4(), doc, patient);
    expect(res).toBeTruthy();
    expect(res.content).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const content of res.content!) {
      expect(content.format).toEqual({ code: expectedFormat });
    }
  });
});
