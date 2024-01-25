/**
	Generate LivingSubjectBirthPlaceAddress query entry
	This query parameter is a patient's birthplace represented as an address

	@param {Object} address - birth place Address object from the extension
	@return {Object} return XML object representing LivingSubjectBirthPlaceAddress query entry
*/
function getLivingSubjectBirthPlaceAddress(address) {

	var xml = null;

	try {

		xml = <urn:livingSubjectBirthPlaceAddress xmlns:urn="urn:hl7-org:v3">
		          <urn:value/>
		          <urn:semanticsText>LivingSubject.BirthPlace.Addr</urn:semanticsText>
		        </urn:livingSubjectBirthPlaceAddress>;

		if (address.hasOwnProperty('line'))
			address.line.forEach(line => {
				var street = <urn:streetAddressLine xmlns:urn="urn:hl7-org:v3">{line.toString()}</urn:streetAddressLine>;
				xml.*::value.appendChild(street);
			});
		if (address.hasOwnProperty('city')) {
			var city = <urn:city xmlns:urn="urn:hl7-org:v3">{address.city.toString()}</urn:city>;
			xml.*::value.appendChild(city);
		}
		if (address.hasOwnProperty('state')) {
			var state = <urn:state xmlns:urn="urn:hl7-org:v3">{address.state.toString()}</urn:state>;
			xml.*::value.appendChild(state);
		}
		if (address.hasOwnProperty('postalCode')) {
			var postalCode = <urn:postalCode xmlns:urn="urn:hl7-org:v3">{address.postalCode.toString()}</urn:postalCode>;
			xml.*::value.appendChild(postalCode);
		}
		if (address.hasOwnProperty('country')) {
			var country = <urn:country xmlns:urn="urn:hl7-org:v3">{address.country.toString()}</urn:country>;
			xml.*::value.appendChild(country);
		}

		return xml;		

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getLivingSubjectBirthPlaceAddress() - ' + ex);
		return null;
	}	
}
