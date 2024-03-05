var request = {}, payload = null;

try {

	var queryRequest = msg.*::Body.*::AdhocQueryRequest;

	// Remove namespaces
	var namespaces = msg.namespaceDeclarations();
	namespaces = namespaces.concat(queryRequest.namespaceDeclarations());

	queryRequest = String(queryRequest).replace(/xmlns(?:.*?)?=\".*?\"/g, '');

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

		// Convert Slot params
		var func = queryRequestOptionFn[slot.@name.toString().slice(1)];
		if (typeof func === 'function') {
			var result = func(slot);
			if (element === "entryPatientId") {
				element = "externalGatewayPatient";
				logger.info("CHANGED ELEMENT: " + element);
				logger.info('Function: ' + func);
				logger.info('Slot: ' + slot);
				logger.info('Result: ' + JSON.stringify(result));

			}
			if (result) request[element] = result;
		}
	}

	channelMap.put('REQUEST', JSON.stringify(request));
	logger.info('XCA ITI-38 Inbound Processor: Query parameters - ' + JSON.stringify(request));
	
} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-38 Inbound Processor: Query parameters - ' + ex);
	throw ex;
}