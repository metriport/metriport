/**
	Generates FHIR OperationOutcome template in JSON format.

	@param {String} id - logical id
	@return {Object} return OperationOutcome
*/
function getOperationOutcome(id) {

	var json = {
				"resourceType": "OperationOutcome",
				"id": "",
				"issue": []
			};
			
	json.id = id.toString();

	return json;	
}