/**
	Generates FHIR OperationOutcome based on the RegistryError entries in the RegistryErrorList

	@param {Object} list - RegistryErrorList XML object
	@return {String} return description
*/
function processRegistryErrorList(list) {

	var operationOutcome = {
				"resourceType": "OperationOutcome",
				"id": "",
				"issue": []
			};
			
	operationOutcome.id = channelMap.get('MSG_ID');

	try {
		
		for each (var entry in list.*::RegistryError) {
			var issue = {
						 "severity": "",
						 "code": "",
						 "details": {"text": ""}
					};

			issue.severity = entry.@severity.toString().toLowerCase().split(':').pop();
			issue.code = entry.@errorCode.toString();
			issue.details.text = entry.@codeContext.toString();

			if (entry.@location.toString().length > 0) {
				issue.diagnostics = 'Location: ' + entry.@location.toString();
			}

			operationOutcome.issue.push(issue);
		}
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: processRegistryErrorList() - ' + ex);
	}

	return (operationOutcome.issue.length > 0) ? operationOutcome : null;
}