export const xcpdTemplate = `
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<s:Envelope xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Header xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
    <a:Action s:mustUnderstand="1">urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery</a:Action>
    <a:RelatesTo>urn:uuid:{extension}</a:RelatesTo>
    <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:b="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" s:mustUnderstand="1">
      <Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" b:Id="_1">
        <b:Created>{createdAt}</b:Created>
        <b:Expires>{expiresAt}</b:Expires>
      </Timestamp>
      <SignatureConfirmation xmlns="http://docs.oasis-open.org/wss/oasis-wss-wssecurity-secext-1.1.xsd" Value="{signature}" b:Id="_2"/>
    </Security>
  </s:Header>
  
  <s:Body xmlns="urn:hl7-org:v3" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <PRPA_IN201306UV02 ITSVersion="XML_1.0">
      <id root="27f64979-6822-4f8c-b07e-f3381117a46a"/>
      <creationTime value="{creationTime}"/>
      <interactionId extension="PRPA_IN201306UV02" root="2.16.840.1.113883.1.6"/>
      <processingCode code="T"/>
      <processingModeCode code="T"/>
      <acceptAckCode code="NE"/>
      <acknowledgement>
        <typeCode code="AA"/>
        <targetMessage>
          <id extension="{extension}" root="{root}"/>
        </targetMessage>
      </acknowledgement>
      <controlActProcess classCode="CACT" moodCode="EVN">
        <code code="PRPA_TE201306UV02" displayName="2.16.840.1.113883.1.6"/>
        <authorOrPerformer typeCode="AUT">
          <assignedDevice classCode="ASSIGNED">
            <id root="1.2.840.114350.1.13.11511.3.7.3.688884.100.1000"/>
          </assignedDevice>
        </authorOrPerformer>
        <subject contextConductionInd="false" typeCode="SUBJ">
          <registrationEvent classCode="REG" moodCode="EVN">
            <id nullFlavor="NA"/>
            <statusCode code="active"/>
            <subject1 typeCode="SBJ">
              <patient classCode="PAT">
                <id extension="EV12ZGR7J6K4MF8" root="1.2.840.114350.1.13.11511.3.7.3.688884.100.1000"/>
                <statusCode code="active"/>
                <patientPerson classCode="PSN" determinerCode="INSTANCE">
                  <name>
                    <given>Nwhinone</given>
                    <family>Nwhinzzztestpatient</family>
                    <delimiter>,</delimiter>
                  </name>
                  <telecom use="HP" value="tel:+1-205-111-1111"/>
                  <administrativeGenderCode code="M"/>
                  <birthTime value="19810101"/>
                  <addr>
                    <streetAddressLine>1100 test street</streetAddressLine>
                    <city>Helena</city>
                    <state>AL</state>
                    <postalCode>35080</postalCode>
                    <country>US</country>
                  </addr>
                  <asOtherIDs classCode="PAT">
                    <id extension="EV10045900" root="1.2.840.114350.1.13.11511.3.7.3.688884.100.1000"/>
                    <scopingOrganization classCode="ORG" determinerCode="INSTANCE">
                      <id root="1.2.840.114350.1.13.11511.3.7.3.688884.100.1000"/>
                    </scopingOrganization>
                  </asOtherIDs>
                </patientPerson>
                <subjectOf1>
                  <queryMatchObservation classCode="OBS" moodCode="EVN">
                    <code code="IHE_PDQ"/>
                    <value value="100" xsi:type="INT"/>
                  </queryMatchObservation>
                </subjectOf1>
              </patient>
            </subject1>
            <custodian typeCode="CST">
              <assignedEntity classCode="ASSIGNED">
                <id root="1.2.840.114350.1.13.11511.3.7.3.688884.100.1000"/>
                <code code="NotHealthDataLocator" codeSystem="1.3.6.1.4.1.19376.1.2.27.2"/>
              </assignedEntity>
            </custodian>
          </registrationEvent>
        </subject>
        <queryAck>
          <queryId extension="{extension}" root="{root}"/>
          <statusCode code="deliveredResponse"/>
          <queryResponseCode code="OK"/>
        </queryAck>
        <queryByParameter>
          <queryId extension="{extension}" root="{root}"/>
          <statusCode code="new"/>
          <responseModalityCode code="R"/>
          <responsePriorityCode code="I"/>
          <parameterList>
            <livingSubjectAdministrativeGender>
              <value code="M" codeSystem="2.16.840.1.113883.5.1"/>
              <semanticsText>LivingSubject.administrativeGender</semanticsText>
            </livingSubjectAdministrativeGender>
            <livingSubjectBirthTime>
              <value value="19810101"/>
              <semanticsText>LivingSubject.birthTime</semanticsText>
            </livingSubjectBirthTime>
            <livingSubjectId>
              <value extension="666-10-0001" root="2.16.840.1.113883.4.1"/>
              <semanticsText>LivingSubject.id</semanticsText>
            </livingSubjectId>
            <livingSubjectName>
              <value>
                <given>NWHINONE</given>
                <family>NWHINZZZTESTPATIENT</family>
              </value>
              <semanticsText>LivingSubject.name</semanticsText>
            </livingSubjectName>
            <patientAddress>
              <value>
                <streetAddressLine>1100 Test Street</streetAddressLine>
                <city>Helena</city>
                <state>AL</state>
                <postalCode>35080</postalCode>
                <country>USA</country>
              </value>
              <semanticsText>Patient.addr</semanticsText>
            </patientAddress>
            <patientTelecom>
              <value value="tel:205-111-1111"/>
              <semanticsText>Patient.telecom</semanticsText>
            </patientTelecom>
            <principalCareProviderId>
              <value extension="1689055451" root="2.16.840.1.113883.4.6"/>
            </principalCareProviderId>
          </parameterList>
        </queryByParameter>
      </controlActProcess>
    </PRPA_IN201306UV02>
  </s:Body>
</s:Envelope>
`;
