import { getAddressFields, LenientAddress } from "../parse-cq-directory-entry";

const fullAddress = {
  line: [{ value: "1111 Example St" }],
  city: { value: "Austin" },
  state: { value: "TX" },
  postalCode: { value: "12345" },
};

const resultAddress: LenientAddress = {
  addressLine: "1111 Example St",
  city: "Austin",
  state: "TX",
  zip: "12345",
};

describe("getAddressFields", () => {
  test("should return an empty object when addresses array is undefined", () => {
    const result = getAddressFields(undefined);
    expect(result).toEqual({});
  });

  test("should return the address with all attributes if found", () => {
    const addresses = [
      fullAddress,
      {
        line: [{ value: "456 Elm St" }],
        city: { value: "Austin" },
        state: { value: "TX" },
        postalCode: { value: "67890" },
      },
    ];

    const result = getAddressFields(addresses);
    expect(result).toEqual(resultAddress);
  });

  test("should return the first address if all attributes are present", () => {
    const addresses = [
      fullAddress,
      {
        line: [{ value: "456 Elm St" }],
        city: { value: "Austin" },
        state: { value: "TX" },
        postalCode: { value: "67890" },
      },
    ];

    const result = getAddressFields(addresses);
    expect(result).toEqual(resultAddress);
  });

  test("should return the address with the most attributes", () => {
    const addresses = [
      { line: [{ value: "123 Main St" }], city: { value: "Austin" }, state: { value: "TX" } },
      {
        line: [{ value: "456 Elm St" }],
        city: { value: "Austin" },
        postalCode: { value: "12345" },
      },
      fullAddress,
    ];

    const result = getAddressFields(addresses);
    expect(result).toEqual(resultAddress);
  });

  test("should return the address with the most attributes if none have all attributes", () => {
    const addresses = [
      { line: [{ value: "123 Main St" }] },
      {
        line: [{ value: "456 Elm St" }],
        city: { value: "Austin" },
        postalCode: { value: "12345" },
      },
      {
        line: [{ value: "111 Sample St" }],
        city: { value: "Austin" },
      },
    ];

    const result = getAddressFields(addresses);
    expect(result).toEqual({
      addressLine: "456 Elm St",
      city: "Austin",
      zip: "12345",
    });
  });

  test("should handle empty address attributes", () => {
    const addresses = [
      {
        line: [{ value: "123 Main St" }],
        city: { value: "Austin" },
        state: { value: "TX" },
        postalCode: { value: "" },
      },
      {
        line: [],
        city: { value: "Austin" },
        state: { value: "TX" },
        postalCode: { value: "12345" },
      },
    ];

    const result = getAddressFields(addresses);
    expect(result).toEqual({
      addressLine: "123 Main St",
      city: "Austin",
      state: "TX",
    });
  });
});
