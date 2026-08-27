import { faker } from "@faker-js/faker";
import { cleanupAndParseXmlString } from "../xml";

function createTestString(str: string): string {
  return `
  <?xml version="1.0" encoding="UTF-8"?>
  <ExtrinsicObject>
    <id>123</id>
    <title>${str}</title>
  </ExtrinsicObject>
  `;
}

describe("xml", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("successfully parses xml from a valid string", async () => {
    const title = faker.lorem.sentence();
    const testString = createTestString(title);
    const expected = {
      ExtrinsicObject: {
        id: ["123"],
        title: [title],
      },
    };

    const result = await cleanupAndParseXmlString(testString);
    expect(result).toEqual(expected);
  });

  it("successfully parses xml from a string with invalid characters (isolated ampersand)", async () => {
    const sentence1 = faker.lorem.sentence();
    const sentence2 = faker.lorem.sentence();
    const title = `${sentence1} & ${sentence2}`;
    const testString = createTestString(title);
    const expected = {
      ExtrinsicObject: {
        id: ["123"],
        title: [`${sentence1} & ${sentence2}`],
      },
    };
    const result = await cleanupAndParseXmlString(testString);
    expect(result).toEqual(expected);
  });

  it("successfully parses xml from a string with invalid characters (multiple ampersands)", async () => {
    const sentence1 = faker.lorem.sentence();
    const sentence2 = faker.lorem.sentence();
    const title = `${sentence1} && ${sentence2}`;
    const testString = createTestString(title);
    const expected = {
      ExtrinsicObject: {
        id: ["123"],
        title: [`${sentence1} && ${sentence2}`],
      },
    };
    const result = await cleanupAndParseXmlString(testString);
    expect(result).toEqual(expected);
  });

  it("does not remove valid XML characters (escaped ampersand)", async () => {
    const sentence1 = faker.lorem.sentence();
    const sentence2 = faker.lorem.sentence();
    const title = `${sentence1} &quot;${sentence2}&quot;`;
    const testString = createTestString(title);
    const expected = {
      ExtrinsicObject: {
        id: ["123"],
        title: [`${sentence1} "${sentence2}"`],
      },
    };
    const result = await cleanupAndParseXmlString(testString);
    expect(result).toEqual(expected);
  });
});
