import { AddressStrict, AddressWithCoordinates } from "@metriport/core/domain/location-address";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { addCoordinatesToAddresses } from "../../command/medical/patient/add-coordinates";

export async function getAddressWithCoordinates(
  inputAddress: AddressStrict,
  cxId: string
): Promise<AddressWithCoordinates> {
  const addresses = await addCoordinatesToAddresses({
    addresses: [inputAddress],
    cxId,
  });
  const address = (addresses ?? [])[0];
  if (!address) throw new Error("Failed to geocode the address");
  if (!address.coordinates) {
    throw new MetriportError(`Missing coordinates for address`, undefined, {
      address: JSON.stringify(address),
    });
  }
  const { lat, lon } = address.coordinates;
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    zip: address.zip,
    country: address.country ?? "USA",
    lat: lat.toString(),
    lon: lon.toString(),
  };
}
