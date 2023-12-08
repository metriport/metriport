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
                    <given>{firstName}</given>
                    <family>{lastName}</family>
                    <delimiter>,</delimiter>
                  </name>
                  <telecom use="HP" value="tel:{phone}"/>
                  <administrativeGenderCode code="{genderAtBirth}"/>
                  <birthTime value="{dob}"/>
                  <addr>
                    <streetAddressLine>{addressLine1}</streetAddressLine>
                    <city>{city}</city>
                    <state>{state}</state>
                    <postalCode>{zip}</postalCode>
                    <country>{country}</country>
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
              <value code="{genderAtBirth}" codeSystem="2.16.840.1.113883.5.1"/>
              <semanticsText>LivingSubject.administrativeGender</semanticsText>
            </livingSubjectAdministrativeGender>
            <livingSubjectBirthTime>
              <value value="{dob}"/>
              <semanticsText>LivingSubject.birthTime</semanticsText>
            </livingSubjectBirthTime>
            <livingSubjectId>
              <value extension="{livingSubjectId.extension}" root="{livingSubjectId.root}"/>
              <semanticsText>LivingSubject.id</semanticsText>
            </livingSubjectId>
            <livingSubjectName>
              <value>
                <given>{firstName}</given>
                <family>{lastName}</family>
              </value>
              <semanticsText>LivingSubject.name</semanticsText>
            </livingSubjectName>
            <patientAddress>
              <value>
                <streetAddressLine>{addressLine1}</streetAddressLine>
                <city>{city}</city>
                <state>{state}</state>
                <postalCode>{zip}</postalCode>
                <country>{country}</country>
              </value>
              <semanticsText>Patient.addr</semanticsText>
            </patientAddress>
            <patientTelecom>
              <value value="tel:{phone}"/>
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

/**
 * Removed since wasn't in Particle but was in epic so not necessary: 
 * 
 *         <authorOrPerformer typeCode="AUT">
          <assignedDevice classCode="ASSIGNED">
            <id root="1.2.840.114350.1.13.11511.3.7.3.688884.100.1000"/>
          </assignedDevice>
        </authorOrPerformer>
 * 
 * 
 * 
 * 
 * */
