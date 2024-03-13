var prpa = getXCPDQueryResponse(msg, payload);
if (prpa) {
	// logger.info("XCPD Inbound Processor - Fault: prpa found");

	delete prpa.controlActProcess.authorOrPerformer;
	delete prpa.controlActProcess.subject;
			
	soapTemplate.*::Body.appendChild(prpa);

	// Define the namespace for the payload
	var _response = String(soapTemplate).replace('<PRPA_IN201306UV02 ITSVersion="XML_1.0">', '<PRPA_IN201306UV02 xmlns="urn:hl7-org:v3" ITSVersion="XML_1.0">');
	responseMap.put('RESPONSE', _response.toString());

	return;
}