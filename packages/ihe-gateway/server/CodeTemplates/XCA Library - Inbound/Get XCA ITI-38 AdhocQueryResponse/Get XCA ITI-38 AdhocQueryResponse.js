/**
	Generate XCA ITI-38 AdhocQueryResponse payload

	@param {Object} request - original XCA ITI-38 AdhocQueryRequest payload
	@param {Object} operationOutcome - FHIR OperationOutcome resource instance with possible errors or warnings
	@return {Object} return XCA ITI-38 response payload
*/
function getXCAITI38QueryResponse(request, operationOutcome) {

	var _response = <query:AdhocQueryResponse xmlns:query="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0" status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success"/>;

	// Process response entries
	if (request) {
		var registryObjectList = <RegistryObjectList xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0"/>;
		_response.appendChild(registryObjectList);
		
		var docList = [];
		logger.info("getXCAITI38QueryResponse: ", request.metadata);

		request.metadata.forEach(function(entry) {
			try {
				var extrinsicObject = new XML(String(entry).replace(/\\/g,''));
				docList.push(extrinsicObject.@id.toString());
				_response.*::RegistryObjectList.appendChild(extrinsicObject);
			} catch(ex) {
				if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCAITI38QueryResponse() - ' + ex);
			}
		});

		// Process ObjectRef if requested
		if (channelMap.containsKey('OBJECTREF')) {
			var home = Config.getHomeCommunityId();
			home = String(home).startsWith('urn:oid:') ? String(home) : 'urn:oid:' + home;
			docList.forEach(id => {
				var docId = String(id).startsWith('urn:uuid') ? String(id) : 'urn:uuid:' + id;
				var objectRef = <ObjectRef home={home.toString()} id={docId.toString()}/>;
				_response.appendChild(objectRef);
			});
		}
	}


	// Query Response may contain additional errors or warnings
	if (operationOutcome) {
		var registryErrorList = getXCARegistryErrorList(operationOutcome, _response);
		if (registryErrorList) _response.appendChild(registryErrorList);
	}

	return _response;
}