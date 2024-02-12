/**
	Generates an XCPD HL7v3 normal response from the AWS Lambda response

	@param {Object} lambda - AWS Lambda response in JSON format
	@param {Object} payload - original PRPA_IN201305UV02 request in XML format
	@return {Object} return PRPA_IN201306UV02 response in XML format
*/
function ___getXCPDMatchQueryResponse(lambda, payload) {
	const senderOID = Config.getHomeCommunityId();
	const uuid = UUIDGenerator.getUUID();

	// May be valued by the initiating application to identify the query
	var queryExt = null, queryRoot = null;
	try {
		queryExt = payload.controlActProcess.queryByParameter.queryId.@extension.toString();
		queryRoot = payload.controlActProcess.queryByParameter.queryId.@root.toString();
	} catch(ex) {
		queryExt = payload.id.@extension.toString();
		queryRoot = payload.id.@root.toString();
	}

	var xml = <PRPA_IN201306UV02 ITSVersion="XML_1.0">
			  <id root={senderOID} extension={uuid.toString()}/>
			  <creationTime value={DateUtil.getCurrentDate('yyyyMMddhhmmss')}/>
			  <interactionId root="2.16.840.1.113883.1.6" extension="PRPA_IN201306UV02"/>
			  <processingCode code="P"/>
			  <processingModeCode code="T"/>
			  <acceptAckCode code="NE"/>
			  <sender typeCode="SND">
			    <device classCode="DEV" determinerCode="INSTANCE">
			      <id root={senderOID}/>
			    </device>
			  </sender>
			  <acknowledgement>
			    <typeCode code="AA"/>
			    <targetMessage>
			      <id root={payload.id.@root.toString()} extension={payload.id.@extension.toString()}/>
			    </targetMessage>
			  </acknowledgement>
			  <controlActProcess classCode="CACT" moodCode="EVN">
			    <code code="PRPA_TE201306UV02" codeSystem="2.16.840.1.113883.1.6"/>
			    <queryAck>
			      <queryId root={queryRoot.toString()} extension={queryExt.toString()}/>
			      <queryResponseCode code="OK"/>
			    </queryAck>
			    <queryByParameter>
			      <queryId root={queryRoot.toString()} extension={queryExt.toString()}/>
			      <statusCode code="new"/>
			      <parameterList/>
			    </queryByParameter>
			  </controlActProcess>
			</PRPA_IN201306UV02>;

	// Reverse the sender tag
	var sender = payload.sender;
	sender.setLocalName('receiver');
	xml.insertChildBefore(xml.sender[0], sender);

	// Initial parameter list
	xml.controlActProcess.queryByParameter.parameterList = payload.controlActProcess.queryByParameter.parameterList;

	return xml;
}