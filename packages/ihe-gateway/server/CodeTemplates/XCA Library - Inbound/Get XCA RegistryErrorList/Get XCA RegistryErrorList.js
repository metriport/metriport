/**
	Generates XCA RegistryErrorList node from FHIR OperationOutcome

	@param {Object} operationOutcome - FHIR OperationOutcome object
	@param {Object} _response - XCA response object
	@return {Object} return XCA RegistryErrorList node object
*/
function getXCARegistryErrorList(operationOutcome, _response) {

	var registryErrorList = null;

	const severityMapping = {
	  'fatal': 'urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error',
	  'error': 'urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error',
	  'warning': 'urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Warning',
	  'information': 'urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Warning'
	};	

	try {

		registryErrorList = <RegistryErrorList xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" highestSeverity=""/>;		
		var failure = operationOutcome.issue.some(item => ['fatal', 'error'].includes(item.severity));
		if (failure) {
			_response.@status = 'urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure';
			registryErrorList.@highestSeverity="urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error";
		} else {
			_response.@status = 'urn:ihe:iti:2007:ResponseStatusType:PartialSuccess';
			registryErrorList.@highestSeverity="urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Warning";
		}
		
		operationOutcome.issue.forEach(function(issue) {
			var registryError = <RegistryError xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" codeContext={issue.details.text.toString()} errorCode={issue.code.toString()} severity={severityMapping[issue.severity]}/>;
			registryErrorList.appendChild(registryError);
		});
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCARegistryErrorList() - ' + ex);
	}

	return registryErrorList;
}