import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { once } from "events";
import fs from "fs";
import path from "path";
import { QueryTypes } from "sequelize";
import { getEnvVarOrFail } from "../../../api/src/shared/config";
// import { distance as getLevenshtein } from "fastest-levenshtein";
import jaroWinkler from "jaro-winkler";

const DB_CREDS = getEnvVarOrFail("DB_CREDS");
const DB_ENDPOINT = getEnvVarOrFail("DB_ENDPOINT");
const db = initReadonlyDbPool(DB_CREDS, DB_ENDPOINT);

const commonTermsRegex =
  /(clinic|center|medical|health|hospital|system|systems|care|institute|of|and)/g;

const csvWriter = createObjectCsvWriter({
  path: "orgMatchingOutput.csv",
  header: [
    { id: "fullOrgName", title: "Full Org Name" },
    { id: "standardizedName", title: "Standardized Name" },
    { id: "cwMatch", title: "CW Match" },
    { id: "cwNames", title: "CW Names" },
    { id: "cqMatch", title: "CQ Match" },
    { id: "cqNames", title: "CQ Names" },
  ],
  append: true,
});

const clinicPath = "clinics.csv";
const cwOrgsPath = "cw_orgs.csv";

type CwOrganization = {
  fullname: string;
  shorterName: string | undefined;
  name: string | undefined;
  dr: string | undefined;
  networkType: string | undefined;
  id: string | undefined;
  state: string | undefined;
  zip: string | undefined;
};

type CqOrganization = {
  id: string;
  fullname: string;
  name: string | undefined;
  dr: string | undefined;
};

const matchEnum = ["Yes", "No", "Likely"] as const;
type Match = (typeof matchEnum)[number];

type Clinic = {
  fullname: string;
  name: string | undefined;
  shorterName: string | undefined;
  dr: string | undefined;
  cwMatch?: Match;
  cwNames?: string[];
  cqMatch?: Match;
  cqNames?: string[];
};

async function main() {
  const cqOrgs = await getCqOrgs();
  // const cqOrgs: CqOrganization[] = [];
  const cwOrgs = await getCwOrgs();
  const targetClinics = await getClinics();
  compareOrganizationsAndRecordResults(cwOrgs, cqOrgs, targetClinics);
  db.close();
}

function compareOrganizationsAndRecordResults(
  cwOrgs: CwOrganization[],
  cqOrgs: CqOrganization[],
  clinics: Clinic[]
) {
  clinics.forEach(clinic => {
    clinic.cwNames = [];
    clinic.cwMatch = "No";
    for (const cwOrg of cwOrgs) {
      const match = significantMatch(clinic, cwOrg);

      if (match) {
        if (match === "Yes") {
          clinic.cwMatch = "Yes";
          clinic.cwNames = [cwOrg.fullname];
          break;
        }
        clinic.cwMatch = match;
        clinic.cwNames.push(cwOrg.fullname);
      }
    }

    clinic.cqNames = [];
    clinic.cqMatch = "No";
    for (const cqOrg of cqOrgs) {
      const match = significantMatch(clinic, cqOrg);
      if (match) {
        if (match === "Yes") {
          clinic.cqMatch = "Yes";
          clinic.cqNames = [cqOrg.fullname];
          break;
        }
        clinic.cqMatch = match;
        clinic.cqNames.push(cqOrg.fullname);
      }
    }
  });

  outputToCsv(clinics);
}

function significantMatch(
  clinic: Clinic,
  org: { name?: string; fullname: string; dr?: string }
): Match | undefined {
  // Full name matching
  const jaro = jaroWinkler(clinic.fullname.toLowerCase(), org.fullname.toLowerCase());
  // const levenshtein = getLevenshtein(clinic.fullname.toLowerCase(), org.fullname);
  if (clinic.fullname.toLowerCase() === org.fullname.toLowerCase() || jaro > 0.93) {
    if (jaro > 0.99) return "Yes";
    return "Likely";
  }

  if (clinic.shorterName) {
    const jaro = jaroWinkler(clinic.shorterName.toLowerCase(), org.fullname.toLowerCase());
    // const levenshtein = getLevenshtein(clinic.shorterName, org.fullname);
    if (jaro > 0.93) {
      if (jaro > 0.99) return "Yes";
      return "Likely";
    }
  }

  // Doctor matching
  if (clinic.dr && org.dr) {
    const jaro = jaroWinkler(clinic.dr.toLowerCase(), org.dr.toLowerCase());
    // const levenshtein = getLevenshtein(clinic.dr, org.dr);
    if (jaro > 0.93) {
      if (jaro > 0.99) return "Yes";
      return "Likely";
    }
  }

  // // Standardized name matching
  if (clinic.name && org.name) {
    // Jaro-Winkler distance matching
    const jaro = jaroWinkler(clinic.name.toLowerCase(), org.name.toLowerCase());
    // const levenshtein = getLevenshtein(clinic.name, org.name);
    if (jaro > 0.909) {
      if (jaro > 0.99) return "Yes";
      return "Likely";
    }
    if (
      isSignificantSubstring(clinic.name.toLowerCase(), org.name.toLowerCase()) ||
      isSignificantSubstring(org.name.toLowerCase(), clinic.name.toLowerCase())
    ) {
      return "Likely";
    }
  }
  return;
}

