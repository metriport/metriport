import { DocumentReference, DocumentReferenceContent } from "@medplum/fhirtypes";
import { ISO_DATE } from "@metriport/shared/common/date";
import {
  bytesToSize,
  formatDate,
  getResourcesFromBundle,
  MappedConsolidatedResources,
  SectionKey,
} from "..";

const METRIPORT_CODE = "METRIPORT";

export type DocumentRowData = {
  id: string;
  fileName: string;
  description: string;
  size: string;
  fileType: string;
  organization: string;
  date: string;
};

export function buildDocumentTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const documents = getResourcesFromBundle<DocumentReference>(bundle, "DocumentReference");
  return {
    key: "documents" as SectionKey,
    rowData: getDocumentRowData({ documents }),
  };
}

function getDocumentRowData({ documents }: { documents: DocumentReference[] }): DocumentRowData[] {
  return documents?.map(documentReference => {
    const metriportContent = getMetriportContent(documentReference);
    const contentType = metriportContent?.attachment?.contentType;
    const fileName = metriportContent?.attachment?.title;

    return {
      id: documentReference.id ?? "-",
      fileName: fileName ?? "-",
      description: documentReference.description ?? "-",
      size: getDocumentSize(documentReference),
      fileType: contentType ?? "-",
      organization: getOrganizationName(documentReference),
      date: documentReference.date ? formatDate(documentReference.date, ISO_DATE) : "-",
    };
  });
}

export function getDocumentSize(doc: DocumentReference): string {
  if (doc.content) {
    const metriportContent = doc.content.find(isMetriportContent);

    if (metriportContent?.attachment?.size) {
      return bytesToSize(metriportContent.attachment.size);
    }

    return "-";
  }

  return "-";
}

export function getMetriportContent(doc: DocumentReference): DocumentReferenceContent | undefined {
  if (!doc || !doc.content) return undefined;

  const contents = doc.content.filter(isMetriportContent);
  // B64 Attachment Extension
  if (
    contents.length === 0 &&
    doc.extension?.some(ext => ext.url?.endsWith("doc-id-extension.json"))
  ) {
    return doc.content[0];
  }
  return contents[0];
}

function isMetriportContent(content: DocumentReferenceContent): boolean {
  return !!content.extension?.some(ext => ext.valueCoding?.code === METRIPORT_CODE);
}

export function getOrganizationName(doc: DocumentReference): string {
  if (doc.contained) {
    const org = doc.contained.flatMap(c => (c.resourceType === "Organization" ? c : []))[0];
    if (org?.name) return org.name;

    return "-";
  }
  return "-";
}
