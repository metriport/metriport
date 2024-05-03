import { Address as FhirAddress, Organization } from "@medplum/fhirtypes";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { Address } from "@metriport/core/src/domain/address";
import { Contact } from "@metriport/core/src/domain/contact";
import { metriportOrganization } from "@metriport/shared/common/metriport-organization";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { OrganizationModel } from "../../models/medical/organization";
import { Config } from "../../shared/config";

const metriportOid = Config.getSystemRootOID();

export async function generateCcd({
  patientId,
  cxId,
}: {
  patientId: string;
  cxId: string;
}): Promise<string> {
  const organization = await getOrganizationOrFail({ cxId });
  const patient = await getPatientOrFail({ cxId, id: patientId });
  const data = patient.data;
  const address = data.address;
  const addresses = buildAddresses(address);
  const patientTelecom = buildTelecom(data.contact);
  const author = buildAuthor(organization);
  const custodian = buildCustodian(metriportOrganization);
  const structuredBody = buildStructuredBody();
  const currentTime = getCurrentDate();

  return `<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" moodCode="EVN">
	<realmCode code="US"/>
	<typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
	<templateId root="2.16.840.1.113883.10.20.22.1.1" extension="2015-08-01"/>
	<templateId root="2.16.840.1.113883.10.20.22.1.2" extension="2015-08-01"/>
	<id root="${metriportOid}" assigningAuthorityName="${metriportOrganization.name}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" displayName="Summarization of episode note" codeSystemName="LOINC"/>
	<title>Continuity of Care Document</title>
	<effectiveTime value="${currentTime}"/>
	<confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" displayName="Normal"/>
	<languageCode code="en-US"/>
	<recordTarget>
		<patientRole>
			<id root="${cxId}" extension="${patientId}"/>
			${addresses}
			${patientTelecom}
			<patient>
				<name use="L">
					<given>
						${data.firstName}
					</given>
					<family>
						${data.lastName}
					</family>
				</name>
				<administrativeGenderCode code="${
          data.genderAtBirth
        }" codeSystem="2.16.840.1.113883.5.1" codeSystemName="AdministrativeGender">
				</administrativeGenderCode>
				<birthTime value="${data.dob.replace(/-/g, "")}"/>
			</patient>
		</patientRole>
	</recordTarget>
  ${author}
  ${custodian}
  <component>
    ${structuredBody}
  </component>
</ClinicalDocument>
`;
}

function buildAddresses(addresses: Address[]): string {
  let addressesString = ``;
  addresses.forEach(addr => {
    addressesString += buildAddress(addr);
  });

  return addressesString;
}

function buildAddress(addr: Address | AddressStrict): string {
  let addressString = "";
  addressString += `<addr use="H">
  <streetAddressLine>
    ${addr.addressLine1}
  </streetAddressLine>`;
  if (addr.addressLine2) {
    addressString += `<streetAddressLine>
    ${addr.addressLine2}
  </streetAddressLine>`;
  }
  addressString += `<city>
      ${addr.city}
    </city>
    <state>
      ${addr.state}
    </state>
    <postalCode>
      ${addr.zip}
    </postalCode>
  </addr>`;

  return addressString;
}

function buildTelecom(contacts: Contact[] | undefined): string {
  if (!contacts) return "";

  let telecomString = ``;
  contacts.forEach(contact => {
    telecomString += `<telecom value="tel:${contact.phone}"/>`;
  });

  return telecomString;
}

function buildCustodianAddresses(address: FhirAddress): string {
  return `<addr>
    <streetAddressLine>
      ${address.line?.[0]}
    </streetAddressLine>
    <city>
      ${address.city}
    </city>
    <state>
      ${address.state}
    </state>
    <postalCode>
      ${address.postalCode}
    </postalCode>
    <country>
      US
    </country>
  </addr>`;
}

function buildAuthor(org: OrganizationModel) {
  const currentTime = getCurrentDate();
  const address = buildAddress(org.data.location);

  return `<author>
    <time value="${currentTime}"/>
    <assignedAuthor>
      <id root="${org.id}"/>
      ${address}
      <representedOrganization>
        <id nullFlavor="UNK">
        </id>
        <name>
          ${org.data.name}
        </name>
        ${address}
      </representedOrganization>
    </assignedAuthor>
  </author>`;
}

