import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const port = 3000;

const boundary = "a1109b32-0907-4c3c-9d61-8b8d846b9983";
const contentId = "<0.urn:uuid:2a28fe28-cd7d-44f9-88dd-0ab2a2d80073>";
const carriageReturn = "\r\n";

app.post("/mtom-response", (req, res) => {
  const pdfPath = path.join(__dirname, "test.pdf");
  fs.readFile(pdfPath, (err, pdfData) => {
    if (err) {
      res.status(500).send("Error reading PDF file");
      return;
    }

    const mtomMessageHeader = Buffer.from(
      `--${boundary}${carriageReturn}` +
        `content-type: application/xop+xml; charset=UTF-8; type="application/soap+xml"${carriageReturn}` +
        `content-transfer-encoding: binary${carriageReturn}` +
        `content-id: ${contentId}${carriageReturn}${carriageReturn}` +
        `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing"><s:Header><a:Action s:mustUnderstand="1">urn:ihe:iti:2007:CrossGatewayRetrieveResponse</a:Action><a:RelatesTo>urn:uuid:c3734e97-69ba-48e4-a102-03a5e1219fa4</a:RelatesTo><Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"> <Timestamp b:Id="_1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" xmlns:b="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"> <b:Created>2024-05-10T16:39:55.154Z</b:Created><b:Expires>2024-05-10T16:44:55.154Z</b:Expires></Timestamp><SignatureConfirmation b:Id="_2" Value="uaXu4huMhmitQFgTJc1WtKdnIUn28JYvxxE/U4ccWX9CiIqH2AoMFTHADXNxb42XHu9uKL+QuG1APj406RdNLmbi7BDpvTceyy6gEwjHRkWlGMOLH6OycSlUIlJClZeDdeyaU0ZAV6MrCnOlmWZYvv+6t6QtRtRyHoMp3D9anVaZPsFgKWgMRmzOXS1UYYwetVZMEuTBG71jpQS1xAoWKrUcHJqvU4ri0uKgBexw4bEHSSEAbxvaaf5eaxRW6cq950UORmyRWD0mEK4bpnXEjipvBDNBWIbe8Prpcgu/wkz1c3hOX1LWowcLuKijE8gZ3MhFbaaJrXOtvpxppAhgeA==" xmlns="http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd" xmlns:b="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"></SignatureConfirmation></Security></s:Header><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"> <RetrieveDocumentSetResponse xmlns="urn:ihe:iti:xds-b:2007"><RegistryResponse status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success" xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0"></RegistryResponse><DocumentResponse> <HomeCommunityId>urn:oid:2.16.840.1.113883.3.6147.3187.119953613117321.1</HomeCommunityId><RepositoryUniqueId>urn:oid:2.16.840.1.113883.3.6147.3187.119953613117321.1</RepositoryUniqueId><DocumentUniqueId>123456789</DocumentUniqueId><mimeType>application/pdf</mimeType><Document> <xop:Include href="cid:1.urn:uuid:83e0fc9b-b6b3-4c40-a4fe-de080e941f82" xmlns:xop="http://www.w3.org/2004/08/xop/include"/> </Document></DocumentResponse></RetrieveDocumentSetResponse></s:Body></s:Envelope>${carriageReturn}${carriageReturn}` +
        `--${boundary}${carriageReturn}` +
        `Content-ID: <1.urn:uuid:83e0fc9b-b6b3-4c40-a4fe-de080e941f82>${carriageReturn}` +
        `content-transfer-encoding: binary${carriageReturn}` +
        `Content-Type: application/octet-stream;${carriageReturn}${carriageReturn}`,
      "utf-8"
    );

    const mtomMessageFooter = Buffer.from(
      `${carriageReturn}--${boundary}--${carriageReturn}`,
      "utf-8"
    );

    fs.writeFileSync(path.join(__dirname, "test"), pdfData);

    const finalMessage = Buffer.concat([mtomMessageHeader, pdfData, mtomMessageFooter]);

    res.setHeader(
      "Content-Type",
      `multipart/related;boundary="${boundary}";type="application/xop+xml";start=${contentId};start-info="application/soap+xml"`
    );
    res.send(finalMessage);
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
