logger.info("sourcConnector-transformer-step-5-Get query parameters.js");
var request = {};
try {
	
	var prpa = msg.*::Body.*::PRPA_IN201305UV02;

	// Remove namespaces
	var regex = new RegExp(prpa.namespace().prefix + ':', "g");
	prpa = String(prpa).replace(/xmlns(?:.*?)?=\".*?\"/g, '');
	prpa = prpa.replace(regex, '');

	payload = new XML(prpa.toString());
	channelMap.put('PRPA_IN201305UV02', payload);
	
	request.id = payload.*::controlActProcess.*::queryByParameter.*::queryId.@extension.toString();
	request.cxId = payload.*::sender.*::device.*::id.@root.toString();
	try {
		request.timestamp = DateUtil.convertDate('yyyyMMddhhmmss', "yyyy-MM-dd'T'hh:mm:ss", payload.*::creationTime.@value.toString());
	} catch(ex) {
		request.timestamp = DateUtil.getCurrentDate("yyyy-MM-dd'T'hh:mm:ss");
	}
	request.samlAttributes = saml;

	// (OPTIONAL) The list of patient's primary providers
	request.principalCareProviderIds = [];
	for each (var entry in payload.*::controlActProcess.*::queryByParameter.*::parameterList.*::principalCareProviderId) {
		var provider = {"id":"", "system":""};
		provider.id = entry.*::value.@extension.toString();
		provider.system = entry.*::value.@root.toString();
		request.principalCareProviderIds.push(provider);
	}
	
	// Convert PRPA ParameterList to FHIR Patient resource
	var patientResource = convertXCPDQueryToPatientResource(payload.*::controlActProcess.*::queryByParameter.*::parameterList);

	if (patientResource) {
		// Convert FHIR Patient resource in XML to JSON
		var target = globalChannelMap.get('PARSER').parseResource(patientResource.toString());
		request.patientResource = JSON.parse(globalChannelMap.get('FHIRCONTEXT').newJsonParser().encodeResourceToString(target));
	}

	channelMap.put('REQUEST', JSON.stringify(request));
	var sanity = channelMap.get('REQUEST');

	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Processor: Query parameters - ' + ex);
	throw ex;
}
