// If a responding gateway determines that additional attributes may help to achieve a match, it may respond with a specialized set of error codes,
// or special conditions that may come up when attempting to respond to a request.

// The Responding Gateway is unable to satisfy the request
var prpa = getXCPDQueryResponse(msg, payload);
if (prpa) {

	delete prpa.controlActProcess.authorOrPerformer;
	delete prpa.controlActProcess.subject;
			
	soapTemplate.*::Body.appendChild(prpa);

	// Define the namespace for the payload
	var _response = String(soapTemplate).replace('<PRPA_IN201306UV02 ITSVersion="XML_1.0">', '<PRPA_IN201306UV02 xmlns="urn:hl7-org:v3" ITSVersion="XML_1.0">');
	responseMap.put('RESPONSE', _response.toString());

	return;
}