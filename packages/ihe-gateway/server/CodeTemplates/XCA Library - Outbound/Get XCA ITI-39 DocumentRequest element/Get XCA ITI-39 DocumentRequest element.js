/**
	Generates DocumentRequest elements representing an individual document that the Document Consumer wants to retrieve from the Document Repository.

	@param {Object} entry - a set of required DocumentRequest parameters in JSON format
	@return {Object} return DocumentRequest object
*/
function getXCA39DocumentRequest(entry) {

	try {
		
		var xml = <urn:DocumentRequest xmlns:urn="urn:ihe:iti:xds-b:2007">
		            <urn:HomeCommunityId>{'urn:oid:' + entry.homeCommunityId.toString()}</urn:HomeCommunityId>
		            <urn:RepositoryUniqueId>{entry.repositoryUniqueId.toString()}</urn:RepositoryUniqueId>
		            <urn:DocumentUniqueId>{entry.docUniqueId.toString()}</urn:DocumentUniqueId>
		         </urn:DocumentRequest>;
	
		return xml;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCA39DocumentRequest() - ' + ex);
		return null;
	}
}