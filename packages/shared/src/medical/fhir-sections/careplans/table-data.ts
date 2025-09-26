import {
  Address,
  CarePlan,
  Condition,
  Location,
  Organization,
  Practitioner,
  Reference,
} from "@medplum/fhirtypes";
import { buildDayjs, ISO_DATE, validateIsPastOrPresentSafe } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import {
  getReferenceResource,
  getResourcesFromBundle,
  MappedConsolidatedResources,
  SectionKey,
} from "..";

export type CarePlanRowData = {
  id: string;
  description: string;
  practitionerName: string;
  locationDetails: string;
  authorOrganizationDetails: string;
  date: string;
  isUpcoming: boolean;
  rawDate?: dayjs.Dayjs | undefined;
  rawEndDate?: dayjs.Dayjs | undefined;
  practitioner?: Practitioner | undefined;
  organization?: Organization | undefined;
  location?: Location | undefined;
  conditions?: Condition[] | undefined;
};

export function carePlanTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const detailedCarePlans = getCarePlansAndRelatedResources(bundle);
  return { key: "careplans" as SectionKey, rowData: getCarePlanRowData({ detailedCarePlans }) };
}

type DetailedCarePlan = {
  carePlan: CarePlan;
  practitioner?: Practitioner;
  organization?: Organization;
  conditions?: Condition[];
  location?: Location;
  practitionerName?: string;
  organizationDetails?: string;
  locationDetails?: string;
};

function getCarePlansAndRelatedResources(
  bundle: MappedConsolidatedResources | undefined
): DetailedCarePlan[] {
  const carePlans = getResourcesFromBundle<CarePlan>(bundle, "CarePlan");
  return carePlans.map(cp => {
    const detailedCarePlan: DetailedCarePlan = {
      carePlan: cp,
    };

    const authorRef = cp.author;
    if (authorRef && authorRef.reference?.startsWith("Organization/")) {
      const organization = getReferenceResource<Organization>(authorRef, "Organization", bundle);
      organization && (detailedCarePlan.organization = organization);
      detailedCarePlan.organizationDetails = getOrganizationDetails(organization);
    }

    const activityDetails = cp.activity?.[0]?.detail;
    const practitionerRef = activityDetails?.performer?.find(p =>
      p.reference?.startsWith("Practitioner/")
    ) as Reference<Practitioner> | undefined;
    if (practitionerRef?.reference) {
      const practitioner = getReferenceResource<Practitioner>(
        practitionerRef,
        "Practitioner",
        bundle
      );
      practitioner && (detailedCarePlan.practitioner = practitioner);
      detailedCarePlan.practitionerName = getPractitionerDetails(practitioner);
    }

    const locationRef = activityDetails?.location;
    if (locationRef?.reference) {
      const location = getReferenceResource<Location>(locationRef, "Location", bundle);
      location && (detailedCarePlan.location = location);
      detailedCarePlan.locationDetails = getLocationDetails(location);
    }

    const conditionRefs = cp.addresses;
    if (conditionRefs && conditionRefs.length > 0) {
      const conditions = conditionRefs.flatMap(ref => {
        const condition = getReferenceResource<Condition>(ref, "Condition", bundle);
        return condition ?? [];
      });
      detailedCarePlan.conditions = conditions;
    }

    return detailedCarePlan;
  });
}

function getOrganizationDetails(organization: Organization | undefined): string {
  return organization?.name ?? "-";
}

function getPractitionerDetails(practitioner: Practitioner | undefined): string {
  let detailsString = practitioner?.name?.[0]?.given?.join(" ");
  if (practitioner?.name?.[0]?.family) detailsString += ` ${practitioner?.name?.[0]?.family}`;

  const qualifications = practitioner?.qualification
    ?.map(q => q.code?.coding?.[0]?.display)
    .join(", ");

  if (qualifications) detailsString += ` (${qualifications})`;
  return detailsString ?? "-";
}

function getLocationDetails(location: Location | undefined): string {
  const name = location?.name ?? "-";
  const address = getAddressDetails(location?.address);
  return `${name} ${address ? `(${address})` : ""}`;
}

function getAddressDetails(addr: Address | undefined): string | undefined {
  if (!addr) return undefined;

  const { line, city, state, postalCode } = addr;
  const addressParts = [line?.join(", "), city, state, postalCode].filter(Boolean);
  return addressParts.length > 0 ? addressParts.join(", ") : undefined;
}

function getCarePlanRowData({
  detailedCarePlans,
}: {
  detailedCarePlans: DetailedCarePlan[];
}): CarePlanRowData[] {
  return detailedCarePlans?.flatMap(d => {
    const carePlan = d.carePlan;
    const activityDetails = carePlan.activity?.[0]?.detail;
    const startDate = activityDetails?.scheduledPeriod?.start;
    const date = startDate ? buildDayjs(startDate) : undefined;
    const formattedStartDate = date?.format(ISO_DATE);
    if (!date || !formattedStartDate) return [];

    const endDate = activityDetails?.scheduledPeriod?.end;
    const end = endDate ? buildDayjs(endDate) : undefined;

    return {
      id: carePlan.id ?? "-",
      title: activityDetails?.description ?? "-",
      description: getCarePlanDescription(carePlan),
      practitionerName: d.practitionerName ?? "-",
      locationDetails: d.locationDetails ?? "-",
      authorOrganizationDetails: d.organizationDetails ?? "-",
      date: formattedStartDate,
      isUpcoming: !validateIsPastOrPresentSafe(formattedStartDate),
      rawDate: date,
      rawEndDate: end,
      practitioner: d.practitioner,
      organization: d.organization,
      location: d.location,
      conditions: d.conditions,
    };
  });
}

function getCarePlanDescription(carePlan: CarePlan) {
  const activityDetails = carePlan.activity?.[0]?.detail;
  return `${carePlan.description}${
    activityDetails?.description ? ` - ${activityDetails.description}` : ""
  }`;
}
