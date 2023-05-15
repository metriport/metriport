import { decodeExternalId, encodeExternalId } from "../external";

describe("mapi external", () => {
  describe("encode and decode external IDs", () => {
    const MAX_FHIR_ID_LENGTH = 64;

    const idsToTest = [
      // https://metriport.slack.com/archives/C04DBBJSKGB/p1684107884991659?thread_ts=1684105959.041439&cid=C04DBBJSKGB
      "2.16.840.1.113883.3.107.100.1.3.252.1.00805946.896751",
      // https://metriport.slack.com/archives/C04DBBJSKGB/p1684109280912069?thread_ts=1684105959.041439&cid=C04DBBJSKGB
      "2.16.840.1.113883.3.107^100",
      "1.2.840.114350.1.13.325.2.7.8.688883.379834396",
      // UUID v4
      "C5CD8A63-352F-4BCF-9ECA-92D7937CCFE5",
      // with non-hl7 prefix
      "-M-B61C405F-EAF8-486B-8DD2-F9F32F684F09",
    ];

    describe("encode and decode", () => {
      for (const decoded of idsToTest) {
        it(`encode/decode ID ${decoded}`, async () => {
          const encoded = encodeExternalId(decoded);
          expect(encoded).toBeTruthy();
          const res = decodeExternalId(encoded);
          expect(res).toEqual(decoded);
        });
      }
    });

    describe("encode within length limit", () => {
      for (const decoded of idsToTest) {
        it(`encode within limit ID ${decoded}`, async () => {
          const encoded = encodeExternalId(decoded);
          expect(encoded).toBeTruthy();
          expect(encoded.length).toBeLessThanOrEqual(MAX_FHIR_ID_LENGTH);
        });
      }
    });
  });
});
