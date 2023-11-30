import { Config } from "../../shared/config";
import { CQOrgDetails } from "./organization";
import { buildMockOrganizationFromTemplate } from "./organization-mock-template";

export function createMockCQOrganization(): string {
  const cqOrgDetailsString = Config.getCQOrgDetails();
  const cqOrgDetails: CQOrgDetails = cqOrgDetailsString
    ? JSON.parse(cqOrgDetailsString)
    : undefined;
  if (!cqOrgDetails) {
    const msg = "No CQ Organization details found. Skipping...";
    console.log(msg);
    throw new Error(msg);
  }

  const oid = generateRandomOID();
  const { lat, lon } = generateRandomLatLongUS();

  cqOrgDetails.oid = oid;
  cqOrgDetails.name = `Mock Org ${oid}`;
  cqOrgDetails.lat = lat.toString();
  cqOrgDetails.lon = lon.toString();

  const org = buildMockOrganizationFromTemplate(cqOrgDetails);
  return org;
}

function generateRandomOID() {
  const parts = [];
  const length = Math.floor(Math.random() * 10) + 1;

  for (let i = 0; i < length; i++) {
    parts.push(Math.floor(Math.random() * 10000));
  }

  return parts.join(".");
}

function generateRandomLatLongUS() {
  const latMin = 24;
  const latMax = 49;
  const longMin = -125.0;
  const longMax = -67.0;

  const lat = Math.random() * (latMax - latMin) + latMin;
  const lon = Math.random() * (longMax - longMin) + longMin;

  return { lat, lon };
}
