/**
	Generates 
	This query parameter is the identifier of a health care provider who has explicitly accepted responsibility for some aspect of a patient's care.
	This identifies a health care provider role.

	@param {String} id - provider's NPI number
	@return {Object} return XML object representing PrincipalCareProviderId query entry
*/
function getPrincipalCareProviderId(id) {

	// NOTE: Only provider's NPI numbers are expected

	var xml = null;

	try {
		// 2.16.840.1.113883.4.6 is US NPI OID
		xml = <urn:principalCareProviderId xmlns:urn="urn:hl7-org:v3">
		          <urn:value root="2.16.840.1.113883.4.6" extension={id.toString()}/>
		        </urn:principalCareProviderId>;
		            
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getPrincipalCareProviderId() - ' + ex);
	}
	

	return xml;

}