function isSignificantSubstring(larger: string, substring: string): boolean {
  if (larger.includes(substring)) {
    const matchIndex = larger.indexOf(substring);
    return (
      (matchIndex === 0 || !/\w/.test(larger.charAt(matchIndex - 1))) &&
      (matchIndex + substring.length === larger.length ||
        !/\w/.test(larger.charAt(matchIndex + substring.length)))
    );
  }
  return false;
}

function normalizeName(name: string): { name: string | undefined; dr: string | undefined } {
  const nameLower = name.toLowerCase();
  let dr;
  if (nameLower.includes("dr.")) {
    const parts = nameLower.split("dr.");
    name = parts[0];
    dr = parts[1];
  }
  const cleanerName = name.replace(commonTermsRegex, "");
  const cleanName = cleanerName
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: cleanName.length <= 2 ? undefined : cleanName,
    dr: dr ? dr.trim().toLowerCase() : undefined,
  };
}

function outputToCsv(clinics: Clinic[]) {
  const records = clinics.map(clinic => ({
    fullOrgName: clinic.fullname,
    // standardizedName: clinic.name,
    cwMatch: clinic.cwMatch,
    cwNames: clinic.cwNames ? clinic.cwNames.join(", ") : "",
    cqMatch: clinic.cqMatch,
    cqNames: clinic.cqNames ? clinic.cqNames.join(", ") : "",
  }));

  csvWriter
    .writeRecords(records)
    .then(() => console.log("Data has been written to CSV file."))
    .catch(err => console.error("Error writing to CSV file:", err));
}

async function getCqOrgs() {
  const query = `SELECT id, name as fullName from cq_directory_entry;`;
  const cqOrgs: CqOrganization[] = await db.query(query, {
    type: QueryTypes.SELECT,
  });

  cqOrgs.map((org: CqOrganization) => {
    const { name, dr } = normalizeName(org.fullname);

    org.name = name;
    org.dr = dr;
    return org;
  });
  console.log(`Loaded ${cqOrgs.length} CQ organizations from the database.`);

  return cqOrgs;
}

async function getCwOrgs(): Promise<CwOrganization[]> {
  const cwOrgs: CwOrganization[] = [];
  const cwOrgsStream = fs
    .createReadStream(path.join(__dirname, cwOrgsPath))
    .pipe(csv({ mapHeaders: ({ header }) => header.replaceAll(" ", "").replaceAll("*", "") }))
    .on("data", data => {
      const organization = mapCsvDetailsToOrg(data);
      if (organization) cwOrgs.push(organization);
    });

  await once(cwOrgsStream, "end");
  console.log(`Loaded ${cwOrgs.length} clinics from the CSV file.`);
  return cwOrgs;
}

const mapCsvDetailsToOrg = (csvOrg: {
  name: string;
  network_type: string | undefined;
  id: string | undefined;
  state: string | undefined;
  zip: string | undefined;
}): CwOrganization | undefined => {
  const { name, dr } = normalizeName(csvOrg.name);
  if (!name && !dr) return;

  const shorterName = removeDrFromName(csvOrg.name);

  return {
    fullname: csvOrg.name,
    shorterName,
    name,
    dr: dr ? dr.toLowerCase() : undefined,
    networkType: csvOrg.network_type,
    id: csvOrg.id,
    state: csvOrg.state,
    zip: csvOrg.zip,
  };
};

async function getClinics(): Promise<Clinic[]> {
  const clinics: Clinic[] = [];
  const clinicsStream = fs
    .createReadStream(path.join(__dirname, clinicPath))
    .pipe(csv({ mapHeaders: ({ header }) => header.replaceAll(" ", "").replaceAll("*", "") }))
    .on("data", data => {
      const clinic = mapClinicNames(data);
      if (clinic) clinics.push(clinic);
    });

  await once(clinicsStream, "end");
  console.log(`Loaded ${clinics.length} clinics from the CSV file.`);
  return clinics;
}

const mapClinicNames = (csvOrg: { clinic: string }): Clinic | undefined => {
  const { name, dr } = normalizeName(csvOrg.clinic);
  if (!name && !dr) return;

  const shorterName = removeDrFromName(csvOrg.clinic);
  return {
    fullname: csvOrg.clinic,
    shorterName,
    name: name ?? undefined,
    dr: dr ?? undefined,
  };
};

function removeDrFromName(name: string): string | undefined {
  if (name.includes("Dr.")) {
    const shorterName = name
      .split("Dr.")[0]
      .replace(/[^\w\s]/g, "")
      .trim();
    if (shorterName.length > 2) return shorterName.toLowerCase();
  }
}

main();
