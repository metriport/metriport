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
                
                var doc64 = xcaReadFromFileB64(entry.urn.toString());
                
				var docResponse = <DocumentResponse>
                                    <HomeCommunityId>{'urn:oid:' + entry.homeCommunityId.toString()}</HomeCommunityId>
                                    <RepositoryUniqueId>{entry.repositoryUniqueId.toString()}</RepositoryUniqueId>
                                    <DocumentUniqueId>{entry.docUniqueId.toString()}</DocumentUniqueId>
                                    <mimeType>{entry.contentType.toString()}</mimeType>
                                    <Document>{doc64}</Document>
                                </DocumentResponse>;
				_response.appendChild(docResponse);

            } catch(ex) {
                if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCAITI39QueryResponse - ' + ex);
                var outcome = {"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "XDSRegistryError", "details": {"text": "" } }]};
                outcome.issue[0].details.text = 'Registry error retrieving ' + entry.docUniqueId + ' document';
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

/**
	Generate XCA ITI-39 RetrieveDocumentSetResponse payload

	@param {Object} request - original XCA ITI-39 RetrieveDocumentSetRequest payload
	@param {Object} operationOutcome - FHIR OperationOutcome resource instance with possible errors or warnings
	@param {Boolean} mtom - MTOM response requested
	@return {Object} return XCA ITI-39 response payload
*/
function getXCAITI39QueryResponseMTOM(request, operationOutcome) {
    var _response = <ihe:RetrieveDocumentSetResponse xmlns:ihe="urn:ihe:iti:xds-b:2007">
                <RegistryResponse xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success"/>
            </ihe:RetrieveDocumentSetResponse>;

    // Process response entries from 'request'
    if (request && request.hasOwnProperty('documentReference')) {
        request.documentReference.forEach(function(entry) {
            try {
                // Retrieve document from the S3 bucket
                
                var doc64 = xcaReadFromFileB64(entry.urn.toString());
                
				var docResponse = <DocumentResponse>
                                    <HomeCommunityId>{'urn:oid:' + entry.homeCommunityId.toString()}</HomeCommunityId>
                                    <RepositoryUniqueId>{entry.repositoryUniqueId.toString()}</RepositoryUniqueId>
                                    <DocumentUniqueId>{entry.docUniqueId.toString()}</DocumentUniqueId>
                                    <mimeType>{entry.contentType.toString()}</mimeType>
                                    <Document>
                                        <xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href={"cid:" + entry.docUniqueId.toString()}/>
                                    </Document>
                                </DocumentResponse>;
				_response.appendChild(docResponse);

            } catch(ex) {
                if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCAITI39QueryResponse - ' + ex);
                var outcome = {"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "XDSRegistryError", "details": {"text": "" } }]};
                outcome.issue[0].details.text = 'Registry error retrieving ' + entry.docUniqueId + ' document';
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