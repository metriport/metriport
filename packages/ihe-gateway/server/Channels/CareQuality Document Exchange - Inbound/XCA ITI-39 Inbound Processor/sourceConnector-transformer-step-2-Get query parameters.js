var request = {}, payload = null;

try {

	var queryRequest = msg.*::Body.*::RetrieveDocumentSetRequest;

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

	request.id = payload.@id.toString()
	request.timestamp = DateUtil.getCurrentDate("yyyy-MM-dd'T'hh:mm:ss");
	request.samlAttributes = saml;

	request.documentReference = [];

	for each (var docRequest in payload.DocumentRequest) {
		var entry = {};
		entry.homeCommunityId = docRequest.HomeCommunityId.toString().split(':').pop();
		entry.repositoryUniqueId = docRequest.RepositoryUniqueId.toString().split(':').pop();
		entry.docUniqueId = docRequest.DocumentUniqueId.toString().split(':').pop();
		request.documentReference.push(entry);
	}

	channelMap.put('REQUEST', JSON.stringify(request));

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Inbound Processor: Query parameters - ' + ex);
}