import { createHivePartitionFilePath } from "../filename";

const cxId = "cdb678ab-07e3-42c5-93f5-827839j938473";
const patientId = "0190c5c0-c5cd-7e8e-b625-989282h8ski82";
const keys = {
  key1: "value1",
  key2: "value2",
};
const upperCaseKeys = {
  KEY1: "value1",
  KEY2: "value2",
};
const date = new Date(Date.parse("2019-01-01T12:15:30.000Z"));

describe("hive partition path", () => {
  it(`full`, async () => {
    const targetPath = `date=2019-01-01/hour=12/minute=15/second=30/cxid=${cxId}/patientid=${patientId}/key1=value1/key2=value2`;
    const result = createHivePartitionFilePath({
      cxId,
      patientId,
      keys,
      date,
    });
    expect(result).toBe(targetPath);
  });
  it(`full-uppercase`, async () => {
    const targetPath = `date=2019-01-01/hour=12/minute=15/second=30/cxid=${cxId}/patientid=${patientId}/key1=value1/key2=value2`;
    const result = createHivePartitionFilePath({
      cxId,
      patientId,
      keys: upperCaseKeys,
      date,
    });
    expect(result).toBe(targetPath);
  });
  it(`no date`, async () => {
    const targetPath = `cxid=${cxId}/patientid=${patientId}/key1=value1/key2=value2`;
    const result = createHivePartitionFilePath({
      cxId,
      patientId,
      keys,
    });
    expect(result).toBe(targetPath);
  });
  it(`no keys`, async () => {
    const targetPath = `date=2019-01-01/hour=12/minute=15/second=30/cxid=${cxId}/patientid=${patientId}`;
    const result = createHivePartitionFilePath({
      cxId,
      patientId,
      date,
    });
    expect(result).toBe(targetPath);
  });
  it(`no date no keys`, async () => {
    const targetPath = `cxid=${cxId}/patientid=${patientId}`;
    const result = createHivePartitionFilePath({
      cxId,
      patientId,
    });
    expect(result).toBe(targetPath);
  });
});
