/**
	Generates FHIR Patient resource instance from the HL7v3 PRPA_IN201305UV02 query parameters

	@param {Object} parameters - query parameters
	@return {Object} return FHIR Patient resource instance
*/
function convertXCPDQueryToPatientResource(parameters) {

	var patient = <Patient/>;

	// Remove namespace declaration
	parameters = new XML(String(parameters).replace('xmlns="urn:hl7-org:v3"', ''));

	// XCPD ITI-55 query parameters

	// livingSubjectBirthPlaceAddress - https://hl7.org/fhir/R4/extension-patient-birthplace.html
	if (parameters.hasOwnProperty('livingSubjectBirthPlaceAddress')) try {
		
		var extension = <extension url="http://hl7.org/fhir/StructureDefinition/patient-birthPlace">
					  <valueAddress/>
					</extension>;

		if (parameters.livingSubjectBirthPlaceAddress.value.hasOwnProperty('streetAddressLine')) {
			// Processing only the first street line
			var line = <line value={parameters.livingSubjectBirthPlaceAddress.value.streetAddressLine[0].toString()}/>;
			extension.valueAddress.appendChild(line);
		}
		
		if (parameters.livingSubjectBirthPlaceAddress.value.hasOwnProperty('city')) {
			var city = <city value={parameters.livingSubjectBirthPlaceAddress.value.city.toString()}/>;
			extension.valueAddress.appendChild(city);
		}

		if (parameters.livingSubjectBirthPlaceAddress.value.hasOwnProperty('state')) {
			var state = <state value={parameters.livingSubjectBirthPlaceAddress.value.state.toString()}/>;
			extension.valueAddress.appendChild(state);
		}

		if (parameters.livingSubjectBirthPlaceAddress.value.hasOwnProperty('postalCode')) {
			var postalCode = <postalCode value={parameters.livingSubjectBirthPlaceAddress.value.postalCode.toString()}/>;
			extension.valueAddress.appendChild(postalCode);
		}

		if (parameters.livingSubjectBirthPlaceAddress.value.hasOwnProperty('country')) {
			var country = <country value={parameters.livingSubjectBirthPlaceAddress.value.country.toString()}/>;
			extension.valueAddress.appendChild(country);
		}

		patient.appendChild(extension);

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() birthPlace - ' + ex);
	}


	// mothersMaidenName - https://hl7.org/fhir/R4/extension-patient-mothersmaidenname.html
	if (parameters.hasOwnProperty('mothersMaidenName')) try {
		var extension = <extension url="http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName">
					  <valueString value={parameters.mothersMaidenName.value.toString()}/>
					</extension>;
		
		patient.appendChild(extension);
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() maidenName - ' + ex);
	}


	// livingSubjectId
	if (parameters.hasOwnProperty('livingSubjectId')) try {
		for each (var value in parameters.livingSubjectId.value) {
			var identifier = <identifier>
							<system value=""/>
							<value value={value.@extension.toString()}/>
						</identifier>;
			identifier.system.@value = isOID(value.@root.toString()) ? 'urn:oid:' + value.@root.toString() : value.@root.toString();
			patient.appendChild(identifier);
		}		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() identifier - ' + ex);
	}


	// livingSubjectName
	if (parameters.hasOwnProperty('livingSubjectName')) {
		for each (var entityName in parameters.livingSubjectName) try {

			var name = <name></name>;
			
			if (entityName.value.hasOwnProperty('family')) {
				var family = <family value={entityName.value.family[0].toString()}/>;
				name.appendChild(family);
			}

			for each (var given in entityName.value.given) {
				var given = <given value={given.toString()}/>;
				name.appendChild(given);
			}

			if (entityName.value.hasOwnProperty('prefix')) {
				var prefix = <prefix value={entityName.value.prefix[0].toString()}/>;
				name.appendChild(prefix);
			}

			if (entityName.value.hasOwnProperty('suffix')) {
				var suffix = <suffix value={entityName.value.suffix[0].toString()}/>;
				name.appendChild(suffix);
			}

			patient.appendChild(name);
			
		} catch(ex) {
			if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() name - ' + ex);
		}		
	}

	// patientTelecom
	if (parameters.hasOwnProperty('patientTelecom')) {
		for each (var tel in parameters.patientTelecom) {
			for each (var value in tel.value) try {
				var telecom = 	<telecom>
								<system value="phone"/>
								<value value={value.@value.toString().split(':').pop()}/>
							</telecom>;

				if (value.@value.toString().indexOf('fax') > -1) telecom.system.@value = 'fax';
				else if (value.@value.toString().indexOf('mail') > -1) telecom.system.@value = 'email';
				
				patient.appendChild(telecom);
			} catch(ex) {
				if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() telecom - ' + ex);
			}		
		}
	}


	// livingSubjectAdministrativeGender
	if (parameters.hasOwnProperty('livingSubjectAdministrativeGender')) try {
		var gender = <gender value="unknown"/>;		
		if (parameters.livingSubjectAdministrativeGender.value.@code.startsWith('M')) gender.@value = 'male';
		else if (parameters.livingSubjectAdministrativeGender.value.@code.startsWith('F')) gender.@value = 'female';
		patient.appendChild(gender);
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() gender - ' + ex);
	}


	// livingSubjectBirthTime
	if (parameters.hasOwnProperty('livingSubjectBirthTime')) try {
		var dob = parameters.livingSubjectBirthTime.value.@value.toString().substring(0, 8);
		var birthDate = <birthDate value={DateUtil.convertDate('yyyyMMdd', "yyyy-MM-dd", dob.toString())}/>;
		patient.appendChild(birthDate);		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() dob - ' + ex);
	}


	// patientAddress
	if (parameters.hasOwnProperty('patientAddress')) {
		for each (var addr in parameters.patientAddress.value) try {

			var address = <address></address>;
	
			if (addr.hasOwnProperty('streetAddressLine')) {
				for each (var streetAddressLine in addr.streetAddressLine) {
					var line = <line value={streetAddressLine.toString()}/>;
					address.appendChild(line);
				}
			}
			
			if (addr.hasOwnProperty('city')) {
				var city = <city value={addr.city.toString()}/>;
				address.appendChild(city);
			}
	
			if (addr.hasOwnProperty('state')) {
				var state = <state value={addr.state.toString()}/>;
				address.appendChild(state);
			}
	
			if (addr.hasOwnProperty('postalCode')) {
				var postalCode = <postalCode value={addr.postalCode.toString()}/>;
				address.appendChild(postalCode);
			}
	
			if (addr.hasOwnProperty('country')) {
				var country = <country value={addr.country.toString()}/>;
				address.appendChild(country);
			}
	
			patient.appendChild(address);
			
		} catch(ex) {
			if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: convertXCPDQueryToPatientResource() address - ' + ex);
		}		
	}

	return patient;

}