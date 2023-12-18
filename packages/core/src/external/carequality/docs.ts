export function generatePatientDoc(patientNumber: number): string {
  let patientRole = "";
  if (patientNumber == 1) {
    patientRole = `
			<id root="1.2.840.114350.1.13.11511.3.7.8.456721.987654" extension="EV38NJT4M6Q2B5X" />
			<addr use="HP">
				<streetAddressLine>2517 Durant Ave</streetAddressLine>
				<city>Berkeley</city>
				<state>CA</state>
				<postalCode>94704</postalCode>
				<country>USA</country>
			</addr>
			<telecom use="HP" value="tel:+1-666-666-6666" />
			<patient>
				<name use="L">
					<given>Skwisgaar</given>
					<family>Skwigelf</family>
				</name>
				<administrativeGenderCode code="M" codeSystem="2.16.840.1.113883.5.1" codeSystemName="AdministrativeGenderCode" displayName="Male" />
				<birthTime value="19690420" />`;
  }
  if (patientNumber == 2) {
    patientRole = `
			<id root="1.2.840.114350.1.13.11511.3.7.8.234587.334455" extension="EV72KHP9L1C3FA4" />
			<addr use="HP">
				<streetAddressLine>237 Hegmann Avenue</streetAddressLine>
				<city>Berkley</city>
				<state>MA</state>
				<postalCode>027791234</postalCode>
				<country>USA</country>
			</addr>
			<telecom use="HP" value="tel:+1-234-567-8910" />
			<patient>
				<name use="L">
					<given>Federico</given>
					<family>Aufderhar</family>
				</name>
				<administrativeGenderCode code="M" codeSystem="2.16.840.1.113883.5.1" codeSystemName="AdministrativeGenderCode" displayName="Male" />
				<birthTime value="19810712" />`;
  }
  if (patientNumber == 3) {
    patientRole = `
			<id root="1.2.840.114350.1.13.11511.3.7.3.688884.100.1000" extension="EV12ZGR7J6K4MF8" />
			<addr use="HP">
				<streetAddressLine>1100 test street</streetAddressLine>
				<city>Helena</city>
				<state>AL</state>
				<postalCode>35080</postalCode>
				<country>USA</country>
				<useablePeriod xsi:type="IVL_TS"
					xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
					<low value="20210121" />
					<high nullFlavor="NA" />
				</useablePeriod>
			</addr>
			<telecom use="HP" value="tel:+1-205-111-1111" />
			<patient>
				<name use="L">
					<given>Nwhinone</given>
					<family>Nwhinzzztestpatient</family>
					<validTime>
						<low value="20210121200317" />
						<high nullFlavor="NA" />
					</validTime>
				</name>
				<administrativeGenderCode code="M" codeSystem="2.16.840.1.113883.5.1" codeSystemName="AdministrativeGenderCode" displayName="Male" />
				<birthTime value="19810101" />`;
  }

  const patient_doc = `
	<?xml version="1.0" encoding="UTF-8"?>
	<ClinicalDocument
		xmlns="urn:hl7-org:v3">
		<realmCode code="US" />
		<typeId extension="POCD_HD000040" root="2.16.840.1.113883.1.3" />
		<templateId root="1.2.840.114350.1.72.1.51693" />
		<templateId root="2.16.840.1.113883.10.20.22.1.1" />
		<templateId root="2.16.840.1.113883.10.20.22.1.1" extension="2015-08-01" />
		<templateId root="2.16.840.1.113883.10.20.22.1.9" />
		<templateId root="2.16.840.1.113883.10.20.22.1.9" extension="2015-08-01" />
		<id assigningAuthorityName="EPC" root="1.2.840.114350.1.13.11511.3.7.8.688883.110992" />
		<code code="11506-3" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Subsequent evaluation note" />
		<title>Encounter Summary</title>
		<effectiveTime value="20231206165310-0600" />
		<confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" displayName="Normal" />
		<languageCode code="en-US" />
		<setId assigningAuthorityName="EPC" extension="00000000-0001-74aa-bbf4-3eab23ca2451" root="1.2.840.114350.1.13.11511.3.7.1.1" />
		<versionNumber value="148" />
		<recordTarget>
			<patientRole>
			${patientRole}
					<sdtc:deceasedInd value="false"
					xmlns:sdtc="urn:hl7-org:sdtc" />
					<maritalStatusCode nullFlavor="UNK" />
					<raceCode nullFlavor="UNK" />
					<ethnicGroupCode nullFlavor="UNK" />
					<languageCommunication>
						<languageCode nullFlavor="UNK" />
					</languageCommunication>
				</patient>
				<providerOrganization>
					<id root="1.2.840.114350.1.13.11511.3.7.2.688879" extension="1000" />
					<name>Lakeland Valley Hospital</name>
					<telecom nullFlavor="NI" />
					<addr use="WP">
						<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
						<county>DANE</county>
						<city>MADISON</city>
						<state>WI</state>
						<postalCode>53711</postalCode>
						<country>USA</country>
					</addr>
				</providerOrganization>
			</patientRole>
			</recordTarget>
			<author>
				<time value="20231206165310-0600" />
				<assignedAuthor>
					<id root="1.2.840.114350.1.1" extension="10.7" />
					<addr nullFlavor="NA" />
					<telecom nullFlavor="NA" />
					<assignedAuthoringDevice>
						<manufacturerModelName>Epic - Version 10.7</manufacturerModelName>
						<softwareName>Epic - Version 10.7</softwareName>
					</assignedAuthoringDevice>
					<representedOrganization>
						<id root="1.2.840.114350.1.13.11511.3.7.2.688879" extension="1000" />
						<name>Lakeland Valley Hospital</name>
						<telecom nullFlavor="NI" />
						<addr use="WP">
							<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
							<county>DANE</county>
							<city>MADISON</city>
							<state>WI</state>
							<postalCode>53711</postalCode>
							<country>USA</country>
						</addr>
					</representedOrganization>
				</assignedAuthor>
			</author>
			<custodian>
				<assignedCustodian>
					<representedCustodianOrganization>
						<id root="1.2.840.114350.1.13.11511.3.7.2.688879" extension="1000" />
						<name>Lakeland Valley Hospital</name>
						<telecom nullFlavor="NI" />
						<addr use="WP">
							<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
							<county>DANE</county>
							<city>MADISON</city>
							<state>WI</state>
							<postalCode>53711</postalCode>
							<country>USA</country>
						</addr>
					</representedCustodianOrganization>
				</assignedCustodian>
			</custodian>
			<legalAuthenticator>
				<time value="20231206165310-0600" />
				<signatureCode code="S" />
				<assignedEntity>
					<id nullFlavor="UNK" />
					<code nullFlavor="UNK" />
					<addr nullFlavor="UNK" />
					<telecom nullFlavor="UNK" />
					<assignedPerson>
						<name nullFlavor="UNK" />
					</assignedPerson>
				</assignedEntity>
			</legalAuthenticator>
			<documentationOf typeCode="DOC">
				<serviceEvent classCode="PCPR">
					<templateId root="2.16.840.1.113883.10.20.21.3.1" />
					<effectiveTime>
						<low value="20220713" />
						<high value="20220713085812-0500" />
					</effectiveTime>
					<performer typeCode="PRF">
						<functionCode code="PCP" codeSystem="2.16.840.1.113883.5.88" codeSystemName="ParticipationFunction" displayName="Primary Care Provider">
							<originalText>Primary Care Provider</originalText>
						</functionCode>
						<time>
							<low nullFlavor="NI" />
							<high nullFlavor="NI" />
						</time>
						<assignedEntity nullFlavor="NI">
							<id nullFlavor="UNK" />
							<addr nullFlavor="UNK" />
							<telecom nullFlavor="NA" />
							<assignedPerson nullFlavor="NA">
								<name nullFlavor="UNK" />
							</assignedPerson>
							<representedOrganization classCode="ORG">
								<name>Lakeland Valley Hospital</name>
								<telecom nullFlavor="UNK" />
								<addr use="WP">
									<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
									<county>DANE</county>
									<city>MADISON</city>
									<state>WI</state>
									<postalCode>53711</postalCode>
									<country>USA</country>
								</addr>
							</representedOrganization>
						</assignedEntity>
					</performer>
				</serviceEvent>
			</documentationOf>
			<relatedDocument typeCode="RPLC">
				<parentDocument>
					<id assigningAuthorityName="EPC" root="1.2.840.114350.1.13.11511.3.7.8.688883.110926" />
					<setId assigningAuthorityName="EPC" extension="00000000-0001-74aa-bbf4-3eab23ca2451" root="1.2.840.114350.1.13.11511.3.7.1.1" />
					<versionNumber value="147" />
				</parentDocument>
			</relatedDocument>
			<componentOf>
				<encompassingEncounter>
					<id root="1.2.840.114350.1.13.11511.3.7.3.698084.8" extension="29826" />
					<code>
						<originalText>Orders Only</originalText>
						<translation code="0" codeSystem="1.2.840.114350.1.72.1.30.1" />
					</code>
					<effectiveTime>
						<low value="20220713" />
						<high value="20220713085812-0500" />
					</effectiveTime>
					<responsibleParty>
						<assignedEntity>
							<id root="2.16.840.1.113883.4.6" extension="1000111876" />
							<addr use="WP">
								<streetAddressLine>123 Anywhere Street</streetAddressLine>
								<city>VERONA</city>
								<state>WI</state>
								<postalCode>53593</postalCode>
							</addr>
							<telecom use="WP" value="tel:+1-555-555-5555" />
							<assignedPerson>
								<name>
									<given>Anesthesiologist</given>
									<given>Four</given>
									<family>Anesthesia</family>
								</name>
							</assignedPerson>
							<representedOrganization>
								<name>Lakeland Valley Hospital</name>
							</representedOrganization>
						</assignedEntity>
					</responsibleParty>
					<encounterParticipant typeCode="ATND">
						<time value="20220713" />
						<assignedEntity>
							<id root="2.16.840.1.113883.4.6" extension="1000111876" />
							<code nullFlavor="OTH">
								<originalText>Anesthesiology</originalText>
								<translation code="5" codeSystem="1.2.840.114350.1.72.1.7.7.10.688867.4160" codeSystemName="Epic.DXC.StandardProviderSpecialtyType" displayName="Anesthesiology" />
								<translation code="2" codeSystem="1.2.840.114350.1.13.11511.3.7.10.836982.1050" codeSystemName="Epic.SER.ProviderSpecialty" displayName="Anesthesiology" />
							</code>
							<addr use="WP">
								<streetAddressLine>123 Anywhere Street</streetAddressLine>
								<county>DANE</county>
								<city>VERONA</city>
								<state>WI</state>
								<postalCode>53593</postalCode>
							</addr>
							<telecom use="WP" value="tel:+1-555-555-5555" />
							<assignedPerson>
								<name use="L">
									<given>Anesthesiologist</given>
									<given>Four</given>
									<family>Anesthesia</family>
									<suffix qualifier="AC"> MD</suffix>
									<validTime>
										<low nullFlavor="UNK" />
										<high nullFlavor="UNK" />
									</validTime>
								</name>
							</assignedPerson>
						</assignedEntity>
					</encounterParticipant>
					<location>
						<healthCareFacility>
							<id root="1.2.840.114350.1.13.11511.3.7.2.686980" extension="10101147" />
							<code nullFlavor="UNK">
								<originalText>Anesthesiology</originalText>
								<translation code="5" codeSystem="1.2.840.114350.1.72.1.7.7.10.688867.4150" codeSystemName="Epic.DepartmentSpecialty" displayName="Anesthesiology" />
							</code>
							<location>
								<name>EMH Anesthesiology</name>
								<addr use="WP">
									<streetAddressLine>123 Anywhere Street</streetAddressLine>
									<county>DANE</county>
									<city>VERONA</city>
									<state>WI</state>
									<postalCode>53593-9179</postalCode>
									<country>USA</country>
								</addr>
							</location>
							<serviceProviderOrganization>
								<id root="1.2.840.114350.1.13.11511.3.7.2.696570" extension="10101" />
								<name>EHS Hospital</name>
								<addr use="WP">
									<streetAddressLine>123 Anywhere Street</streetAddressLine>
									<county>DANE</county>
									<city>VERONA</city>
									<state>WI</state>
									<postalCode>53593-9179</postalCode>
									<country>USA</country>
								</addr>
								<asOrganizationPartOf>
									<wholeOrganization>
										<name>Lakeland Valley Hospital</name>
										<addr use="WP">
											<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
											<county>DANE</county>
											<city>MADISON</city>
											<state>WI</state>
											<postalCode>53711</postalCode>
											<country>USA</country>
										</addr>
									</wholeOrganization>
								</asOrganizationPartOf>
							</serviceProviderOrganization>
						</healthCareFacility>
					</location>
				</encompassingEncounter>
			</componentOf>
			<component>
				<structuredBody>
					<component>
						<section>
							<templateId root="2.16.840.1.113883.10.20.22.2.22" />
							<templateId root="2.16.840.1.113883.10.20.22.2.22" extension="2015-08-01" />
							<templateId root="2.16.840.1.113883.10.20.22.2.22.1" />
							<templateId root="2.16.840.1.113883.10.20.22.2.22.1" extension="2015-08-01" />
							<code code="46240-8" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of Hospitalizations+Outpatient visits Narrative" />
							<title>Encounter Details</title>
							<text>
								<table>
									<colgroup>
										<col width="10%" />
										<col width="15%" />
										<col width="25%" span="3" />
									</colgroup>
									<thead>
										<tr>
											<th>Date</th>
											<th>Type</th>
											<th>Department</th>
											<th>Care Team (Latest Contact Info)</th>
											<th>Description</th>
										</tr>
									</thead>
									<tbody>
										<tr ID="encounter1" styleCode="xRowNormal">
											<td>07/13/2022</td>
											<td ID="encounter1type">Orders Only</td>
											<td>
												<paragraph>EMH Anesthesiology</paragraph>
												<paragraph>123 Anywhere Street</paragraph>
												<paragraph>VERONA, WI 53593-9179</paragraph>
												<paragraph>555-555-5555</paragraph>
											</td>
											<td>
												<paragraph styleCode="Bold">Anesthesia, Anesthesiologist Four, MD</paragraph>
												<paragraph>123 Anywhere Street</paragraph>
												<paragraph>VERONA, WI 53593</paragraph>
												<paragraph>555-555-5555 (Work)</paragraph>
											</td>
											<td>
												<content ID="encounter1desc">Cancer of anal canal (CMS/HCC) (Primary Dx)</content>
											</td>
										</tr>
									</tbody>
								</table>
							</text>
							<entry>
								<encounter classCode="ENC" moodCode="EVN">
									<templateId root="2.16.840.1.113883.10.20.22.4.49" />
									<templateId root="2.16.840.1.113883.10.20.22.4.49" extension="2015-08-01" />
									<id assigningAuthorityName="EPIC" root="1.2.840.114350.1.13.11511.3.7.3.698084.8" extension="29826" />
									<code code="AMB" codeSystem="2.16.840.1.113883.5.4">
										<originalText>
											<reference value="#encounter1type" />
										</originalText>
										<translation code="111" codeSystem="1.2.840.114350.1.13.11511.3.7.4.698084.30" codeSystemName="Epic.EncounterType" />
										<translation code="111" codeSystem="1.2.840.114350.1.72.1.30" />
										<translation code="0" codeSystem="1.2.840.114350.1.72.1.30.1" />
									</code>
									<text>
										<reference value="#encounter1" />
									</text>
									<statusCode code="completed" />
									<effectiveTime>
										<low value="20220713" />
										<high value="20220713085812-0500" />
									</effectiveTime>
									<performer typeCode="PRF">
										<time>
											<low nullFlavor="UNK" />
											<high nullFlavor="UNK" />
										</time>
										<assignedEntity classCode="ASSIGNED">
											<id root="2.16.840.1.113883.4.6" extension="1000111876" />
											<code nullFlavor="OTH">
												<originalText>Anesthesiology</originalText>
												<translation code="5" codeSystem="1.2.840.114350.1.72.1.7.7.10.688867.4160" codeSystemName="Epic.DXC.StandardProviderSpecialtyType" displayName="Anesthesiology" />
												<translation code="2" codeSystem="1.2.840.114350.1.13.11511.3.7.10.836982.1050" codeSystemName="Epic.SER.ProviderSpecialty" displayName="Anesthesiology" />
											</code>
											<addr use="WP">
												<streetAddressLine>123 Anywhere Street</streetAddressLine>
												<county>DANE</county>
												<city>VERONA</city>
												<state>WI</state>
												<postalCode>53593</postalCode>
											</addr>
											<telecom use="WP" value="tel:+1-555-555-5555" />
											<assignedPerson>
												<name>
													<given>Anesthesiologist</given>
													<given>Four</given>
													<family>Anesthesia</family>
													<suffix qualifier="AC">MD</suffix>
												</name>
											</assignedPerson>
											<representedOrganization classCode="ORG">
												<name>Lakeland Valley Hospital</name>
												<telecom nullFlavor="NI" />
												<addr use="WP">
													<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
													<county>DANE</county>
													<city>MADISON</city>
													<state>WI</state>
													<postalCode>53711</postalCode>
													<country>USA</country>
												</addr>
											</representedOrganization>
										</assignedEntity>
									</performer>
									<author>
										<templateId root="2.16.840.1.113883.10.20.22.4.119" />
										<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
										<time value="20220713085812-0500" />
										<assignedAuthor>
											<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
											<addr nullFlavor="UNK" />
											<telecom nullFlavor="UNK" />
											<representedOrganization>
												<id root="1.2.840.114350.1.13.11511.3.7.2.688879" extension="1000" />
												<id root="2.16.840.1.113883.4.2" nullFlavor="UNK" />
												<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
												<name>Lakeland Valley Hospital</name>
												<addr use="WP">
													<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
													<county>DANE</county>
													<city>MADISON</city>
													<state>WI</state>
													<postalCode>53711</postalCode>
													<country>USA</country>
												</addr>
											</representedOrganization>
										</assignedAuthor>
									</author>
									<participant typeCode="LOC">
										<participantRole classCode="SDLOC">
											<templateId root="2.16.840.1.113883.10.20.22.4.32" />
											<id root="1.2.840.114350.1.13.11511.3.7.2.686980" extension="10101147" />
											<code nullFlavor="UNK">
												<originalText>Anesthesiology</originalText>
												<translation code="5" codeSystem="1.2.840.114350.1.72.1.7.7.10.688867.4150" codeSystemName="Epic.DepartmentSpecialty" displayName="Anesthesiology" />
											</code>
											<addr use="WP">
												<streetAddressLine>123 Anywhere Street</streetAddressLine>
												<county>DANE</county>
												<city>VERONA</city>
												<state>WI</state>
												<postalCode>53593-9179</postalCode>
												<country>USA</country>
											</addr>
											<playingEntity classCode="PLC">
												<name>EMH Anesthesiology</name>
												<desc>Anesthesiology</desc>
											</playingEntity>
										</participantRole>
									</participant>
									<entryRelationship typeCode="COMP">
										<act classCode="ACT" moodCode="EVN">
											<templateId root="2.16.840.1.113883.10.20.22.4.64" />
											<code code="48767-8" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" />
											<text>
												<reference value="#encounter1desc" />
											</text>
											<statusCode code="completed" />
										</act>
									</entryRelationship>
									<entryRelationship typeCode="SUBJ">
										<act classCode="ACT" moodCode="EVN">
											<templateId root="2.16.840.1.113883.10.20.22.4.80" />
											<templateId root="2.16.840.1.113883.10.20.22.4.80" extension="2015-08-01" />
											<id root="1.2.840.114350.1.13.11511.3.7.1.1099.1" extension="29826-120279-concern" />
											<code code="29308-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Diagnosis" />
											<statusCode code="active" />
											<entryRelationship typeCode="SUBJ" inversionInd="false">
												<observation classCode="OBS" moodCode="EVN">
													<templateId root="2.16.840.1.113883.10.20.22.4.4" />
													<templateId root="2.16.840.1.113883.10.20.22.4.4" extension="2015-08-01" />
													<templateId root="2.16.840.1.113883.10.20.22.4.4" extension="2022-06-01" />
													<id root="1.2.840.114350.1.13.11511.3.7.1.1099.1" extension="29826-120279" />
													<code code="282291009" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT">
														<translation code="29308-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Diagnosis" />
													</code>
													<text>Cancer of anal canal (CMS/HCC)</text>
													<statusCode code="completed" />
													<effectiveTime>
														<low nullFlavor="UNK" />
													</effectiveTime>
													<value code="255083005" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" xsi:type="CD"
														xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
														<originalText>Cancer of anal canal (CMS/HCC)</originalText>
														<translation code="C21.1" codeSystem="2.16.840.1.113883.6.90" codeSystemName="ICD10" displayName="Cancer of anal canal (CMS/HCC)" />
														<translation code="154.2" codeSystem="2.16.840.1.113883.6.103" codeSystemName="ICD9" displayName="Cancer of anal canal (CMS/HCC)" />
														<translation code="73734" codeSystem="2.16.840.1.113883.3.247.1.1" codeSystemName="Intelligent Medical Objects ProblemIT" displayName="Cancer of anal canal (CMS/HCC)" />
													</value>
													<author>
														<templateId root="2.16.840.1.113883.10.20.22.4.119" />
														<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
														<time value="20220713085759-0500" />
														<assignedAuthor>
															<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="524954327" />
															<id root="1.2.840.114350.1.13.11511.3.7.2.697780" extension="28530" />
															<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
															<addr nullFlavor="UNK" />
															<telecom nullFlavor="UNK" />
															<assignedPerson>
																<name use="L">
																	<given>Ryan</given>
																	<family>Brickner</family>
																	<validTime>
																		<low nullFlavor="UNK" />
																		<high nullFlavor="UNK" />
																	</validTime>
																</name>
															</assignedPerson>
															<representedOrganization>
																<id root="1.2.840.114350.1.13.11511.3.7.2.688879" extension="1000" />
																<id root="2.16.840.1.113883.4.2" nullFlavor="UNK" />
																<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
																<name>Lakeland Valley Hospital</name>
																<addr use="WP">
																	<streetAddressLine>1000 Healthcare Ave.</streetAddressLine>
																	<county>DANE</county>
																	<city>MADISON</city>
																	<state>WI</state>
																	<postalCode>53711</postalCode>
																	<country>USA</country>
																</addr>
															</representedOrganization>
														</assignedAuthor>
													</author>
													<participant typeCode="LOC">
														<participantRole classCode="SDLOC">
															<templateId root="2.16.840.1.113883.10.20.22.4.32" />
															<code nullFlavor="UNK">
																<translation code="0" codeSystem="1.2.840.114350.1.72.1.7.7.10.698084.18465" codeSystemName="Epic.isEDDX" />
															</code>
															<addr nullFlavor="UNK" />
															<playingEntity classCode="PLC">
																<name nullFlavor="UNK" />
															</playingEntity>
														</participantRole>
													</participant>
													<entryRelationship typeCode="REFR">
														<observation classCode="OBS" moodCode="EVN">
															<templateId root="2.16.840.1.113883.10.20.22.4.6" />
															<templateId root="2.16.840.1.113883.10.20.22.4.6" extension="2019-06-20" />
															<code code="33999-4" codeSystem="2.16.840.1.113883.6.1" displayName="Status" />
															<statusCode code="completed" />
															<effectiveTime>
																<low nullFlavor="UNK" />
															</effectiveTime>
															<value code="55561003" codeSystem="2.16.840.1.113883.6.96" xsi:type="CD" displayName="Active"
																xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />
															</observation>
														</entryRelationship>
														<entryRelationship typeCode="REFR">
															<observation classCode="OBS" moodCode="EVN">
																<templateId root="2.16.840.1.113883.10.20.24.3.166" extension="2019-12-01" />
																<code code="263486008" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Rank" />
																<value xsi:type="INT" value="1"
																	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />
																</observation>
															</entryRelationship>
														</observation>
													</entryRelationship>
												</act>
											</entryRelationship>
										</encounter>
									</entry>
								</section>
							</component>
							<component>
								<section>
									<templateId root="2.16.840.1.113883.10.20.22.2.17" />
									<templateId root="2.16.840.1.113883.10.20.22.2.17" extension="2015-08-01" />
									<code code="29762-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Social history Narrative" />
									<title>Social History</title>
									<text>
										<table ID="sochist5">
											<colgroup>
												<col width="25%" span="2" />
												<col width="13%" />
												<col width="12%" />
												<col width="25%" />
											</colgroup>
											<thead>
												<tr>
													<th>Tobacco Use</th>
													<th>Types</th>
													<th>Packs/Day</th>
													<th>Years Used</th>
													<th>Date</th>
												</tr>
											</thead>
											<tbody>
												<tr>
													<td>Smoking Tobacco: Never Assessed</td>
													<td />
													<td ID="sochist5packsperday" />
													<td />
													<td />
												</tr>
											</tbody>
										</table>
										<table>
											<colgroup>
												<col width="50%" />
												<col width="25%" span="2" />
											</colgroup>
											<thead>
												<tr>
													<th>Sex and Gender Information</th>
													<th>Value</th>
													<th>Date Recorded</th>
												</tr>
											</thead>
											<tbody>
												<tr ID="BirthSex8">
													<td>Sex Assigned at Birth</td>
													<td ID="BirthSex8Value">Male</td>
													<td>07/16/2021 10:50 AM CDT</td>
												</tr>
												<tr ID="GenderIdentity6">
													<td>Gender Identity</td>
													<td ID="GenderIdentity6Value">Male</td>
													<td>07/16/2021 10:50 AM CDT</td>
												</tr>
												<tr ID="SexualOrientation7">
													<td>Sexual Orientation</td>
													<td ID="SexualOrientation7Value">Straight</td>
													<td>07/16/2021 10:50 AM CDT</td>
												</tr>
											</tbody>
										</table>
										<footnote ID="subTitle4" styleCode="xSectionSubTitle">documented as of this encounter</footnote>
									</text>
									<entry>
										<observation classCode="OBS" moodCode="EVN">
											<templateId root="2.16.840.1.113883.10.20.22.4.78" />
											<templateId root="2.16.840.1.113883.10.20.22.4.78" extension="2014-06-09" />
											<id root="1.2.840.114350.1.13.11511.3.7.1.1040.1" extension="Z6084^^72166-2" />
											<code code="72166-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Tobacco smoking status NHIS" />
											<text>
												<reference value="#sochist5" />
											</text>
											<statusCode code="completed" />
											<effectiveTime nullFlavor="UNK" />
											<value code="266927001" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" xsi:type="CD" displayName="Tobacco smoking consumption unknown"
												xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />
												<author>
													<templateId root="2.16.840.1.113883.10.20.22.4.119" />
													<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
													<time nullFlavor="UNK" />
													<assignedAuthor>
														<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="524954327" />
														<id root="1.2.840.114350.1.13.11511.3.7.2.697780" extension="28530" />
														<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
													</assignedAuthor>
												</author>
											</observation>
										</entry>
										<entry>
											<observation classCode="OBS" moodCode="EVN">
												<templateId root="2.16.840.1.113883.10.20.22.4.200" extension="2016-06-01" />
												<id root="1.2.840.114350.1.13.11511.3.7.1.1040.20" extension="Z6084" />
												<code code="76689-9" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Sex assigned at birth" />
												<text>
													<reference value="#BirthSex8" />
												</text>
												<statusCode code="completed" />
												<effectiveTime value="19810101" />
												<value code="M" codeSystem="2.16.840.1.113883.5.1" codeSystemName="HL7 Gender" xsi:type="CD"
													xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
													<originalText>
														<reference value="#BirthSex8Value" />
													</originalText>
												</value>
												<author>
													<templateId root="2.16.840.1.113883.10.20.22.4.119" />
													<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
													<time value="20210716105026-0500" />
													<assignedAuthor>
														<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="524954327" />
														<id root="1.2.840.114350.1.13.11511.3.7.2.697780" extension="28530" />
														<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
													</assignedAuthor>
												</author>
											</observation>
										</entry>
										<entry>
											<observation classCode="OBS" moodCode="EVN">
												<templateId root="2.16.840.1.113883.10.20.34.3.45" extension="2022-06-01" />
												<templateId root="2.16.840.1.113883.10.20.22.4.38" />
												<templateId root="2.16.840.1.113883.10.20.22.4.38" extension="2015-08-01" />
												<id root="1.2.840.114350.1.13.11511.3.7.1.1040.46" extension="Z6084" />
												<code code="76691-5" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Gender identity" />
												<text>
													<reference value="#GenderIdentity6" />
												</text>
												<statusCode code="completed" />
												<effectiveTime>
													<low value="20210716105026-0500" />
												</effectiveTime>
												<value code="446151000124109" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" xsi:type="CD" displayName="Identifies as male gender (finding)"
													xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
													<originalText>
														<reference value="#GenderIdentity6Value" />
													</originalText>
												</value>
												<author>
													<templateId root="2.16.840.1.113883.10.20.22.4.119" />
													<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
													<time value="20210716105026-0500" />
													<assignedAuthor>
														<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="524954327" />
														<id root="1.2.840.114350.1.13.11511.3.7.2.697780" extension="28530" />
														<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
													</assignedAuthor>
												</author>
											</observation>
										</entry>
										<entry>
											<observation classCode="OBS" moodCode="EVN">
												<templateId root="2.16.840.1.113883.10.20.22.4.501" extension="2022-06-01" />
												<templateId root="2.16.840.1.113883.10.20.22.4.38" />
												<templateId root="2.16.840.1.113883.10.20.22.4.38" extension="2015-08-01" />
												<id root="1.2.840.114350.1.13.11511.3.7.1.1040.45" extension="Z6084.1" />
												<code code="76690-7" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Sexual orientation" />
												<text>
													<reference value="#SexualOrientation7" />
												</text>
												<statusCode code="completed" />
												<effectiveTime>
													<low value="20210716105026-0500" />
												</effectiveTime>
												<value code="20430005" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" xsi:type="CD" displayName="Heterosexual (finding)"
													xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
													<originalText>
														<reference value="#SexualOrientation7Value" />
													</originalText>
												</value>
												<author>
													<templateId root="2.16.840.1.113883.10.20.22.4.119" />
													<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
													<time value="20210716105026-0500" />
													<assignedAuthor>
														<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="524954327" />
														<id root="1.2.840.114350.1.13.11511.3.7.2.697780" extension="28530" />
														<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
													</assignedAuthor>
												</author>
											</observation>
										</entry>
									</section>
								</component>
								<component>
									<section>
										<templateId root="2.16.840.1.113883.10.20.22.2.10" />
										<templateId root="2.16.840.1.113883.10.20.22.2.10" extension="2014-06-09" />
										<code code="18776-5" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Plan of care note" />
										<title>Plan of Treatment</title>
										<text>
											<table>
												<caption>Scheduled Orders</caption>
												<colgroup>
													<col width="25%" />
													<col width="15%" />
													<col width="10%" />
													<col width="25%" span="2" />
												</colgroup>
												<thead>
													<tr>
														<th>Name</th>
														<th>Type</th>
														<th>Priority</th>
														<th>Associated Diagnoses</th>
														<th>Order Schedule</th>
													</tr>
												</thead>
												<tbody>
													<tr ID="procedure26">
														<td>
															<content ID="procedure26name">Dialysis repeated evaluation</content>
														</td>
														<td>Dialysis</td>
														<td>Routine</td>
														<td>
															<paragraph ID="procedure26diagnosis1">Cancer of anal canal (CMS/HCC)</paragraph>
														</td>
														<td ID="procedure26schedule">Ordered: 07/13/2022</td>
													</tr>
													<tr ID="procedure27">
														<td>
															<content ID="procedure27name">Ultrasound hemodialysis access</content>
														</td>
														<td>Imaging</td>
														<td>Routine</td>
														<td>
															<paragraph ID="procedure27diagnosis1">Cancer of anal canal (CMS/HCC)</paragraph>
														</td>
														<td ID="procedure27schedule">Expected: 07/13/2022, Expires: 07/13/2023</td>
													</tr>
													<tr ID="procedure28">
														<td>
															<content ID="procedure28name">Hemodialysis outpatient</content>
														</td>
														<td>Dialysis</td>
														<td>STAT</td>
														<td>
															<paragraph ID="procedure28diagnosis1">Cancer of anal canal (CMS/HCC)</paragraph>
														</td>
														<td ID="procedure28schedule">Ordered: 07/13/2022</td>
													</tr>
												</tbody>
											</table>
											<footnote ID="subTitle24" styleCode="xSectionSubTitle">documented as of this encounter</footnote>
										</text>
										<entry>
											<procedure classCode="PROC" moodCode="INT">
												<templateId root="2.16.840.1.113883.10.20.22.4.41" />
												<templateId root="2.16.840.1.113883.10.20.22.4.41" extension="2014-06-09" />
												<templateId root="2.16.840.1.113883.10.20.22.4.41" extension="2022-06-01" />
												<id root="1.2.840.114350.1.13.11511.3.7.1.1988.1" extension="1104711^" />
												<code code="305" codeSystem="1.2.840.114350.1.13.11511.3.7.2.696580" codeSystemName="Epic.EAP.ID" displayName="Dialysis repeated evaluation">
													<originalText>
														<reference value="#procedure26name" />
													</originalText>
												</code>
												<text>
													<reference value="#procedure26" />
												</text>
												<statusCode code="active" />
												<author>
													<templateId root="2.16.840.1.113883.10.20.22.4.119" />
													<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
													<time value="20220713085807-0500" />
													<assignedAuthor>
														<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="200022573" />
														<id root="2.16.840.1.113883.4.6" extension="1000111876" />
														<code nullFlavor="OTH">
															<originalText>Anesthesiology</originalText>
															<translation code="5" codeSystem="1.2.840.114350.1.72.1.7.7.10.688867.4160" codeSystemName="Epic.DXC.StandardProviderSpecialtyType" displayName="Anesthesiology" />
															<translation code="2" codeSystem="1.2.840.114350.1.13.11511.3.7.10.836982.1050" codeSystemName="Epic.SER.ProviderSpecialty" displayName="Anesthesiology" />
														</code>
														<addr use="WP">
															<streetAddressLine>123 Anywhere Street</streetAddressLine>
															<county>DANE</county>
															<city>VERONA</city>
															<state>WI</state>
															<postalCode>53593</postalCode>
														</addr>
														<telecom use="WP" value="tel:+1-555-555-5555" />
														<assignedPerson>
															<name use="L">
																<given>Anesthesiologist</given>
																<given>Four</given>
																<family>Anesthesia</family>
																<suffix qualifier="AC"> MD</suffix>
																<validTime>
																	<low nullFlavor="UNK" />
																	<high nullFlavor="UNK" />
																</validTime>
															</name>
														</assignedPerson>
														<representedOrganization>
															<id root="2.16.840.1.113883.4.2" nullFlavor="UNK" />
															<id root="2.16.840.1.113883.4.6" nullFlavor="UNK" />
															<name>Epic Hospital System</name>
															<addr use="WP">
																<streetAddressLine>123 Anywhere St.</streetAddressLine>
																<city>VERONA</city>
																<state>WI</state>
																<postalCode>53593</postalCode>
															</addr>
														</representedOrganization>
													</assignedAuthor>
												</author>
												<entryRelationship typeCode="RSON">
													<observation classCode="OBS" moodCode="EVN">
														<templateId root="2.16.840.1.113883.10.20.22.4.19" />
														<templateId root="2.16.840.1.113883.10.20.22.4.19" extension="2014-06-09" />
														<id root="1.2.840.114350.1.13.11511.3.7.2.696871" extension="120279" />
														<code code="29308-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Diagnosis" />
														<statusCode code="completed" />
														<value code="255083005" codeSystem="2.16.840.1.113883.6.96" xsi:type="CD"
															xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
															<originalText>
																<reference value="#procedure26diagnosis1" />
															</originalText>
														</value>
													</observation>
												</entryRelationship>
												<entryRelationship typeCode="COMP">
													<act classCode="ACT" moodCode="EVN">
														<templateId root="2.16.840.1.113883.10.20.22.4.64" />
														<code code="48767-8" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Annotation comment" />
														<text>
															<reference value="#procedure26schedule" />
														</text>
														<statusCode code="completed" />
													</act>
												</entryRelationship>
											</procedure>
										</entry>
										<entry>
											<procedure classCode="PROC" moodCode="INT">
												<templateId root="2.16.840.1.113883.10.20.22.4.41" />
												<templateId root="2.16.840.1.113883.10.20.22.4.41" extension="2014-06-09" />
												<templateId root="2.16.840.1.113883.10.20.22.4.41" extension="2022-06-01" />
												<id root="1.2.840.114350.1.13.11511.3.7.1.1988.1" extension="1104712^" />
												<code code="62358" codeSystem="1.2.840.114350.1.13.11511.3.7.2.696580" codeSystemName="Epic.EAP.ID" displayName="Ultrasound hemodialysis access">
													<originalText>
														<reference value="#procedure27name" />
													</originalText>
												</code>
												<text>
													<reference value="#procedure27" />
												</text>
												<statusCode code="active" />
												<effectiveTime>
													<low value="20220713" />
													<high value="20230713" />
												</effectiveTime>
												<author>
													<templateId root="2.16.840.1.113883.10.20.22.4.119" />
													<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
													<time value="20220713085807-0500" />
													<assignedAuthor>
														<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="200022573" />
														<id root="2.16.840.1.113883.4.6" extension="1000111876" />
													</assignedAuthor>
												</author>
												<entryRelationship typeCode="RSON">
													<observation classCode="OBS" moodCode="EVN">
														<templateId root="2.16.840.1.113883.10.20.22.4.19" />
														<templateId root="2.16.840.1.113883.10.20.22.4.19" extension="2014-06-09" />
														<id root="1.2.840.114350.1.13.11511.3.7.2.696871" extension="120279" />
														<code code="29308-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Diagnosis" />
														<statusCode code="completed" />
														<value code="255083005" codeSystem="2.16.840.1.113883.6.96" xsi:type="CD"
															xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
															<originalText>
																<reference value="#procedure27diagnosis1" />
															</originalText>
														</value>
													</observation>
												</entryRelationship>
												<entryRelationship typeCode="COMP">
													<act classCode="ACT" moodCode="EVN">
														<templateId root="2.16.840.1.113883.10.20.22.4.64" />
														<code code="48767-8" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Annotation comment" />
														<text>
															<reference value="#procedure27schedule" />
														</text>
														<statusCode code="completed" />
													</act>
												</entryRelationship>
											</procedure>
										</entry>
										<entry>
											<procedure classCode="PROC" moodCode="INT">
												<templateId root="2.16.840.1.113883.10.20.22.4.41" />
												<templateId root="2.16.840.1.113883.10.20.22.4.41" extension="2014-06-09" />
												<templateId root="2.16.840.1.113883.10.20.22.4.41" extension="2022-06-01" />
												<id root="1.2.840.114350.1.13.11511.3.7.1.1988.1" extension="1104713^" />
												<code code="303" codeSystem="1.2.840.114350.1.13.11511.3.7.2.696580" codeSystemName="Epic.EAP.ID" displayName="Hemodialysis outpatient">
													<originalText>
														<reference value="#procedure28name" />
													</originalText>
												</code>
												<text>
													<reference value="#procedure28" />
												</text>
												<statusCode code="active" />
												<author>
													<templateId root="2.16.840.1.113883.10.20.22.4.119" />
													<templateId root="2.16.840.1.113883.10.20.22.5.6" extension="2019-10-01" />
													<time value="20220713085807-0500" />
													<assignedAuthor>
														<id root="1.2.840.114350.1.13.11511.3.7.1.1133" extension="200022573" />
														<id root="2.16.840.1.113883.4.6" extension="1000111876" />
													</assignedAuthor>
												</author>
												<entryRelationship typeCode="RSON">
													<observation classCode="OBS" moodCode="EVN">
														<templateId root="2.16.840.1.113883.10.20.22.4.19" />
														<templateId root="2.16.840.1.113883.10.20.22.4.19" extension="2014-06-09" />
														<id root="1.2.840.114350.1.13.11511.3.7.2.696871" extension="120279" />
														<code code="29308-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Diagnosis" />
														<statusCode code="completed" />
														<value code="255083005" codeSystem="2.16.840.1.113883.6.96" xsi:type="CD"
															xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
															<originalText>
																<reference value="#procedure28diagnosis1" />
															</originalText>
														</value>
													</observation>
												</entryRelationship>
												<entryRelationship typeCode="COMP">
													<act classCode="ACT" moodCode="EVN">
														<templateId root="2.16.840.1.113883.10.20.22.4.64" />
														<code code="48767-8" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Annotation comment" />
														<text>
															<reference value="#procedure28schedule" />
														</text>
														<statusCode code="completed" />
													</act>
												</entryRelationship>
											</procedure>
										</entry>
									</section>
								</component>
								<component>
									<section>
										<templateId root="2.16.840.1.113883.10.20.22.2.8" />
										<id root="00000000-0000-F24E-5161-4E497785491D" />
										<code code="51848-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Assessments" />
										<title>Visit Diagnoses</title>
										<text>
											<table>
												<colgroup>
													<col width="100%" />
												</colgroup>
												<thead>
													<tr>
														<th>Diagnosis</th>
													</tr>
												</thead>
												<tbody>
													<tr ID="vdx2" styleCode="xRowNormal">
														<td>
															<paragraph>
																<content ID="vdx2Name">Cancer of anal canal (CMS/HCC)</content>
																<content> - Primary</content>
															</paragraph>
															<paragraph styleCode="xallIndent">Malignant neoplasm of anal canal</paragraph>
														</td>
													</tr>
												</tbody>
											</table>
											<footnote ID="subTitle33" styleCode="xSectionSubTitle">documented in this encounter</footnote>
										</text>
									</section>
								</component>
							</structuredBody>
						</component>
					</ClinicalDocument>`;
  return patient_doc;
}
