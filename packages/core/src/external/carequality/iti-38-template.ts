export function generateITI38Template(status: string): string {
  let registryObjectList = "";
  if (status === "Success") {
    registryObjectList = `
    <RegistryObjectList xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
        <ExtrinsicObject home="urn:oid:{systemId}" id="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" isOpaque="false" lid="urn:uuid:bb16ef7a-8b31-4c4c-a2f9-eaa2df34b907" mimeType="text/xml" objectType="urn:uuid:34268e47-fdf5-41a6-ba33-82133c465248" status="urn:oasis:names:tc:ebxml-regrep:StatusType:Approved">
          <Slot name="languageCode">
            <ValueList>
              <Value>en-US</Value>
            </ValueList>
          </Slot>
          <Slot name="repositoryUniqueId">
            <ValueList>
              <Value>{systemId}</Value>
            </ValueList>
          </Slot>
          <Slot name="sourcePatientId">
            <ValueList>
              <Value>{patientId}^^^&amp;{systemId}&amp;ISO</Value>
            </ValueList>
          </Slot>
          <Name>
            <LocalizedString charset="UTF-8" value="Continuity of Care Document"/>
          </Name>
          <Classification classificationScheme="urn:uuid:93606bcf-9494-43ec-9b4e-a7748d1a838d" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:953e825d-3907-497c-8a95-bc3761e2a642" nodeRepresentation="" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
            <Slot name="authorPerson">
              <ValueList>
                <Value>1000^Lakeland Valley Hospital^^^^^^^&amp;1.2.840.114350.1.13.11511.3.7.2.688879&amp;ISO</Value>
              </ValueList>
            </Slot>
            <Slot name="authorInstitution">
              <ValueList>
                <Value>Lakeland Valley Hospital^^^^^^^^^{systemId}</Value>
              </ValueList>
            </Slot>
          </Classification>
          <Classification classificationScheme="urn:uuid:41a5887f-8865-4c09-adf7-e362475b143a" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:15125ee3-b29a-477d-b7c3-16f447c62866" nodeRepresentation="34133-9" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
            <Slot name="codingScheme">
              <ValueList>
                <Value>2.16.840.1.113883.6.1</Value>
              </ValueList>
            </Slot>
            <Name>
              <LocalizedString charset="UTF-8" value="Continuity of Care Document"/>
            </Name>
          </Classification>
          <Classification classificationScheme="urn:uuid:f4f85eac-e6cb-4883-b524-f2705394840f" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:9f59ae9d-13ed-4e9f-b713-9215363b805e" nodeRepresentation="N" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
            <Slot name="codingScheme">
              <ValueList>
                <Value>2.16.840.1.113883.5.25</Value>
              </ValueList>
            </Slot>
            <Name>
              <LocalizedString charset="UTF-8" value="Normal"/>
            </Name>
          </Classification>
          <Classification classificationScheme="urn:uuid:a09d5840-386c-46f2-b5ad-9c3699a4309d" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:47d0ebde-f7fe-437b-b53f-36b9d89b5549" nodeRepresentation="urn:ihe:pcc:xphr:2007" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
            <Slot name="codingScheme">
              <ValueList>
                <Value>1.3.6.1.4.1.19376.1.2.3</Value>
              </ValueList>
            </Slot>
            <Name>
              <LocalizedString charset="UTF-8" value="Continuity of Care Document"/>
            </Name>
          </Classification>
          <Classification classificationScheme="urn:uuid:f33fb8ac-18af-42cc-ae0e-ed0b0bdb91e1" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:b65ddfd6-5f8a-4294-95f2-fc58c92ad5c9" nodeRepresentation="394777002" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
            <Slot name="codingScheme">
              <ValueList>
                <Value>2.16.840.1.113883.6.96</Value>
              </ValueList>
            </Slot>
            <Name>
              <LocalizedString charset="UTF-8" value="Health Encounter Site"/>
            </Name>
          </Classification>
          <Classification classificationScheme="urn:uuid:cccf5598-8b07-4b77-a05e-ae952c785ead" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:7ad00dc7-1c08-410f-ac35-40aa4bbf8509" nodeRepresentation="394802001" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
            <Slot name="codingScheme">
              <ValueList>
                <Value>2.16.840.1.113883.6.96</Value>
              </ValueList>
            </Slot>
            <Name>
              <LocalizedString charset="UTF-8" value="General Medicine"/>
            </Name>
          </Classification>
          <Classification classificationScheme="urn:uuid:f0306f51-975f-434e-a61c-c59651d33983" classifiedObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" id="urn:uuid:0cc6d4ab-f4fd-4808-a7a3-76d9d6c50fe1" nodeRepresentation="34133-9" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:Classification">
            <Slot name="codingScheme">
              <ValueList>
                <Value>2.16.840.1.113883.6.1</Value>
              </ValueList>
            </Slot>
            <Name>
              <LocalizedString charset="UTF-8" value="Continuity of Care Document"/>
            </Name>
          </Classification>
          <ExternalIdentifier id="urn:uuid:90f2a737-ab9a-4fa3-b2b9-4a8384c3f491" identificationScheme="urn:uuid:58a6f841-87b3-4a3e-92fd-a8ffeff98427" lid="urn:uuid:b77372a1-1a1e-469f-bff2-b428b144489f" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" value="{patientId}^^^&amp;{systemId}&amp;ISO">
            <Name>
              <LocalizedString charset="UTF-8" value="XDSDocumentEntry.patientId"/>
            </Name>
          </ExternalIdentifier>
          <ExternalIdentifier id="urn:uuid:02a4e55d-fb73-4c8f-b33e-a8fd5d2908c9" identificationScheme="urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab" lid="urn:uuid:e708f08e-fc05-479d-ba3a-9af0d455c082" objectType="urn:oasis:names:tc:ebxml-regrep:ObjectType:RegistryObject:ExternalIdentifier" registryObject="urn:uuid:00000000-0000-d6ba-5161-4e497785491d" value="{documentId}">
            <Name>
              <LocalizedString charset="UTF-8" value="XDSDocumentEntry.uniqueId"/>
            </Name>
          </ExternalIdentifier>
        </ExtrinsicObject>
      </RegistryObjectList>`;
  }
  const iti38Template = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <s:Envelope xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:s="http://www.w3.org/2003/05/soap-envelope">
    <s:Header xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <a:Action s:mustUnderstand="1">urn:ihe:iti:2007:CrossGatewayQueryResponse</a:Action>
      <a:RelatesTo>{messageId}</a:RelatesTo>
      <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:b="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" s:mustUnderstand="1">
        <Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" b:Id="_1">
          <b:Created>{createdAt}</b:Created>
          <b:Expires>{expiresAt}</b:Expires>
        </Timestamp>
        <SignatureConfirmation xmlns="http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd" Value="{signature}" b:Id="_2"/>
      </Security>
    </s:Header>
    <s:Body xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <AdhocQueryResponse xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0" status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:{status}"> ${registryObjectList}
      </AdhocQueryResponse>
    </s:Body>
  </s:Envelope>`;
  return iti38Template;
}
