import { cqExtension } from "../../../../carequality/extension";
import { cwExtension } from "../../../../commonwell/extension";
import { DATA_SOURCE_EXTENSION_URL, createExtensionDataSource } from "../extension";
import { isCustomerDataSourceExtension, metriportDataSourceExtension } from "../metriport";

describe("isCustomerDataSourceExtension", () => {
  it("accepts the Metriport data source", () => {
    expect(isCustomerDataSourceExtension(metriportDataSourceExtension)).toBe(true);
  });

  it("accepts data pulled from the customer's EHR", () => {
    expect(isCustomerDataSourceExtension(createExtensionDataSource("CANVAS"))).toBe(true);
    expect(isCustomerDataSourceExtension(createExtensionDataSource("ATHENAHEALTH"))).toBe(true);
  });

  it("rejects data received from the HIEs", () => {
    expect(isCustomerDataSourceExtension(cwExtension)).toBe(false);
    expect(isCustomerDataSourceExtension(cqExtension)).toBe(false);
  });

  it("rejects an EHR code on an extension that is not the data source", () => {
    expect(
      isCustomerDataSourceExtension({
        url: `${DATA_SOURCE_EXTENSION_URL}-other`,
        valueCoding: { code: "CANVAS" },
      })
    ).toBe(false);
  });
});
