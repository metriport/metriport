import { Bundle, DocumentReference } from "@medplum/fhirtypes";
import { HapiFhirClient } from "@metriport/core/external/fhir/api/api-hapi";
import { capture } from "../../../shared/notifications";
import { makeFhirApi } from "../api/api-factory";
import { isoDateToFHIRDateQueryFrom, isoDateToFHIRDateQueryTo } from "../shared";
import {
  PaginatedFHIRRequest,
  PaginatedFHIRRequestParams,
  PaginatedFHIRResponse,
} from "../shared/paginated";

const minItemsPerPage = 1;
const maxItemsPerPage = 100;

export async function getDocuments({
  cxId,
  patientId,
  from,
  to,
  documentIds,
}: {
  cxId: string;
  patientId: string;
  from?: string;
  to?: string;
  documentIds?: string[];
}): Promise<DocumentReference[]> {
  try {
    // const api = makeFhirApi(cxId);
    const api = new HapiFhirClient(
      cxId,
      "http://internal-FHIRS-FHIRS-5XE17T7B1DKI-1065222344.us-west-1.elb.amazonaws.com"
    );
    const filtersAsStr = getFilters({ patientId, documentIds, from, to });
    const docs: DocumentReference[] = [];

    let count = 0;
    let lastStartAt = Date.now();
    for await (const page of api.searchResourcePages("DocumentReference", filtersAsStr)) {
      console.log(`Page ${++count} - ${Date.now() - lastStartAt}ms`);
      docs.push(...page);
      lastStartAt = Date.now();
    }
    return docs;
  } catch (error) {
    const msg = `Error getting documents from FHIR server`;
    console.log(`${msg} - patientId: ${patientId}, error: ${error}`);
    capture.message(msg, { extra: { patientId, error }, level: "error" });
    throw error;
  }
}

export async function getDocumentsPaginated({
  cxId,
  patientId,
  from,
  to,
  documentIds,
  pagination,
}: PaginatedFHIRRequest<{
  cxId: string;
  patientId: string;
  from?: string;
  to?: string;
  documentIds?: string[];
}>): Promise<PaginatedFHIRResponse<DocumentReference[]>> {
  try {
    // TODO 1032 clean this up
    const api = makeFhirApi(cxId);
    // const api = new HapiFhirClient(
    //   cxId,
    //   // "http://internal-FHIRS-FHIRS-5XE17T7B1DKI-1065222344.us-west-1.elb.amazonaws.com"
    // );
    const filtersAsStr = getFilters({ patientId, documentIds, from, to, pagination });
    const bundle = await api.search("DocumentReference", filtersAsStr);
    const docs: DocumentReference[] = bundle.entry?.flatMap(e => e.resource ?? []) ?? [];

    const {
      offset: nextOffset,
      paginationId: nextPaginationId,
      count: nextCount,
    } = getPaginationFromBundle(bundle, "next") ?? {};
    const {
      offset: prevOffset,
      paginationId: prevPaginationId,
      count: prevCount,
    } = getPaginationFromBundle(bundle, "previous") ?? {};

    return {
      pagination: {
        paginationId: nextPaginationId ?? prevPaginationId,
        nextOffset,
        previousOffset: prevOffset,
        itemsPerPage: nextCount ?? prevCount,
      },
      data: docs,
    };
  } catch (error) {
    const msg = `Error getting documents from FHIR server`;
    console.log(`${msg} - patientId: ${patientId}, error: ${error}`);
    capture.message(msg, { extra: { patientId, error }, level: "error" });
    throw error;
  }
}

function getPaginationFromBundle(
  bundle: Bundle,
  field: "next" | "previous"
): { offset: number; paginationId: string; count: number | undefined } | undefined {
  const propRaw = bundle.link?.find(l => l.relation === field)?.url;
  const offset = propRaw && new URL(propRaw).searchParams.get("_getpagesoffset");
  const paginationId = propRaw && new URL(propRaw).searchParams.get("_getpages");
  const count = propRaw && new URL(propRaw).searchParams.get("_count");
  return offset && paginationId
    ? { offset: parseInt(offset), paginationId, count: count ? parseInt(count) : undefined }
    : undefined;
}

export function getFilters({
  patientId,
  documentIds = [],
  from,
  to,
  pagination,
}: {
  patientId?: string;
  documentIds?: string[];
  from?: string;
  to?: string;
  pagination?: PaginatedFHIRRequestParams;
} = {}) {
  const filters = new URLSearchParams();
  patientId && filters.append("patient", patientId);
  documentIds.length && filters.append(`_ids`, documentIds.join(","));
  from && filters.append("date", isoDateToFHIRDateQueryFrom(from));
  to && filters.append("date", isoDateToFHIRDateQueryTo(to));

  if (pagination) {
    const { paginationId, offset, itemsPerPage = maxItemsPerPage } = pagination;
    offset != null && filters.append("_getpages", paginationId);
    offset != null && filters.append("_getpagesoffset", Math.max(offset, 0).toString());
    filters.append("_count", Math.max(itemsPerPage, minItemsPerPage).toString());
  } else {
    filters.append("_count", maxItemsPerPage.toString());
  }
  const filtersAsStr = filters.toString();
  return filtersAsStr;
}
