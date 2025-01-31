import fs from "fs";
import { faker } from "@faker-js/faker";

interface NetworkEntry {
  id: string;
  name: string;
  active: string;
  root_organization: string;
  managing_organization_id: string;
  data: string;
  url_xcpd: string;
  url_dq: string;
  url_dr: string;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  lat: string;
  lon: string;
  point: string;
  last_updated_at_cq: string;
  version: string;
}

const states = [
  ["AL", "35801"],
  ["AK", "99501"],
  ["AZ", "85001"],
  ["AR", "72201"],
  ["CA", "90001"],
  ["CO", "80201"],
  ["CT", "06101"],
  ["DE", "19901"],
  ["FL", "32099"],
  ["GA", "30301"],
];

function generateChunk(startIndex: number, chunkSize: number, counter: number): [string, number] {
  const values: string[] = [];
  const now = new Date();
  const usedIds = new Set<string>();

  function generateUniqueId(index: number): string {
    let id;
    do {
      id = `2.16.840.1.${startIndex + index + 1}.${faker.number.int({
        min: 1000000,
        max: 9999999,
      })}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  }

  const [state, zip] = states[Math.floor(Math.random() * states.length)];
  const record: NetworkEntry = {
    id: generateUniqueId(0),
    name: `[TEST] ${faker.company.name()}`,
    active: "true",
    root_organization: `[TEST] ${faker.company.name()}`,
    managing_organization_id: `2.16.840.1.0.0`,
    data: JSON.stringify({ dummy: "sandbox-test-data", timestamp: now.toISOString() }),
    url_xcpd: "",
    url_dq: "",
    url_dr: "",
    address_line: `${faker.location.streetAddress()}`,
    city: `${faker.location.city()}`,
    state,
    zip,
    lat: faker.location.latitude().toString(),
    lon: faker.location.longitude().toString(),
    point: `(${faker.location.latitude()},${faker.location.longitude()})`,
    last_updated_at_cq: now.toISOString().slice(0, -4) + "Z",
    version: faker.number.int({ min: 0, max: 10 }).toString(),
  };

  for (let i = 0; i < chunkSize; i++) {
    const [state, zip] = states[Math.floor(Math.random() * states.length)];
    const recordValues = Object.values({
      ...record,
      id: generateUniqueId(i),
      name: `[TEST] ${faker.company.name()}`,
      root_organization: `[TEST] ${faker.company.name()}`,
      address_line: `${faker.location.streetAddress()}`,
      city: `${faker.location.city()}`,
      state,
      zip,
      lat: faker.location.latitude().toString(),
      lon: faker.location.longitude().toString(),
      point: `(${faker.location.latitude()},${faker.location.longitude()})`,
      version: faker.number.int({ min: 0, max: 10 }).toString(),
    })
      .map(value => (typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : value))
      .join(", ");

    values.push(`(${recordValues})`);
    counter++;
  }

  const columns = Object.keys(record).join(", ");
  const bulkInsert = `INSERT INTO cq_directory_entry_new (${columns}) VALUES\n${values.join(
    ",\n"
  )};`;

  return [bulkInsert, counter];
}

async function generateFile(totalRecords: number, chunkSize: number) {
  const filename = `${new Date().toISOString().split("T")[0]}_cq_entries_dummy_insert.sql`;

  fs.writeFileSync(filename, "BEGIN;\n\n");

  let counter = 1;
  for (let i = 0; i < totalRecords; i += chunkSize) {
    const [chunk, newCounter] = generateChunk(i, Math.min(chunkSize, totalRecords - i), counter);
    counter = newCounter;
    fs.appendFileSync(filename, chunk + "\n");
    console.log(
      `Processed ${Math.min(i + chunkSize, totalRecords) / 1000}K/${totalRecords / 1000}K records`
    );
  }

  fs.appendFileSync(filename, "\nCOMMIT;\n");
}

const totalRecords = 100_000;
const chunkSize = 10_000;
generateFile(totalRecords, chunkSize);
