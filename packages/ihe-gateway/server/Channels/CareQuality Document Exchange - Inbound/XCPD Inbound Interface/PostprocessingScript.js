var dest = responseMap.get(channelMap.get('DEST_ID'));

if (dest && 'ERROR' == dest.getStatus()) try {

	var json = {
		"patientMatch": null,
		"operationOutcome": {
			"resourceType": "OperationOutcome",
			"issue": [
				{
					"severity": "error",
					"code": "processing",
					"details": {
						"coding": [{"system": "1.3.6.1.4.1.19376.1.2.27.3", "code": "InternalError", "display": "Processing gateway is unreachable"}]
					}
				}
			]
		}
	};

	var payload = channelMap.get('PRPA_IN201305UV02');

	// Generate Patient Registry Find Candidates Query Response
	var prpa = getXCPDQueryResponse(json, payload);
	if (prpa) {

		delete prpa.controlActProcess.authorOrPerformer;
		delete prpa.controlActProcess.subject;

		// Generate SOAP Envelope
		var soapTemplate = getSOAPTemplate();
		var soap = soapTemplate.namespace('soap');
		var wsa = soapTemplate.namespace('wsa');
		soapTemplate.soap::Header.wsa::Action = 'urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery';
		soapTemplate.soap::Header.wsa::RelatesTo = 'urn:uuid:' + channelMap.get('MSG_ID');
		
		soapTemplate.*::Body.appendChild(prpa);
	
		// Define the namespace for the payload
		var _response = String(soapTemplate).replace('<PRPA_IN201306UV02 ITSVersion="XML_1.0">', '<PRPA_IN201306UV02 xmlns="urn:hl7-org:v3" ITSVersion="XML_1.0">');
		responseMap.put('RESPONSE', _response.toString());
	}

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Processor: Postprocessor - ' + ex);
	throw ex;
}

return;