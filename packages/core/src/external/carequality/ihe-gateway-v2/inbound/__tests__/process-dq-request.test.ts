import { metriportOrganization } from "@metriport/shared";
import { InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { createITI38SoapEnvelope } from "../../outbound/xca/create/iti38-envelope";
import { processDqResponse } from "../../outbound/xca/process/dq-response";
import { processInboundDqRequest } from "../xca/process-dq";
import { createIti38SoapEnvelopeInboundResponse } from "../xca/create-dq-resp";
import { iti38BodyData } from "../../saml/__tests__/constants";
import { TEST_CERT, TEST_KEY, xcaGateway } from "../../saml/__tests__/constants";
import { signTimestamp } from "../../saml/security/sign";
import { createExtrinsicObjectXml } from "../../../dq/create-metadata-xml";
import { extractDocumentUniqueId } from "../../../shared";

it("should process ITI-38 request", () => {
  try {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const iti38Request = processInboundDqRequest(signedEnvelope);
    expect(iti38Request.externalGatewayPatient).toEqual(iti38BodyData.externalGatewayPatient);
  } catch (error) {
    console.log(error);
    expect(true).toBe(false);
  }
});

it("should process ITI-38 response", () => {
  const docUniqueId = "1234567890";
  const extrinsicObjectXmls = [
    createExtrinsicObjectXml({
      createdTime: new Date().toISOString(),
      organization: metriportOrganization,
      size: "1000",
      patientId: "1234567890",
      documentUniqueId: "1234567890",
      mimeType: "application/xml",
    }),
  ];
  const response: InboundDocumentQueryResp = {
    ...iti38BodyData,
    responseTimestamp: new Date().toISOString(),
    extrinsicObjectXmls,
  };

  const xmlResponse = createIti38SoapEnvelopeInboundResponse(response);
  const iti38Response = processDqResponse({
    response: {
      gateway: xcaGateway,
      outboundRequest: iti38BodyData,
      success: true,
      response: xmlResponse,
    },
  });
  if (iti38Response.documentReference && iti38Response.documentReference[0]) {
    expect(extractDocumentUniqueId(iti38Response.documentReference[0].docUniqueId)).toEqual(
      docUniqueId
    );
  } else {
    throw new Error("iti38Response.documentReference is undefined or has wrong document unique id");
  }
});
