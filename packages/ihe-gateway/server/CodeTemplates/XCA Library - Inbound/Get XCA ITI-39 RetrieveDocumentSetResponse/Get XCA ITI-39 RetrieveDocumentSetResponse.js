/**
	Generate XCA ITI-39 RetrieveDocumentSetResponse payload

	@param {Object} request - original XCA ITI-39 RetrieveDocumentSetRequest payload
	@param {Object} operationOutcome - FHIR OperationOutcome resource instance with possible errors or warnings
	@param {Boolean} mtom - MTOM response requested
	@return {Object} return XCA ITI-39 response payload
*/
function getXCAITI39QueryResponse(request, operationOutcome, mtom) {

	var _response = <ihe:RetrieveDocumentSetResponse xmlns:ihe="urn:ihe:iti:xds-b:2007">
					<RegistryResponse xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success"/>
				</ihe:RetrieveDocumentSetResponse>;

	// Process response entries from 'request'
	if (request && request.hasOwnProperty('documentReference')) {
		request.documentReference.forEach(function(entry) {
			try {
				// Retrieve document from the S3 bucket
				var doc64 = xcaReadFromFile(entry.url.toString());
				if (doc64) {
					// Pass documents through attachments
					// Set base64Encode to 'false' for SOAP, and 'true' for MTOM
					var attachment = addAttachment(doc64, entry.contentType.toString(), mtom);
					var attachmentId = String(attachment.getAttachmentId()).split(':');
					var attToken = attachmentId[0] + ':' + globalChannelMap.get('XCA39INBOUNDPROCESSOR') + ':' + channelMap.get('XCAMESSAGEID') + ':' + attachmentId[1];

					var docResponse = <ihe:DocumentResponse xmlns:ihe="urn:ihe:iti:xds-b:2007">
								        <ihe:HomeCommunityId>{'urn:oid:' + entry.homeCommunityId.toString()}</ihe:HomeCommunityId>
								        <ihe:RepositoryUniqueId>{entry.repositoryUniqueId.toString()}</ihe:RepositoryUniqueId>
								        <ihe:DocumentUniqueId>{entry.documentUniqueId.toString()}</ihe:DocumentUniqueId>
								        <ihe:mimeType>{entry.contentType.toString()}</ihe:mimeType>
								        <ihe:Document>{attToken.toString()}</ihe:Document>
								      </ihe:DocumentResponse>;
					_response.*::RegistryResponse.appendChild(docResponse);
				}
			} catch(ex) {
				if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCAITI39QueryResponse - ' + ex);
				var outcome = {"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "XDSRegistryError", "details": {"text": "" } }]};
				outcome.issue[0].details.text = 'Registry error retrieving ' + entry.documentUniqueId + ' document';
				var registryErrorList = getXCARegistryErrorList(outcome, _response);
				if (registryErrorList) _response.appendChild(registryErrorList);
			}
		});
	}

	// Query Response may contain additional errors or warnings
	if (operationOutcome) {
		var registryErrorList = getXCARegistryErrorList(operationOutcome, _response);
		if (registryErrorList) _response.appendChild(registryErrorList);
	}

	return _response;
}