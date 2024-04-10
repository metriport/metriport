import fs from "fs";
import path from "path";
import { processDQResponse } from "../dq/process-dq-response";
// import {
//   outboundDocumentQueryRespSuccessfulSchema,
//   outboundDocumentQueryRespFaultSchema,
// } from "@metriport/ihe-gateway-sdk";
import { outboundDQRequest } from "./constants";

describe("processDQResponse", () => {
  it("should process the successful DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "dq_multiple_docs.xml"), "utf8");
    const response = processDQResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDQRequest,
      gateway: outboundDQRequest.gateway,
    });
    if (!response.documentReference) {
      throw new Error("No DocumentReferences found");
    }
    expect(response.documentReference[0]?.docUniqueId).toEqual(
      "ODFmMmVjNGUtYzcxYy00MDkwLWJmMWMtOWQ4NTI5ZjY1YjVhLzAxOGU4MWQ3LTBlOWYtNzllYy1hYTllLTFkYjg3MDk5ZDBjMS91cGxvYWRzLzgxZjJlYzRlLWM3MWMtNDA5MC1iZjFjLTlkODUyOWY2NWI1YV8wMThlODFkNy0wZTlmLTc5ZWMtYWE5ZS0xZGI4NzA5OWQwYzFfMDE4ZTgxZGQtNDFjMC03NGQ1LWI1ZWUtMzI1NzQ0MzNjY2JlLnBkZg=="
    );
    expect(response.documentReference[1]?.docUniqueId).toEqual(
      "ODFmMmVjNGUtYzcxYy00MDkwLWJmMWMtOWQ4NTI5ZjY1YjVhLzAxOGU4MWQ3LTBlOWYtNzllYy1hYTllLTFkYjg3MDk5ZDBjMS91cGxvYWRzLzgxZjJlYzRlLWM3MWMtNDA5MC1iZjFjLTlkODUyOWY2NWI1YV8wMThlODFkNy0wZTlmLTc5ZWMtYWE5ZS0xZGI4NzA5OWQwYzFfMDE4ZThiMGQtMTNjMy03YmVjLWJlYzYtZjEyMTJjMzA2MTRkLnBkZg=="
    );
  });
  it("should process the empty DQ response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "dq_empty.xml"), "utf8");
    const response = processDQResponse({
      xmlStringOrError: xmlString,
      outboundRequest: outboundDQRequest,
      gateway: outboundDQRequest.gateway,
    });
    console.log(response);
  });
});
