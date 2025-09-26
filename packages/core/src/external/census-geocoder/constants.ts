export const CENSUS_GEOCODER_ADDRESS_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/address";
export const CENSUS_GEOCODER_ONE_LINE_ADDRESS_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
export const CENSUS_GEOCODER_BATCH_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";

export const CENSUS_GEOCODER_USER_AGENT = "Metriport/1.0";
export const CENSUS_GEOCODER_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "User-Agent": CENSUS_GEOCODER_USER_AGENT,
};
