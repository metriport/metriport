/**
	Generates XCPD Cross Gateway Patient Discovery [ITI-55] request template
	
	@param {Object} receiver - an XML object with the receiver information
	@param {Object} sender - an XML object with the sender information
	@return {Object} return XCPD ITI-55 request payload
*/
function getXCPDRequest(receiver, sender) {

	// queryId - Identifier for the query. It is used to associate this query instance with both the initial response message and with later query interactions. (REQUIRED)
	// Valuing queryId avoids the need for the QueryContinuation and QueryAck classes to carry as much detail information as is carried in the initial query.

	try {
		
		var xml = <urn:PRPA_IN201305UV02 ITSVersion="XML_1.0" xmlns:urn="urn:hl7-org:v3">
					<urn:id root="" extension=""/>
					<urn:creationTime value={DateUtil.getCurrentDate('yyyyMMddHHmmss')}/>
					<urn:interactionId root="2.16.840.1.113883.1.6" extension="PRPA_IN201305UV02"/>
					<urn:processingCode code="P"/>
					<urn:processingModeCode code="T"/>
					<urn:acceptAckCode code="AL"/>
					<urn:controlActProcess classCode="CACT" moodCode="EVN">
						<urn:code code="PRPA_TE201305UV02" codeSystem="2.16.840.1.113883.1.6"/>
						<urn:queryByParameter>
							<urn:queryId root="" extension=""/>
							<urn:statusCode code="new"/>
							<urn:responseModalityCode code="R"/>
							<urn:responsePriorityCode code="I"/>
							<urn:parameterList/>
						</urn:queryByParameter>
					</urn:controlActProcess>
				</urn:PRPA_IN201305UV02>;
	
		// Sender shall be inserted first to preserve the order
		if (sender) xml.insertChildAfter(xml.*::acceptAckCode[0], sender);
		if (receiver) xml.insertChildAfter(xml.*::acceptAckCode[0], receiver);
	
		return xml;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCPDRequest() - ' + ex);
		return null;
	}
}