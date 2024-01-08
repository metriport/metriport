export function generateITI39Template(status: string): string {
  let documentResponse = "";
  if (status === "Success") {
    documentResponse = `<DocumentResponse>
        <HomeCommunityId>urn:oid:{homeCommunityId}</HomeCommunityId>
        <RepositoryUniqueId>{homeCommunityId}</RepositoryUniqueId>
        <DocumentUniqueId>{documentId}</DocumentUniqueId>
        <mimeType>text/xml</mimeType>
        <Document>{base64}</Document>
    </DocumentResponse>`;
  }
  const iti39Template = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <s:Envelope xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:s="http://www.w3.org/2003/05/soap-envelope">
    <s:Header xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <a:Action s:mustUnderstand="1">urn:ihe:iti:2007:CrossGatewayRetrieveResponse</a:Action>
      <a:RelatesTo>{messageId}</a:RelatesTo>
      <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:b="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" s:mustUnderstand="1">
        <Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" b:Id="_1">
          <b:Created>{createdAt}</b:Created>
          <b:Expires>{expiresAt}</b:Expires>
        </Timestamp>
        <SignatureConfirmation xmlns="http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd" Value="{signature}" b:Id="_2"/>
      </Security>
    </s:Header>
    <s:Body xmlns="urn:ihe:iti:xds-b:2007" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <RetrieveDocumentSetResponse xmlns="urn:ihe:iti:xds-b:2007">
        <RegistryResponse xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:{status}"/> ${documentResponse}
      </RetrieveDocumentSetResponse>
    </s:Body>
  </s:Envelope>`;
  return iti39Template;
}

export function generateITI39TemplateMTOM(status: string): string {
  if (status != "Success") {
    return generateITI39Template(status);
  } else {
    const part1 = `----MIMEBoundary782a6cafc4cf4aab9dbf291522804454
    Content-Type: application/xop+xml; charset=UTF-8; type="application/soap+xml"
    Content-Transfer-Encoding: binary
    Content-ID: <doc0@metriport.com>
    
    `;

    const part2 = generateITI39Template(status);
    const part3 = `
    ----MIMEBoundary782a6cafc4cf4aab9dbf291522804454
    Content-Type: text/xml
    Content-Transfer-Encoding: binary
    Content-ID: <{documentId}>

    {mtomDocument}
    ----MIMEBoundary782a6cafc4cf4aab9dbf291522804454--`;
    return part1 + part2 + part3;
  }
}
