import { outboundXcpdRequestMissingFields, TEST_CERT } from "./constants";
import { createITI5SoapEnvelope } from "../xcpd/create/iti55-envelope";

describe("createITI5SoapEnvelope", () => {
  it("should process the match XCPD response correctly", async () => {
    const response = createITI5SoapEnvelope({
      bodyData: outboundXcpdRequestMissingFields,
      publicCert: TEST_CERT,
    });
    console.log(JSON.stringify(response, null, 2));
  });
});
