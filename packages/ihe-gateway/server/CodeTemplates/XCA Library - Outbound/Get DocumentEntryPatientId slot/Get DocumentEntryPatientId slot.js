/**
	Generates XDSDocumentEntryPatientId slot with given identifier and assigning authority

	@param {String} identifier - patient's identifier
	@param {String} authority - patient identity assigning authority in the form of an OID
	@return {Object} return XDSDocumentEntryPatientId slot entry
*/
function getXDSDocumentEntryPatientId(identifier, authority) {

	// The Patient ID shall contain two parts:
	// * Patient Identity Assigning Authority in the form of an OID
	// * An identifier in the above Assigning Authority domain

	var xml = null;

	if (identifier && authority) {
		xml = <urn2:Slot name="$XDSDocumentEntryPatientId" slotType="rim:StringValueType" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
		          <urn2:ValueList>
		            <urn2:Value>'{identifier.toString() + '^^^&' + authority + '&ISO'}'</urn2:Value>
		          </urn2:ValueList>
		        </urn2:Slot>;
	}

	return xml;
}
