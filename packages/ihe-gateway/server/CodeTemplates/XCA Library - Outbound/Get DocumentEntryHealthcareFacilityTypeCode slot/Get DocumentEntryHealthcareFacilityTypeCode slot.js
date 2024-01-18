/**
	Generates XDSDocumentEntryHealthcareFacilityTypeCode slot entry

	@param {Object} array - JSON array with code-system pairs
	@return {Object} return XDSDocumentEntryHealthcareFacilityTypeCode slot
*/
function getXDSDocumentEntryHealthcareFacilityTypeCode(array) {

	// Values can be taken:
	// - https://validation.sequoiaproject.org/SVSSimulator/browser/valueSet.seam?id=1.3.6.1.4.1.12559.11.4.3.5&cid=95
	// - https://gazelle.ihe.net/RetrieveValueSet?id=1.3.6.1.4.1.12559.11.4.3.5

	try {

		var xml = <urn2:Slot name="$XDSDocumentEntryHealthcareFacilityTypeCode" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
					<urn2:ValueList/>
				</urn2:Slot>;
	
		array.forEach(entry => {
			var value = <urn2:Value xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">('{entry.code.toString() + '^^' + entry.system.toString()}')</urn2:Value>;
			xml.*::ValueList.appendChild(value);
		});
	
		return xml;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXDSDocumentEntryHealthcareFacilityTypeCode() - ' + ex);
		return null;
	}
}