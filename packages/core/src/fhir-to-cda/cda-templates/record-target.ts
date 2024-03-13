import { XMLBuilder } from "fast-xml-parser";
import { Patient } from "@medplum/fhirtypes";
 
export function constructRecordTargetFromFhirPatient(patient: Patient): string {
  const jsonObj = {
    recordTarget: {
      patientRole: {
        id: patient.identifier?.map(id => ({
          "@_root": id.system,
          "@_extension": id.value,
          "@_assigningAuthorityName": id.assigner?.display
        })),
        addr: patient.address?.map(addr => ({
            "@_use": addr.use,
            streetAddressLine: addr.line?.join(' '),
            city: addr.city,
            state: addr.state,
            postalCode: addr.postalCode,
            country: addr.country,
            useablePeriod: {
              "@_xsi:type": "IVL_TS",
              "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
              low: {"@_value": addr.period?.start},
              high: {"@_nullFlavor": addr.period?.end ? addr.period.end : "UNK"}
            }
          }))[0],
        telecom: patient.telecom?.map(telecom => ({
          "@_use": telecom.use,
          "@_value": telecom.value
        }))[0],
        patient: {
          name: patient.name?.map(name => ({
            "@_use": name.use,
            given: name.given?.join(' '),
            family: name.family,
            // Assuming validTime mapping requires specific handling; this is a placeholder
            validTime: {
              low: {"@_nullFlavor": "UNK"},
              high: {"@_nullFlavor": "UNK"}
            }
          }))[0], // Taking the first name for simplicity; adjust as needed
          administrativeGenderCode: {
            "@_code": patient.gender,
            "@_codeSystem": "2.16.840.1.113883.5.1"
            // Add other attributes as needed
          },
          birthTime: {
            "@_value": patient.birthDate
          },
        },
      }
    }
  };

  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false
  });

  return builder.build(jsonObj);
}
