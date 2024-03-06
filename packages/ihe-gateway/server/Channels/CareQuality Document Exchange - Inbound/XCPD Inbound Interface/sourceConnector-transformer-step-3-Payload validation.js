// Remove namespaces
logger.info("sourceConnector-transformer-step-3-Payload validation.js");
var prpa = msg.*::Body.*::PRPA_IN201305UV02;

var regex = new RegExp(prpa.namespace().prefix + ':', "g");
prpa = String(prpa).replace(/xmlns(?:.*?)?=\".*?\"/g, '');
prpa = prpa.replace(regex, '');
prpa = '<PRPA_IN201305UV02 xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ITSVersion="XML_1.0">' + prpa.substring(prpa.indexOf('>') + 1);
var payload = new XML(prpa.toString());

// Validate HL7v3 payload with XML Schema
if (configurationMap.containsKey('HL7v3.XMLSchema')) try {

	var error = null;

	var factory = new Packages.javax.xml.validation.SchemaFactory.newInstance('http://www.w3.org/2001/XMLSchema');
	var schema = factory.newSchema( new Packages.java.io.File(configurationMap.get('HL7v3.XMLSchema')) );
	var validator = schema.newValidator();
	var reader = new java.io.StringReader(payload);
	var source = new Packages.javax.xml.transform.stream.StreamSource(reader);

	try {
		validator.validate(source);
	} catch(err) {
		error = err.message.replace('org.xml.sax.SAXParseException:','').replace(/("|')/g, '');
	}

	// Generate SOAP Fault message
	if (error) {
		var soapFault = getSOAPFault(error.toString());
		if (soapFault) {
			
			var soap = soapFault.namespace('soap');
			var wsa = soapFault.namespace('wsa');
			soapFault.soap::Header.wsa::Action = 'urn:hl7-org:v3:PRPA_IN201306UV02:CrossGatewayPatientDiscovery';
			soapFault.soap::Header.wsa::RelatesTo = msg.*::Header.*::MessageID.toString();

			responseMap.put('RESPONSE', soapFault.toString());
		}
		destinationSet.removeAll();
		return;
	}


} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Interface: XML Schema validation - ' + ex);
	throw ex;
}

// Validate that the value of processingModeCode is set to "T"
if ('T' !== payload.*::processingModeCode.@code.toString()) try {
	
	var mcci = getMCCI_SOAP(payload);
	if (mcci) {
		var soap = mcci.namespace('soap');
		var wsa = mcci.namespace('wsa');
		mcci.soap::Header.wsa::RelatesTo = msg.*::Header.*::MessageID.toString();
		responseMap.put('RESPONSE', mcci.toString());
	}
	destinationSet.removeAll();
	return;
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Interface: ProcessMode validation - ' + ex);
	throw ex;
}