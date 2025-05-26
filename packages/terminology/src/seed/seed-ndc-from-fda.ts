import { Parameters } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import csv from "csv-parser";
import fs from "fs";
import _ from "lodash";
import { argv } from "node:process";
import { TerminologyClient } from "../client";
import { normalizeNdcCode } from "../util";
import { sendParameters } from "./shared";

/**
 * Script to seed FDA NDC code descriptions into the terminology service.
 *
 * This script processes FDA NDC data from two CSV files:
 * 1. Products file containing drug product information
 * 2. Packages file containing package-specific information
 *
 * The script:
 * - Parses both CSV files
 * - Normalizes NDC codes
 * - Combines product and package information
 * - Creates unique drug entries with standardized displays
 * - Seeds the data into the terminology service in batches
 *
 * @usage npm run seed-fda-descriptions <products-file-path.csv> <packages-file-path.csv>
 */

const client = new TerminologyClient();

const PRODUCT_HEADERS = [
  "PRODUCTID",
  "PRODUCTNDC",
  "PRODUCTTYPENAME",
  "PROPRIETARYNAME",
  "PROPRIETARYNAMESUFFIX",
  "NONPROPRIETARYNAME",
  "DOSAGEFORMNAME",
  "ROUTENAME",
  "STARTMARKETINGDATE",
  "ENDMARKETINGDATE",
  "MARKETINGCATEGORYNAME",
  "APPLICATIONNUMBER",
  "LABELERNAME",
  "SUBSTANCENAME",
  "ACTIVE_NUMERATOR_STRENGTH",
  "ACTIVE_INGRED_UNIT",
  "PHARM_CLASSES",
  "DEASCHEDULE",
  "NDC_EXCLUDE_FLAG",
  "LISTING_RECORD_CERTIFIED_THROUGH",
] as const;

const PACKAGE_HEADERS = [
  "PRODUCTID",
  "PRODUCTNDC",
  "NDCPACKAGECODE",
  "PACKAGEDESCRIPTION",
  "STARTMARKETINGDATE",
  "ENDMARKETINGDATE",
  "NDC_EXCLUDE_FLAG",
  "SAMPLE_PACKAGE",
] as const;

type Product = Record<(typeof PRODUCT_HEADERS)[number], string>;
type Package = Record<(typeof PACKAGE_HEADERS)[number], string>;
type ProductWithPackages = Product & { packages: Package[] };

type DrugRow = {
  code: string;
  display: string;
};

async function main() {
  const [productsFilePath, packagesFilePath] = argv.slice(2);
  if (!productsFilePath || !packagesFilePath) {
    console.error("Missing arguments: specify path to products and packages CSVs");
    process.exit(1);
  }

  try {
    const products = await parseCsv<Product>(productsFilePath, PRODUCT_HEADERS);
    const packages = await parseCsv<Package>(packagesFilePath, PACKAGE_HEADERS);
    const packagesByNdc = _.groupBy(packages, "PRODUCTNDC");

    // Merge products with their packages
    const productsWithPkg: ProductWithPackages[] = products.map(product => ({
      ...product,
      packages: packagesByNdc[product["PRODUCTNDC"]] ?? [],
    }));

    const drugRows: DrugRow[] = [];

    let numErrors = 0;
    for (const product of productsWithPkg) {
      const addDrugRow = (code: string, display: string) => {
        try {
          drugRows.push({ code: normalizeNdcCode(code, code === product.PRODUCTNDC), display });
        } catch {
          numErrors++;
        }
      };

      // Add the product NDC code
      addDrugRow(product.PRODUCTNDC, buildBaseDisplay(product));

      // Add package NDC codes
      product.packages.forEach(pkg => {
        addDrugRow(pkg.NDCPACKAGECODE, buildDisplayWithPackage(product, pkg));
      });
    }

    console.log(`Found ${drugRows.length} unique NDC codes.`);
    console.log(`Found ${numErrors} invalid NDC codes.`);

    await seedNdcDescriptionsToTermServer(drugRows);
  } catch (error) {
    console.error("Failed to parse or merge CSVs:", error);
    process.exit(1);
  }
}

function parseCsv<T extends Record<string, string>>(
  filePath: string,
  headers: readonly string[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data: Record<string, string>) => {
        const parsed = headers.reduce((acc, key) => {
          (acc as Record<string, string>)[key] = data[key] ?? "";
          return acc;
        }, {} as T);
        results.push(parsed);
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", reject);
  });
}

function buildBaseDisplay(drug: ProductWithPackages): string {
  return `${drug.NONPROPRIETARYNAME.toLowerCase()} (${getProprietaryName(drug)}) ${
    drug.ACTIVE_NUMERATOR_STRENGTH
  } ${drug.ACTIVE_INGRED_UNIT} ${toTitleCase(drug.ROUTENAME)} ${toTitleCase(drug.DOSAGEFORMNAME)}`;
}

function buildDisplayWithPackage(drug: ProductWithPackages, pkg: Package): string {
  return `${buildBaseDisplay(drug)}, ${pkg.PACKAGEDESCRIPTION}`;
}

function getProprietaryName(drug: ProductWithPackages) {
  return drug.PROPRIETARYNAMESUFFIX.length > 0
    ? toTitleCase(`${drug.PROPRIETARYNAME} ${drug.PROPRIETARYNAMESUFFIX}`)
    : toTitleCase(drug.PROPRIETARYNAME);
}

async function seedNdcDescriptionsToTermServer(drugRows: DrugRow[]) {
  const batchSize = 500;
  const batches = [];

  for (let i = 0; i < drugRows.length; i += batchSize) {
    batches.push(drugRows.slice(i, i + batchSize));
  }

  console.log(`Sending ${batches.length} batches of NDC codes...`);

  for (const [index, batch] of batches.entries()) {
    const parameters: Parameters = {
      resourceType: "Parameters",
      parameter: [
        { name: "system", valueUri: "http://hl7.org/fhir/sid/ndc" },
        ...batch.flatMap(coding => {
          if (!coding.code || !coding.display) {
            return [];
          }

          return {
            name: "concept",
            valueCoding: {
              code: coding.code,
              display: coding.display,
            },
          };
        }),
      ],
    };

    try {
      await sendParameters(parameters, client, true);
      console.log(`Done with batch ${index + 1}/${batches.length}`);
    } catch (error) {
      console.error(`Failed to send batch ${index + 1}/${batches.length}:`, error);
      // If this happens, we need to restart the script. This might require a safer approach with retries.
      throw error;
    }
  }
}

if (require.main === module) {
  main();
}
