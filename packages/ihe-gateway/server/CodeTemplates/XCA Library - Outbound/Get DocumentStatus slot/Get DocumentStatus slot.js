/**
	Generates XDSDocumentEntryStatus slot with the 'Approved' document type

	@return {Object} return XDSDocumentEntryStatus slot
*/
function getXDSDocumentEntryStatus() {

	// Valid Document Status Values:
	// urn:oasis:names:tc:ebxml-regrep:StatusType:Approved
	// urn:oasis:names:tc:ebxml-regrep:StatusType:Deprecated
	
	var xml = <urn2:Slot name="$XDSDocumentEntryStatus" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
		          <urn2:ValueList>
		            <urn2:Value>('urn:oasis:names:tc:ebxml-regrep:StatusType:Approved')</urn2:Value>
		          </urn2:ValueList>
	        </urn2:Slot>;

	return xml;
        
}