function buildCustodian(org: Organization): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const orgAddress = metriportOrganization.address![0]!;
  const address = buildCustodianAddresses(orgAddress);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const phoneNumber = org.telecom![0]!.value;
  return `<custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id nullFlavor="UNK"/>
        <name>Metriport</name>
        <telecom use="WP" value="${phoneNumber}"/>
        ${address}
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>`;
}

function getCurrentDate(): string {
  return new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
}

function buildStructuredBody(): string {
  return `<structuredBody>
    <component>
      <section nullFlavor="NI">
        <templateId root="2.16.840.1.113883.10.20.22.2.6" />
        <templateId root="2.16.840.1.113883.10.20.22.2.6" extension="2015-08-01" />
        <templateId root="2.16.840.1.113883.10.20.22.2.6.1" />
        <templateId root="2.16.840.1.113883.10.20.22.2.6.1" extension="2015-08-01" />
        <id root="89FA1B96-5F57-11EE-9453-0705AF1720AE" />
        <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Allergies and adverse reactions Document" />
        <title>
          Allergies
        </title>
        <text>
          <content ID="nof2">
            Not on File
          </content>
        </text>
      </section>
    </component>
    <component>
      <section nullFlavor="NI">
        <templateId root="2.16.840.1.113883.10.20.22.2.1" />
        <templateId root="2.16.840.1.113883.10.20.22.2.1" extension="2014-06-09" />
        <templateId root="2.16.840.1.113883.10.20.22.2.1.1" />
        <templateId root="2.16.840.1.113883.10.20.22.2.1.1" extension="2014-06-09" />
        <id root="89FB8850-5F57-11EE-9453-0705AF1720AE" />
        <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="History of Medication use Narrative" />
        <title>
          Medications
        </title>
        <text>
          <content ID="nof4">
            Not on file
          </content>
        </text>
      </section>
    </component>
    <component>
      <section nullFlavor="NI">
        <templateId root="2.16.840.1.113883.10.20.22.2.5" />
        <templateId root="2.16.840.1.113883.10.20.22.2.5" extension="2015-08-01" />
        <templateId root="2.16.840.1.113883.10.20.22.2.5.1" />
        <templateId root="2.16.840.1.113883.10.20.22.2.5.1" extension="2015-08-01" />
        <id root="89FBDFDA-5F57-11EE-9453-0705AF1720AE" />
        <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Problem list - Reported" />
        <title>
          Active Problems
        </title>
        <text>
          <paragraph ID="nof6">
            Not on file
          </paragraph>
        </text>
      </section>
    </component>
    <component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.17" />
        <templateId root="2.16.840.1.113883.10.20.22.2.17" extension="2015-08-01" />
        <code code="29762-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Social history Narrative" />
        <title>
          Social History
        </title>
        <text>
          <table ID="sochist10">
            <colgroup>
              <col span="2" width="25%" />
              <col width="13%" />
              <col width="12%" />
              <col width="25%" />
            </colgroup>
            <thead>
              <tr>
                <th>
                  Tobacco Use
                </th>
                <th>
                  Types
                </th>
                <th>
                  Packs/Day
                </th>
                <th>
                  Years Used
                </th>
                <th>
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Smoking Tobacco: Never Assessed
                </td>
                <td />
                <td ID="sochist10packsperday" />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
          <table>
            <colgroup>
              <col width="50%" />
              <col span="2" width="25%" />
            </colgroup>
            <thead>
              <tr>
                <th>
                  Sex and Gender Information
                </th>
                <th>
                  Value
                </th>
                <th>
                  Date Recorded
                </th>
              </tr>
            </thead>
            <tbody>
              <tr ID="BirthSex13">
                <td>
                  Sex Assigned at Birth
                </td>
                <td ID="BirthSex13Value">
                  Not on file
                </td>
                <td />
              </tr>
              <tr ID="GenderIdentity11">
                <td>
                  Gender Identity
                </td>
                <td ID="GenderIdentity11Value">
                  Not on file
                </td>
                <td />
              </tr>
              <tr ID="SexualOrientation12">
                <td>
                  Sexual Orientation
                </td>
                <td ID="SexualOrientation12Value">
                  Not on file
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </text>
        <entry>
          <observation classCode="OBS" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.22.4.78" />
            <templateId root="2.16.840.1.113883.10.20.22.4.78" extension="2014-06-09" />
            <id root="1.2.840.114350.1.13.551.2.7.1.1040.1" extension="Z16594545^^72166-2" />
            <code code="72166-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Tobacco smoking status NHIS" />
            <text>
              <reference value="#sochist10" />
            </text>
            <statusCode code="completed" />
            <effectiveTime nullFlavor="UNK" />
            <value code="266927001" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Tobacco smoking consumption unknown" xsi:type="CD" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />
          </observation>
        </entry>
        <entry>
          <observation classCode="OBS" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.22.4.200" extension="2016-06-01" />
            <id root="1.2.840.114350.1.13.551.2.7.1.1040.20" extension="Z16594545" />
            <code code="76689-9" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Sex Assigned At Birth" />
            <text>
              <reference value="#BirthSex13" />
            </text>
            <statusCode code="completed" />
            <effectiveTime value="19950901" />
            <value codeSystem="2.16.840.1.113883.5.1" xsi:type="CD" nullFlavor="UNK" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <originalText>
                <reference value="#BirthSex13Value" />
              </originalText>
            </value>
          </observation>
        </entry>
        <entry>
          <observation classCode="OBS" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.34.3.45" extension="2022-06-01" />
            <templateId root="2.16.840.1.113883.10.20.22.4.38" />
            <templateId root="2.16.840.1.113883.10.20.22.4.38" extension="2015-08-01" />
            <id nullFlavor="UNK" />
            <code code="76691-5" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Gender identity" />
            <text>
              <reference value="#GenderIdentity11" />
            </text>
            <statusCode code="completed" />
            <effectiveTime>
              <low nullFlavor="UNK" />
            </effectiveTime>
            <value xsi:type="CD" nullFlavor="UNK" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <originalText>
                <reference value="#GenderIdentity11Value" />
              </originalText>
            </value>
          </observation>
        </entry>
        <entry>
          <observation classCode="OBS" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.22.4.501" extension="2022-06-01" />
            <templateId root="2.16.840.1.113883.10.20.22.4.38" />
            <templateId root="2.16.840.1.113883.10.20.22.4.38" extension="2015-08-01" />
            <id nullFlavor="UNK" />
            <code code="76690-7" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Sexual orientation" />
            <text>
              <reference value="#SexualOrientation12" />
            </text>
            <statusCode code="completed" />
            <effectiveTime>
              <low nullFlavor="UNK" />
            </effectiveTime>
            <value xsi:type="CD" nullFlavor="UNK" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <originalText>
                <reference value="#SexualOrientation12Value" />
              </originalText>
            </value>
          </observation>
        </entry>
      </section>
    </component>
    <component>
      <section>
        <templateId root="2.16.840.1.113883.10.20.22.2.10" />
        <templateId root="2.16.840.1.113883.10.20.22.2.10" extension="2014-06-09" />
        <code code="18776-5" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Plan of care note" />
        <title>
          Plan of Treatment
        </title>
        <text>
          <paragraph>
            Not on file
          </paragraph>
        </text>
      </section>
    </component>
    <component>
      <section nullFlavor="NI">
        <templateId root="2.16.840.1.113883.10.20.22.2.3" />
        <templateId root="2.16.840.1.113883.10.20.22.2.3" extension="2015-08-01" />
        <templateId root="2.16.840.1.113883.10.20.22.2.3.1" />
        <templateId root="2.16.840.1.113883.10.20.22.2.3.1" extension="2015-08-01" />
        <id root="89FED6E0-5F57-11EE-9453-0705AF1720AE" />
        <code code="30954-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Relevant diagnostic tests/laboratory data Narrative" />
        <title>
          Results
        </title>
        <text>
          <content ID="nof21">
            Not on file
          </content>
          <footnote ID="subTitle20" styleCode="xSectionSubTitle">
            from Last 3 Months
          </footnote>
        </text>
      </section>
    </component>
  </structuredBody>`;
}
