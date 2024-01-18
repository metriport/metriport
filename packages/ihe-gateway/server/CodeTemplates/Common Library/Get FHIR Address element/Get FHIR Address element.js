/**
	Converts HL7v3 'addr' element to FHIR Address element

	@param {Object} entry - HL7v3 addr element
	@return {Object} return FHIR Address element
*/
function getFHIRAddress(entry) {

	// NOTE: Uses simplified HL7v3 address representation
	// see HL7v3: XML ITS - Postal Address (AD)

	var address = {"use":"", "line":[]};

	try {

		if (isNotEmpty(entry.@use)) {
			if (entry.@use.toString().indexOf('H') > -1) address.use = 'home';
			else if (entry.@use.toString().indexOf('W') > -1) address.use = 'work';
			else if (entry.@use.toString().indexOf('T') > -1) address.use = 'temp';
			else if (entry.@use.toString().indexOf('B') > -1) address.use = 'old';
		} else delete address.use;

		for each (var line in entry.streetAddressLine) {
			if (isNotEmpty(line)) address.line.push(line.toString());
		}

		if (isNotEmpty(entry.direction)) address.line.push(entry.direction.toString());

		if (isNotEmpty(entry.streetName)) address.line.push(entry.streetName.toString());

		if (isNotEmpty(entry.additionalLocator)) address.line.push(entry.additionalLocator.toString());		
		
		if (0 == address.line.length) delete address.line;

		if (isNotEmpty(entry.city)) address.city = entry.city.toString();

		if (isNotEmpty(entry.district)) address.district = entry.district.toString();

		if (isNotEmpty(entry.state)) address.state = entry.state.toString();

		if (isNotEmpty(entry.postalCode)) address.postalCode = entry.postalCode.toString();

		if (isNotEmpty(entry.country)) address.country = entry.country.toString();

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getAddress() - ' + ex);
		return null;
	}

	return address;
}