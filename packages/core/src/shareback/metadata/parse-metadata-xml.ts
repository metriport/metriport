import { Coding, DocumentReference, DocumentReferenceContent } from "@medplum/fhirtypes";
import { decodeDocumentId } from "@metriport/shared";
import { basicToExtendedIso8601, buildDayjs } from "@metriport/shared/common/date";
import { isCommonwellNewDocumentIdFormatEnabled } from "../../command/feature-flags/domain-ffs";
import { metriportDataSourceExtension } from "../../external/fhir/shared/extensions/metriport";
import { getFilePathFromDocumentId } from "../../shareback/file";
import { Config } from "../../util/config";
import { cleanupAndParseXmlString } from "../../util/xml";
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
      Slot?: { ValueList?: { Value?: string } };
    }[];
    ExternalIdentifier: {
      $: { identificationScheme: string; value: string };
      Name: { LocalizedString: { $: { value: string } }[] };
    }[];
  };
}

export async function parseMetadataXmlToDocumentReference({
  patientId,
  xmlContents,
}: {
  patientId: string;
  xmlContents: string;
}): Promise<DocumentReference> {
  /**
   * TODO We should parse XMLs the same way as much as possible. Other places that work with XMLs
   * are using createXMLParser(), which indexes XML properties differently.
   */
  const parsedXml: ExtrinsicObjectXMLData = await cleanupAndParseXmlString(xmlContents);
  const extrinsicObject = parsedXml.ExtrinsicObject;

  const docRefContent: DocumentReferenceContent = {
    extension: [metriportDataSourceExtension],
    attachment: {
      contentType: extrinsicObject.$.mimeType,
    },
  };
  const documentReference: DocumentReference = {
    resourceType: "DocumentReference",
    id: extrinsicObject.$.id,
    extension: [metriportDataSourceExtension],
    masterIdentifier: {
      system: "urn:ietf:rfc:3986",
      value: extrinsicObject.$.id,
    },
    status: "current",
    docStatus: "final",
    subject: {
      reference: `Patient/${patientId}`,
    },
  };

  extrinsicObject.Slot.forEach(slot => {
    const slotName = slot.$.name;
    const slotValue = slot.ValueList[0]?.Value[0];

    if (slotValue) {
      switch (slotName) {
        case "creationTime":
          try {
            const datetimeInExtended = basicToExtendedIso8601(slotValue);
            // Needed because `basicToExtendedIso8601` returns datetime w/o TZ
            const datetimeInIso = buildDayjs(datetimeInExtended).toISOString();
            documentReference.date = datetimeInIso;
          } catch (error) {
            documentReference.date = slotValue;
          }
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
    const code = classification?.Slot?.ValueList?.Value ?? classification.$.nodeRepresentation;
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

  /**
   * TODO Once we update this function to use createXMLParser() we can update the logic below
   * to use getEncodedDocumentIdFromMetadataXml() from get-metadata-xml.ts (and move it here),
   * instead of having two different ways to get the document ID from the XML/json object.
   */
  for (const identifier of extrinsicObject.ExternalIdentifier) {
    switch (identifier.$.identificationScheme) {
      case XDSDocumentEntryUniqueId: {
        const decodedDocumentId = decodeDocumentId(identifier.$.value);
        const [filePath, isNewDocIdFormatEnabled] = await Promise.all([
          getFilePathFromDocumentId(decodedDocumentId),
          isCommonwellNewDocumentIdFormatEnabled(),
        ]);
        const docId = isNewDocIdFormatEnabled ? decodedDocumentId : filePath;
        docRefContent.attachment = {
          ...docRefContent.attachment,
          // This is being replaced downstream on adjustAttachmentURLs() - consider merging those to avoid unnecessary code
          url: `https://${Config.getMedicalDocumentsBucketName()}.s3.${Config.getAWSRegion()}.amazonaws.com/${docId}`,
          title: docId,
        };
        break;
      }
    }
  }
  documentReference.content = [docRefContent];
  return documentReference;
}
