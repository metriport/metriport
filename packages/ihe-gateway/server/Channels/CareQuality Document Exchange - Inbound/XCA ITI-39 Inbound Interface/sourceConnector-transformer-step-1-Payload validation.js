logger.info("sourceConnector-transformer-step-1-Payload validation.js");
var payload = null, error = null;

if (msg.*::Body.*::AdhocQueryRequest.length() > 0) {
	error = 'ITI-39 Request on ITI-39 Endpoint';

} else if (msg.*::Body.*::RetrieveDocumentSetRequest.length() > 0) {
	payload = msg.*::Body.*::RetrieveDocumentSetRequest;	
} 

if (payload) {
	channelMap.put('Request', payload);

	// Validate payload with IHE XML Schema
	if (configurationMap.containsKey('IHE.XMLSchema')) try {
	
		var factory = new Packages.javax.xml.validation.SchemaFactory.newInstance('http://www.w3.org/2001/XMLSchema');
		var schema = factory.newSchema( new Packages.java.io.File(configurationMap.get('IHE.XMLSchema')) );
		var validator = schema.newValidator();
		var reader = new java.io.StringReader(payload);
		var source = new Packages.javax.xml.transform.stream.StreamSource(reader);
	
		try {
			validator.validate(source);
		} catch(err) {
			error = err.message.replace('org.xml.sax.SAXParseException:','').replace(/("|')/g, '');
		}
	
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA Inbound Interface: XML Schema validation - ' + ex);
		throw ex;
	}	
}


// Generate SOAP Fault message
if (error) {
	var soapFault = getSOAPFault(error.toString());
	if (soapFault) {
		
		var soap = soapFault.namespace('soap');
		var wsa = soapFault.namespace('wsa');
		soapFault.soap::Header.wsa::Action = msg.*::Header.*::Action.toString() + 'Response';
		soapFault.soap::Header.wsa::RelatesTo = msg.*::Header.*::MessageID.toString();

		responseMap.put('RESPONSE', soapFault.toString());
	}
	destinationSet.removeAll();
	return;
}