/**
	Converts HL7v3 'administrativeGenderCode' to FHIR AdministrativeGender code value

	@param {Object} entry - represents administrativeGenderCode element
	@return {String} return AdministrativeGender code value
*/
function getFHIRAdministrativeGender(entry) {
	if (entry.@code.toString().startsWith('M')) return 'male';
	else if (entry.@code.toString().startsWith('F')) return 'female'
	else return 'unknown';
}