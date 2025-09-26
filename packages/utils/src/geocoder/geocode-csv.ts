import path from "path";
import { Command } from "commander";
import { readCsv } from "./shared";

/**
 * Geocode a CSV file of addresses.
 * @param input - The input CSV file.
 * @param output - The output CSV file.
 */
const program = new Command();

program
  .command("geocode-csv")
  .description("Geocode a CSV file of addresses")
  .requiredOption("-i, --input <file>", "The input CSV file")
  .requiredOption("-o, --output <file>", "The output CSV file")
  .action(async ({ input, output }) => {
    const inputPath = path.resolve(process.cwd(), input);
    const outputPath = path.resolve(process.cwd(), output);

    const { headers, rows } = await readCsv(inputPath);

    console.log(headers);
    console.log(rows);
    console.log(outputPath);

    // const geocodedAddresses = await geocodeAddresses(addresses);
    // await writeCsv(output, geocodedAddresses);
  });
