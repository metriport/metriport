/**
	Generates SOAP message with MCCI_IN000002UV01 NACK payload

	@param {Object} payload - incoming PRPA_IN201305UV02 message
	@return {Object} return SOAP message
*/
function getMCCI_SOAP(payload) {
	const senderOID = Config.getHomeCommunityId();
	const uuid = UUIDGenerator.getUUID();

	const soap = <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing">
				  <soap:Header>
				    <wsa:To soap:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
				    <wsa:Action soap:mustUnderstand="true">urn:hl7-org:v3:MCCI_IN000002UV01</wsa:Action>
				    <wsa:MessageID soap:mustUnderstand="true">{'urn:uuid:' + uuid}</wsa:MessageID>
				    <wsa:RelatesTo soap:mustUnderstand="true"></wsa:RelatesTo>
				  </soap:Header>
				  <soap:Body>
				    <MCCI_IN000002UV01 xmlns="urn:hl7-org:v3" ITSVersion="XML_1.0">
				      <id root={uuid.toString()}/>
				      <creationTime value={DateUtil.getCurrentDate("yyyyMMddhhmmss")}/>
				      <interactionId root="2.16.840.1.113883.1.6" extension="MCCI_IN000002UV01"/>
				      <processingCode code="P"/>
				      <processingModeCode code="R"/>
				      <acceptAckCode code="NE"/>
				      <receiver typeCode="RCV">
				        <device classCode="DEV" determinerCode="INSTANCE">
				          <id root={payload.*::sender.*::device.*::id.@root.toString()}/>
				        </device>
				      </receiver>
				      <sender typeCode="SND">
				        <device classCode="DEV" determinerCode="INSTANCE">
				          <id root={senderOID}/>
				        </device>
				      </sender>
				      <acknowledgement>
				        <typeCode code="AE"/>
				        <targetMessage>
				          <id root=""/>
				        </targetMessage>
				        <acknowledgementDetail typeCode="E">
				          <code code="NS250" displayName="Unsupported processing mode"/>
				          <text>The value of processingModeCode shall be set to T</text>
				        </acknowledgementDetail>
				      </acknowledgement>
				    </MCCI_IN000002UV01>
				  </soap:Body>
				</soap:Envelope>;

	return soap;
}