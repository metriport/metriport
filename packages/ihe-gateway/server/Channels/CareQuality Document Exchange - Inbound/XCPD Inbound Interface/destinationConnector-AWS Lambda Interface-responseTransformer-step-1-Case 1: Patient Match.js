logger.info("destinationConnector-AWS Lambda Interface-responseTransformer-step-1-Case 1: Patient Match.js");
// Only a single entry per assigning authority is allowed
if (msg.patientMatch) {
	const senderOID = Config.getHomeCommunityId();

	// The Responding Gateway finds exactly one patient record matching the criteria sent in the query parameters.
	var prpa = getXCPDQueryResponse(msg, payload);
	if (prpa) try {

		var authorOrPerformer = <authorOrPerformer typeCode="AUT">
					          <assignedDevice classCode="ASSIGNED">
					            <id root={senderOID}/>
					          </assignedDevice>
					        </authorOrPerformer>;
		prpa.controlActProcess.authorOrPerformer = authorOrPerformer;

		var subject = getXCPDResponseSubject(msg);
		prpa.controlActProcess.subject = subject;

		// AA (application accept) is returned in Transmission wrapper
		prpa.acknowledgement.typeCode.@code = 'AA';
		
		// OK (data found, no errors) is returned in Control Act wrapper
		prpa.controlActProcess.queryAck.queryResponseCode.@code = 'AA';

		delete prpa.controlActProcess.reasonOf;

		soapTemplate.*::Body.appendChild(prpa);

		// Define the namespace for the payload
		var _response = String(soapTemplate).replace('<PRPA_IN201306UV02 ITSVersion="XML_1.0">', '<PRPA_IN201306UV02 xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ITSVersion="XML_1.0">');
		responseMap.put('RESPONSE', _response.toString());
	
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Processor: Patient Match - ' + ex);
		throw ex;
	}

	return;
}