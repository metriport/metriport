var request = {}, payload = null;

try {

	var queryRequest = msg.*::Body.*::AdhocQueryRequest;

	// Remove namespaces
	var namespaces = msg.namespaceDeclarations();
	namespaces = namespaces.concat(queryRequest.namespaceDeclarations());

	var regexNamespaces = RegExp('xmlns="[^"]*"(?=[^<>]*>)', "g");
	queryRequest = String(queryRequest).replace(regexNamespaces, '');

	namespaces.forEach(function(entry) {
		var regex = new RegExp(entry.prefix + ':', "g");
		queryRequest = queryRequest.replace(regex, '');		
	});

	// Store payload
	payload = new XML(queryRequest.toString());
	channelMap.put('QUERYREQUEST', queryRequest.toString());

	// LeafClass or ObjectRef
	if ('ObjectRef' == payload.ResponseOption.@returnType) channelMap.put('OBJECTREF', true);

	request.id = payload.@id.toString()
	if (!request.id) {
		var msgId = msg.*::Header.*::MessageID.toString();
		msgId = msgId.replace(/^urn:uuid:/, '');
		request.id = msgId;
	}
	request.timestamp = DateUtil.getCurrentDate("yyyy-MM-dd'T'hh:mm:ss");
	request.samlAttributes = saml;

	request.gateway = {};
	request.gateway.homeCommunityId = payload.AdhocQuery.@home.toString();

	var queryRequestOptionFn = getAdhocQueryRequestOptionFn();

	// Process AdhocQuery slots
	for each (var slot in payload.AdhocQuery.descendants('Slot')) {
		// Name of the request element
		var element = slot.@name.toString().replace('$XDSDocument','');
		element = element[0].toLowerCase() + element.slice(1);


		const ENTRY_PATIENT_ID = "entryPatientId";
		const EXTERNAL_GATEWAY_PATIENT = "externalGatewayPatient";
		// Convert Slot params
		var func = queryRequestOptionFn[slot.@name.toString().slice(1)];
		if (typeof func === 'function') {
			var result = func(slot);
			// Use constants in the ternary operation
			element = element === ENTRY_PATIENT_ID ? EXTERNAL_GATEWAY_PATIENT : element;
			if (result) request[element] = result;
		}
	}

	channelMap.put('REQUEST', JSON.stringify(request));
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Inbound Interface: Query parameters - ' + ex);
	throw ex;
}