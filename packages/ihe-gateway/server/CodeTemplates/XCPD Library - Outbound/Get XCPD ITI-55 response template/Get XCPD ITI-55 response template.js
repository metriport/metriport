/**
	Generates XCPD response based on the initial request and OperationOutcome

	@param {Object} request - Initial JSON request
	@param {Object} operationOutcome - FHIR OperationOutcome resource instance
	@return {Object} return JSON response
*/
function getXCPD55ResponseTemplate(request, operationOutcome) {
	
	var result = request;
	// Dec 20: patientResourceId to patientId
	result.patientId = channelMap.get('PATIENT_ID');
	result.patientMatch = false;
	result.responseTimestamp = DateUtil.getCurrentDate("yyyy-MM-dd'T'hh:mm:ss.sssZ");
	if (operationOutcome) result.operationOutcome = operationOutcome;
	
	delete result.principalCareProviderIds;
	delete result.samlAttributes;
	delete result.patientResource;

	return result;	
}
