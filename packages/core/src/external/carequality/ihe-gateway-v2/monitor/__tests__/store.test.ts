import { buildIheResponseKey } from "../store";

it("should construct the correct file path and upload the file", async () => {
  const cxId = "cxId";
  const patientId = "patientId";
  const requestId = "requestId";
  const oid = "oid";
  const timestamp = "2024-05-01T00:00:00";
  const key = buildIheResponseKey({
    type: "xcpd",
    cxId,
    patientId,
    requestId,
    oid,
    timestamp,
  });
  expect(key).toEqual(`${cxId}/${patientId}/xcpd/${requestId}_2024-05-01/${oid}.xml`);
});
