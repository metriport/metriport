// import { XMLBuilder } from "fast-xml-parser";
import { Patient } from "@medplum/fhirtypes";
import { withNullFlavor, withNullFlavorObject } from "./utils";

export function constructRecordTargetFromFhirPatient(patient: Patient): unknown {
  const recordTarget = {
    patientRole: {
      id: patient.identifier?.map(id => ({
        ...withNullFlavorObject(id.system, "@_root"),
        ...withNullFlavorObject(id.value, "@_extension"),
        ...withNullFlavorObject(id.assigner?.display, "@_assigningAuthorityName"),
      })),
      addr: patient.address?.map(addr => ({
        ...withNullFlavorObject(addr.use, "@_use"),
        streetAddressLine: withNullFlavor(addr.line?.join(" ")),
        city: withNullFlavor(addr.city),
        state: withNullFlavor(addr.state),
        postalCode: withNullFlavor(addr.postalCode),
        country: withNullFlavor(addr.country),
        useablePeriod: {
          "@_xsi:type": "IVL_TS",
          "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          low: withNullFlavor(addr.period?.start, "@_value"),
          high: withNullFlavor(addr.period?.end, "@_nullFlavor"),
        },
      }))[0],
      telecom: patient.telecom?.map(telecom => {
        return {
          ...withNullFlavorObject(telecom.use, "@_use"),
          ...withNullFlavorObject(telecom.value, "@_value"),
        };
      })[0],
      patient: {
        name: patient.name?.map(name => ({
          ...withNullFlavorObject(name.use, "@_use"),
          given: withNullFlavor(name.given?.join(" ")),
          family: withNullFlavor(name.family),
          validTime: {
            low: { "@_nullFlavor": "UNK" },
            high: { "@_nullFlavor": "UNK" },
          },
        }))[0],
        administrativeGenderCode: {
          ...withNullFlavorObject(patient.gender, "@_code"),
          "@_codeSystem": "2.16.840.1.113883.5.1",
        },
        birthTime: {
          ...withNullFlavorObject(patient.birthDate, "@_value"),
        },
        deceasedInd: withNullFlavorObject(patient.deceasedBoolean?.toString(), "@_value"),
        maritalStatusCode: {
          "@_code": patient.maritalStatus?.coding?.[0]?.code || "UNK",
          "@_codeSystem": "2.16.840.1.113883.5.2",
          "@_codeSystemName": "MaritalStatusCode",
          "@_displayName": patient.maritalStatus?.coding?.[0]?.display || "Unknown",
        },
        languageCommunication: {
          languageCode: withNullFlavorObject(
            patient.communication?.[0]?.language?.coding?.[0]?.code,
            "@_code"
          ),
        },
      },
    },
  };
  return recordTarget;
}
