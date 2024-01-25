/**
	Generates XDSDocumentEntryClassCode slot entry

	@param {Object} array - JSON array with code-system pairs
	@return {Object} return XDSDocumentEntryClassCode slot
*/
function getXDSDocumentEntryClassCode(array) {

	// Must be part of one of the following valueSet list [1.3.6.1.4.1.12559.11.4.3.2]
	
	var xml = <urn2:Slot name="$XDSDocumentEntryClassCode" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
				<urn2:ValueList/>
			</urn2:Slot>;

	array.forEach(entry => {
		var value = <urn2:Value xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">('{entry.code.toString() + '^^' + entry.system.toString()}')</urn2:Value>;
		xml.*::ValueList.appendChild(value);
	});
	
	return xml;
}