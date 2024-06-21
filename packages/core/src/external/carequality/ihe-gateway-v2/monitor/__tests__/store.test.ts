import { buildIheResponseKey } from "../store";

it("should construct the correct file path for type 'xcpd'", async () => {
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

it("should construct the correct file path for type 'dr' with index", async () => {
  const cxId = "cxId";
  const patientId = "patientId";
  const requestId = "requestId";
  const oid = "oid";
  const timestamp = "2024-05-01T00:00:00";
  const key = buildIheResponseKey({
    type: "dr",
    cxId,
    patientId,
    requestId,
    oid,
    timestamp,
    subRequestId: "subRequestId",
  });
  expect(key).toEqual(`${cxId}/${patientId}/dr/${requestId}_2024-05-01/${oid}_subRequestId.xml`);
});
