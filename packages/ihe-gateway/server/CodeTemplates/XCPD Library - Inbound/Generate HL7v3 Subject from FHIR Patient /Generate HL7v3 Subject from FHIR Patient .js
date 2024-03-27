/**
	Generates an HL7v3 RoleSubject R-MIM from the FHIR Patient resource instance

	@param {Object} lambda - AWS Lambda response in JSON format
	@return {Object} return Subject CMET object in XML format
*/
function getXCPDResponseSubject(lambda) {

	const senderOID = Config.getHomeCommunityId();
	let qualityOfMatch = 99;
	try {
		qualityOfMatch = ('number' == typeof lambda.patientMatchDegree && (lambda.patientMatchDegree > 0 || lambda.patientMatchDegree <= 100)) ? lambda.patientMatchDegree : 99;
	} catch(ex) {}

	// TODO `externalGatewayPatient` should prob be `metriportPatient`
	const xml = <subject contextConductionInd="false" typeCode="SUBJ">
		          <registrationEvent classCode="REG" moodCode="EVN">
		            <statusCode code="active"/>
		            <subject1 typeCode="SBJ">
		              <patient classCode="PAT">
		                <id extension={lambda.externalGatewayPatient.id.toString()} root={lambda.externalGatewayPatient.system.toString()}/>
		                <statusCode code="active"/>
		                <patientPerson/>
		                <subjectOf1>
		                  <queryMatchObservation classCode="OBS" moodCode="EVN">
		                    <code code="IHE_PDQ"/>
		                    <value value={qualityOfMatch.toString()} xsi:type="INT" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
		                  </queryMatchObservation>
		                </subjectOf1>
		              </patient>
		            </subject1>
		            <custodian typeCode="CST">
		              <assignedEntity classCode="ASSIGNED">
		                <id root={senderOID}/>
		                <code code="NotHealthDataLocator" codeSystem="1.3.6.1.4.1.19376.1.2.27.2"/>
		              </assignedEntity>
		            </custodian>
		          </registrationEvent>
		        </subject>;


	// Convert the FHIR Patient resource to the subtype of LivingSubject, representing a human being
	var patientResource = lambda.patientResource;
	var patient = <patientPerson/>;

	// (REQUIRED) Name(s) for this person
	if (patientResource.hasOwnProperty('name')) {
		patientResource.name.forEach(function(name) {
			try {
				var personName = <name/>;
				name.given.forEach(function(entry) {
					personName.appendChild(new XML('<given>' + entry.toString() + '</given>'));
				});
				personName.appendChild(new XML('<family>' + name.family.toString() + '</family>'));
				patient.appendChild(personName);
			} catch(ex) {
				if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: XCPD Inbound - getXCPDResponseSubject() - Name: ' + ex);
			}
		});
	} else {
		throw "XCPD Inbound Processor: The patient's name SHALL be provided for the response.";
	}

	// Telecommunication address(es) for communicating with this person
	if (patientResource.hasOwnProperty('telecom')) {
		patientResource.telecom.forEach(function(entry) {
			try {
				var prefix = ['tel:','fax:','mailto:','tty:','http:','sms:',''][['phone','fax','email','pager','url','sms','other'].indexOf(entry.system.toString())];
				var telecom = <telecom value={prefix.toString() + entry.value.toString()}/>;
				if (entry.hasOwnProperty('use')) {
					telecom.@use = ['H','W','TMP','BAD','DIR'][['home','work','temp','old','mobile'].indexOf(entry.use.toString())];
				}
				patient.appendChild(telecom);
			} catch(ex) {
				if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: XCPD Inbound - getXCPDResponseSubject() - Telecom: ' + ex);
			}
		}); 
	}

	// A value representing the gender (sex) of this person
	if (patientResource.hasOwnProperty('gender') && ['male','female'].indexOf(patientResource.gender.toString()) > -1) {
		patient.appendChild(new XML('<administrativeGenderCode code="' + String(patientResource.gender)[0].toUpperCase() +  '"/>'))
	}

	// The date and time this person was born 
	if (patientResource.hasOwnProperty('birthDate')) try {
		patient.appendChild(new XML('<birthTime value="' + DateUtil.convertDate('yyyy-MM-dd', 'yyyyMMdd', patientResource.birthDate.toString().substring(0, 10)) +  '"/>'))
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: XCPD Inbound - getXCPDResponseSubject() - birthDate: ' + ex);
	}

	// Address(es) for corresponding with this person
	if (patientResource.hasOwnProperty('address')) {
		patientResource.address.forEach(function(entry) {
			try {
				var addr = <addr/>;
				// TODO: Address use
				if (entry.hasOwnProperty('line')) {
					entry.line.forEach(function(line) {
						addr.appendChild(new XML('<streetAddressLine>' + line.toString() + '</streetAddressLine>'));
					});
				}
				if (entry.hasOwnProperty('city')) addr.appendChild(new XML('<city>' + entry.city.toString() + '</city>'));
				if (entry.hasOwnProperty('state')) addr.appendChild(new XML('<state>' + entry.city.toString() + '</state>'));
				if (entry.hasOwnProperty('postalCode')) addr.appendChild(new XML('<postalCode>' + entry.city.toString() + '</postalCode>'));
				if (entry.hasOwnProperty('country')) addr.appendChild(new XML('<country>' + entry.city.toString() + '</country>'));
				if (addr.hasComplexContent()) patient.appendChild(addr);
			} catch(ex) {
				if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: XCPD Inbound - getXCPDResponseSubject() - address: ' + ex);
			}
		});
	}

	// An identifying relationship between the focal living subject and a scoping organization
	if (patientResource.hasOwnProperty('identifier'))  {
		patientResource.identifier.forEach(function(entry) {
			try {
				var otherId = <asOtherIDs classCode="PAT"/>;
				var system = null;
				if (String(entry.system).startsWith('urn:oid:')) { 
					system = entry.system.toString().replace('urn:oid:','');
				} else if ('http://hl7.org/fhir/sid/us-ssn' == String(entry.system)) {
					system = '2.16.840.1.113883.4.1'; 
				} else return;
				otherId.appendChild(new XML('<id root="' + system + '" extension="' + entry.value.toString() + '"/>'));
				otherId.appendChild(new XML('<scopingOrganization classCode="ORG" determinerCode="INSTANCE"><id root="' + system + '"/></scopingOrganization>'));
				if (otherId.hasComplexContent()) patient.appendChild(otherId);
			} catch(ex) {
				if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: XCPD Inbound - getXCPDResponseSubject() - address: ' + ex);
			}
		});
	}
	
	xml.registrationEvent.subject1.patient.patientPerson = patient;

	return xml;
        
}