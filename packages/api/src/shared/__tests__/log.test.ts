import { faker } from "@faker-js/faker";
import { inspect } from "node:util";
import MetriportError from "../../errors/metriport-error";
import { errorToString } from "../log";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("errorToString", () => {
  it("returns error message when regular Error", async () => {
    const message = faker.lorem.sentence();
    const error = new Error(message);
    const res = errorToString(error);
    expect(res).toEqual(message);
  });

  it("returns error message when MetriportError", async () => {
    const message = faker.lorem.sentence();
    const error = new MetriportError(message);
    const res = errorToString(error);
    expect(res).toEqual(message);
  });

  it("returns error message when no cause but detailed=true", async () => {
    const message = faker.lorem.sentence();
    const error = new MetriportError(message);
    const res = errorToString(error, { detailed: true });
    expect(res).toEqual(message);
  });

  it("returns single error message when has causes but detailed=false", async () => {
    const messageParent = faker.lorem.sentence();
    const errorParent = new MetriportError(messageParent);
    const message = faker.lorem.sentence();
    const error = new MetriportError(message, errorParent);
    const res = errorToString(error, { detailed: false });
    expect(res).toEqual(message);
  });

  it("has default detailed=true when not defined", async () => {
    const messageParent = faker.lorem.sentence();
    const errorParent = new MetriportError(messageParent);
    const message = faker.lorem.sentence();
    const error = new MetriportError(message, errorParent);
    const expectedMessage = `${message}; caused by ${messageParent}`;
    const res = errorToString(error);
    expect(res).toEqual(expectedMessage);
  });

  it("returns complete error message when has causes and detailed=true", async () => {
    const messageGrandparent = faker.lorem.sentence();
    const errorGrandparent = new MetriportError(messageGrandparent);
    const messageParent = faker.lorem.sentence();
    const errorParent = new MetriportError(messageParent, errorGrandparent);
    const message = faker.lorem.sentence();
    const error = new MetriportError(message, errorParent);
    const expectedMessage = `${message}; caused by ${messageParent}; caused by ${messageGrandparent}`;
    const res = errorToString(error, { detailed: true });
    expect(res).toEqual(expectedMessage);
  });

  it("includes additionalInfo when detailed=true", async () => {
    const message = faker.lorem.sentence();
    const additionalInfo = { foo: faker.lorem.sentence(), bar: faker.number.int().toString() };
    const error = new MetriportError(message, undefined, additionalInfo);
    const expectedMessage = `${message} (${inspect(additionalInfo)})`;
    const res = errorToString(error, { detailed: true });
    expect(res).toEqual(expectedMessage);
  });

  it("includes additionalInfo from cause when detailed=true", async () => {
    const messageGrandparent = faker.lorem.sentence();
    const additionalInfoGrandParent = {
      foo: faker.lorem.sentence(),
      bar: faker.number.int().toString(),
    };
    const errorGrandparent = new MetriportError(
      messageGrandparent,
      undefined,
      additionalInfoGrandParent
    );
    const messageParent = faker.lorem.sentence();
    const errorParent = new MetriportError(messageParent, errorGrandparent);
    const message = faker.lorem.sentence();
    const additionalInfo = { foo: faker.lorem.sentence(), bar: faker.number.int().toString() };
    const error = new MetriportError(message, errorParent, additionalInfo);
    const expectedMessage = `${message} (${inspect(
      additionalInfo
    )}); caused by ${messageParent}; caused by ${messageGrandparent} (${inspect(
      additionalInfoGrandParent
    )})`;
    const res = errorToString(error, { detailed: true });
    expect(res).toEqual(expectedMessage);
  });
});
