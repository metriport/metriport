import _ from "lodash";
import { Address, ContactPoint, Location, Reference } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { getQuestDataSourceExtension } from "./shared";

export function getLocation(detail: ResponseDetail): Location {
  const name = getLocationName(detail);
  const address = getLocationAddress(detail);
  const telecom = getLocationTelecom(detail);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "Location",
    id: uuidv7(),
    status: "active",
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    ...(telecom ? { telecom } : {}),
    extension,
  };
}

export function getLocationReference(location: Location): Reference<Location> {
  return {
    reference: `Location/${location.id}`,
  };
}

function getLocationName(detail: ResponseDetail): string | undefined {
  if (!detail.orderingAccountName) return undefined;
  return detail.orderingAccountName;
}

function getLocationAddress(detail: ResponseDetail): Address | undefined {
  if (
    !detail.orderingAccountAddressLine1 ||
    !detail.orderingAccountCity ||
    !detail.orderingAccountState ||
    !detail.orderingAccountZipCode
  )
    return undefined;

  return {
    city: detail.orderingAccountCity,
    state: detail.orderingAccountState,
    postalCode: detail.orderingAccountZipCode,
    line: _([detail.orderingAccountAddressLine1, detail.orderingAccountAddressLine2])
      .compact()
      .value(),
  };
}

function getLocationTelecom(detail: ResponseDetail): ContactPoint[] | undefined {
  if (!detail.orderingAccountPhoneNumber) return undefined;

  return [
    {
      system: "phone",
      value: detail.orderingAccountPhoneNumber,
    },
  ];
}
