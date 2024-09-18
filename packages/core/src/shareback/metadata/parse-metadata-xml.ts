import { Coding, DocumentReference, DocumentReferenceContent } from "@medplum/fhirtypes";
import { parseStringPromise } from "xml2js";
import { metriportDataSourceExtension } from "../../external/fhir/shared/extensions/metriport";
import { base64ToString } from "../../util/base64";
import {
  XDSDocumentEntryClassCode,
  XDSDocumentEntryHealthcareFacilityTypeCode,
  XDSDocumentEntryPracticeSettingCode,
  XDSDocumentEntryUniqueId,
} from "./constants";

interface ExtrinsicObjectXMLData {
  ExtrinsicObject: {
    $: { id: string; mimeType: string };
    Slot: { $: { name: string }; ValueList: { Value: string[] }[] }[];
    Classification: {
      $: { classificationScheme: string; nodeRepresentation: string };
      Name?: { LocalizedString: { $: { value: string } }[] };
    }[];
    ExternalIdentifier: {
      $: { identificationScheme: string; value: string };
      Name: { LocalizedString: { $: { value: string } }[] };
    }[];
  };
}

export async function parseExtrinsicObjectXmlToDocumentReference(
  xml: string,
  patientId: string,
  docContributionURL: string
): Promise<DocumentReference> {
  const parsedXml: ExtrinsicObjectXMLData = await parseStringPromise(xml);
  const extrinsicObject = parsedXml.ExtrinsicObject;

  const docRefContent: DocumentReferenceContent = {
    attachment: {
      contentType: extrinsicObject.$.mimeType,
    },
    extension: [metriportDataSourceExtension],
  };
  const documentReference: DocumentReference = {
    resourceType: "DocumentReference",
    id: extrinsicObject.$.id,
    status: "current",
    subject: {
      reference: `Patient/${patientId}`,
    },
    extension: [metriportDataSourceExtension],
  };

  extrinsicObject.Slot.forEach(slot => {
    const slotName = slot.$.name;
    const slotValue = slot.ValueList[0]?.Value[0];

    if (slotValue) {
      switch (slotName) {
        case "creationTime":
          documentReference.date = slotValue;
          break;
        case "repositoryUniqueId":
          documentReference.identifier = [
            {
              system: "urn:ietf:rfc:3986",
              value: slotValue,
            },
          ];
          break;
        case "size":
          docRefContent.attachment = {
            ...docRefContent.attachment,
            size: parseInt(slotValue, 10),
          };
          break;
      }
    }
  });

  extrinsicObject.Classification.forEach(classification => {
    const code = classification.$.nodeRepresentation;
    const display = classification.Name?.LocalizedString?.[0]?.$.value;
    const primaryCoding: Coding = { code };
    if (display) primaryCoding.display = display;

    switch (classification.$.classificationScheme) {
      case XDSDocumentEntryClassCode:
        documentReference.type = {
          coding: [primaryCoding],
        };
        break;
      case XDSDocumentEntryPracticeSettingCode:
        documentReference.context = documentReference.context || {};
        documentReference.context.practiceSetting = {
          coding: [primaryCoding],
        };
        break;
      case XDSDocumentEntryHealthcareFacilityTypeCode:
        documentReference.context = documentReference.context || {};
        documentReference.context.facilityType = {
          coding: [primaryCoding],
        };
        break;
    }
  });

  extrinsicObject.ExternalIdentifier.forEach(identifier => {
    const value = identifier.$.value;

    switch (identifier.$.identificationScheme) {
      case XDSDocumentEntryUniqueId:
        documentReference.masterIdentifier = {
          system: "urn:ietf:rfc:3986",
          value,
        };
        docRefContent.attachment = {
          ...docRefContent.attachment,
          url: `${docContributionURL}${encodeURIComponent(base64ToString(value))}`,
        };
        break;
    }
  });

  documentReference.content = [docRefContent];
  return documentReference;
}
