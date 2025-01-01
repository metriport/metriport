import { removeEmptyFields } from "../cda-templates/clinical-document/clinical-document";

describe("removeEmptyFields", () => {
  it("removes fields with undefined or empty string values", () => {
    const input = {
      code: "123",
      codeSystem: undefined,
      codeSystemName: "",
      displayName: "Text representing the code",
    };
    const expected = { code: "123", displayName: "Text representing the code" };
    expect(removeEmptyFields(input)).toEqual(expected);
  });

  it("recursively removes empty fields in nested objects", () => {
    const input = {
      id: {
        root: "abcd",
      },
      section: {
        code: "123",
        codeSystem: "",
        codeSystemName: "LOINC",
        displayName: undefined,
      },
    };
    const expected = {
      id: {
        root: "abcd",
      },
      section: {
        code: "123",
        codeSystemName: "LOINC",
      },
    };
    expect(removeEmptyFields(input)).toEqual(expected);
  });

  it("handles objects without any empty fields", () => {
    const input = { code: "123", codeSystemName: "LOINC" };
    const expected = { code: "123", codeSystemName: "LOINC" };
    expect(removeEmptyFields(input)).toEqual(expected);
  });

  it("returns the input unchanged if it is not an object", () => {
    const input = "not an object";
    expect(removeEmptyFields(input)).toBe(input);
  });

  it("handles complex nested structures with arrays and objects", () => {
    const input = {
      id: "abcd",
      observation: [
        {
          templateId: {
            root: "2.16.840.1.113883.10.20.22.4.19",
            extension: "",
          },
        },
        {
          templateId: {
            root: "",
            extension: undefined,
          },
        },
      ],
    };
    const expected = {
      id: "abcd",
      observation: [
        {
          templateId: {
            root: "2.16.840.1.113883.10.20.22.4.19",
          },
        },
      ],
    };
    expect(removeEmptyFields(input)).toEqual(expected);
  });
});
