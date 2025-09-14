import { Coverage, Organization } from "@medplum/fhirtypes";
import { getResourcesFromBundle, MappedConsolidatedResources, SectionKey } from "..";

export type CoverageRowData = {
  id: string;
  provider: string;
  policyId: string;
  status: string;
};

export function coverageTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const coverages = getResourcesFromBundle<Coverage>(bundle, "Coverage");
  const organizations = getResourcesFromBundle<Organization>(bundle, "Organization");
  return {
    key: "coverages" as SectionKey,
    rowData: getCoverageRowData({ coverages, organizations }),
  };
}

function getCoverageRowData({
  coverages,
  organizations,
}: {
  coverages: Coverage[];
  organizations: Organization[];
}): CoverageRowData[] {
  return coverages?.map(coverage => ({
    id: coverage.id ?? "-",
    provider: getCoverageOrganization(coverage, organizations),
    policyId: getPolicyId(coverage),
    status: coverage.status ?? "-",
  }));
}

function getCoverageOrganization(coverage: Coverage, organizations: Organization[]): string {
  const payorRef = coverage.payor?.[0]?.reference?.split("/")?.[1];

  if (payorRef) {
    const organization = organizations.find(org => org.id === payorRef);
    if (organization) {
      return organization.name ?? "-";
    }
  }

  return "-";
}

function getPolicyId(coverage: Coverage): string {
  const policyIdSet = new Set<string>();

  if (coverage.identifier) {
    for (const identifier of coverage.identifier) {
      if (identifier.value) {
        policyIdSet.add(identifier.value);
      }
    }
  }

  return Array.from(policyIdSet).join(", ");
}
