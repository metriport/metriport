import { faker } from "@faker-js/faker";
import { stringToBase64 } from "../../../../util/base64";
import { XDSUnknownPatientId } from "../../error";
import { decodePatientId } from "../utils";

describe("decodePatientId", () => {
  it("parses cxId and patientId from the base64'd ID pair in the right order", () => {
    const cxId = faker.string.uuid();
    const patientId = faker.string.uuid();
    const idPair = stringToBase64(`${cxId}/${patientId}`);
    const result = decodePatientId(idPair);
    expect(result).toBeTruthy();
    expect(result.cxId).toBe(cxId);
    expect(result.patientId).toBe(patientId);
  });

  it("throws when cxId and patientId are merged but not base64'd", () => {
    const cxId = faker.string.uuid();
    const patientId = faker.string.uuid();
    const idPair = `${cxId}/${patientId}`;
    expect(() => decodePatientId(idPair)).toThrow(XDSUnknownPatientId);
  });

  it("throws when cxId is not a valid UUID", () => {
    const cxId = faker.lorem.word();
    const patientId = faker.string.uuid();
    const idPair = stringToBase64(`${cxId}/${patientId}`);
    expect(() => decodePatientId(idPair)).toThrow(XDSUnknownPatientId);
  });

  it("throws when patientId is not a valid UUID", () => {
    const cxId = faker.string.uuid();
    const patientId = faker.lorem.word();
    const idPair = stringToBase64(`${cxId}/${patientId}`);
    expect(() => decodePatientId(idPair)).toThrow(XDSUnknownPatientId);
  });

  it("throws when missing separator", () => {
    const cxId = faker.string.uuid();
    const patientId = faker.string.uuid();
    const idPair = stringToBase64(`${cxId}${patientId}`);
    expect(() => decodePatientId(idPair)).toThrow(XDSUnknownPatientId);
  });

  it("throws when missing cxId", () => {
    const patientId = faker.string.uuid();
    const idPair = stringToBase64(`/${patientId}`);
    expect(() => decodePatientId(idPair)).toThrow(XDSUnknownPatientId);
  });

  it("throws when missing patientId", () => {
    const cxId = faker.string.uuid();
    const idPair = stringToBase64(`${cxId}/`);
    expect(() => decodePatientId(idPair)).toThrow(XDSUnknownPatientId);
  });

  it("throws when cxId and patientId are empty strings", () => {
    const idPair = stringToBase64(`/`);
    expect(() => decodePatientId(idPair)).toThrow(XDSUnknownPatientId);
  });

  it("throws when input string is empty", () => {
    expect(() => decodePatientId("")).toThrow(XDSUnknownPatientId);
  });
});
