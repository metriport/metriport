// Requiring only a single entry per assigning authority may force a responding community to return zero matches because no single choice is appropriate.
// It is recommended that if the responding gateway has more than one close match it should return the special error condition

if (false === msg.patientMatch) {

	// The Responding Gateway finds no patients anywhere close to matching the criteria sent in the query parameters
	var prpa = getXCPDQueryResponse(msg, payload);
	if (prpa) {

		delete prpa.controlActProcess.authorOrPerformer;
		delete prpa.controlActProcess.subject;

		// AA (application accept) is returned in Transmission wrapper
		prpa.acknowledgement.typeCode.@code = 'AA';
		
		// NF (data found, no errors) is returned in Control Act wrapper
		prpa.controlActProcess.queryAck.queryResponseCode.@code = 'NF';
		
		soapTemplate.*::Body.appendChild(prpa);
	
		// Define the namespace for the payload
		var _response = String(soapTemplate).replace('<PRPA_IN201306UV02 ITSVersion="XML_1.0">', '<PRPA_IN201306UV02 xmlns="urn:hl7-org:v3" ITSVersion="XML_1.0">');
		responseMap.put('RESPONSE', _response.toString());
	}

	return;
}