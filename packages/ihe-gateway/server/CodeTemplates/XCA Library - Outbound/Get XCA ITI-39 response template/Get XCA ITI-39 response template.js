/**
	Generates XCA ITI-39 response based on the initial request

	@param {Object} request - Initial JSON request
	@param {Object} operationOutcome - FHIR OperationOutcome with errors, warnings	
	@return {Object} return JSON response
*/
function getXCA39ResponseTemplate(request, operationOutcome) {
	
	var result = request;
	result.responseTimestamp = DateUtil.getCurrentDate("yyyy-MM-dd'T'hh:mm:ss.sssZ");
	if (operationOutcome) result.operationOutcome = operationOutcome;

	delete result.samlAttributes;
	delete result.documentReference;

	return result;	
}