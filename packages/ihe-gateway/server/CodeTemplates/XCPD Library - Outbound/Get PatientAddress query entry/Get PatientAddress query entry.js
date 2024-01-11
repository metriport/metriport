/**
	Generates PatientAddress query entry
	This query parameter is a postal address for corresponding with a living subject in the context of the target patient registry.
	There shall be only a single PatientAddress element.
	Multiple instances of the value element within a Patient Address may be specified and are combined with OR logic.

	@param {Object} address - Patient.address element
	@return {Object} return XML object representing PatientAddress query entry
*/
function getPatientAddress(address) {

	var xml = null;
	var valueList = new XMLList();

	try {

		address.forEach(function(addr) {

			var value = <urn:value xmlns:urn="urn:hl7-org:v3"/>;
			
			addr.line.forEach(line => {
				var street = <urn:streetAddressLine xmlns:urn="urn:hl7-org:v3">{line.toString()}</urn:streetAddressLine>;
				value.appendChild(street);
			});	
			if (addr.hasOwnProperty('city')) {
				var city = <urn:city xmlns:urn="urn:hl7-org:v3">{addr.city.toString()}</urn:city>;
				value.appendChild(city);
			}
			if (addr.hasOwnProperty('state')) {
				var state = <urn:state xmlns:urn="urn:hl7-org:v3">{addr.state.toString()}</urn:state>;
				value.appendChild(state);
			}
			if (addr.hasOwnProperty('postalCode')) {
				var postalCode = <urn:postalCode xmlns:urn="urn:hl7-org:v3">{addr.postalCode.toString()}</urn:postalCode>;
				value.appendChild(postalCode);
			}
			if (addr.hasOwnProperty('country')) {
				var country = <urn:country xmlns:urn="urn:hl7-org:v3">{addr.country.toString()}</urn:country>;
				value.appendChild(country);
			}
			valueList += value;
		});

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getPatientAddress() - ' + ex);
	}

	if (valueList.length() > 0) {
		xml = <urn:patientAddress xmlns:urn="urn:hl7-org:v3">
				<urn:semanticsText>Patient.addr</urn:semanticsText>
			</urn:patientAddress>;
		xml.insertChildBefore(xml.*::semanticsText[0], valueList);
	}

	return xml;
}