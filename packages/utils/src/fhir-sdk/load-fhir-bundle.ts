import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { Command } from "commander";
import fs from "fs";
import * as _ from "lodash";
import { initRunsFolder } from "../shared/folder";

/**
 * This script loads a FHIR bundle into the FHIR SDK.
 *
 * Non-interactive usage:
 * $ ts-node src/fhir-sdk/load-fhir-bundle.ts --bundle-path /path/to/bundle.json
 *
 * Interactive mode:
 * $ BUNDLE_PATH=/path/to/bundle.json npx ts-node src/fhir-sdk/load-fhir-bundle.ts --interactive
 *
 * This will load the bundle and drop you into a REPL with 'sdk' and '_' (lodash) available.
 * You can then interact with it:
 * > sdk
 * > sdk.getPatient()
 * > sdk.getConditions()
 * > _.groupBy(sdk.getConditions(), 'clinicalStatus.coding[0].code')
 */

/**
 * Load a FHIR bundle and return the SDK instance.
 * This function can be imported and used in a REPL or other scripts.
 */
export async function loadBundle(bundlePath: string): Promise<FhirBundleSdk> {
  initRunsFolder();
  const startedAt = Date.now();

  console.log(`>>> Loading bundle from file: ${bundlePath}`);
  const bundleContent = fs.readFileSync(bundlePath, "utf-8");
  const bundle = JSON.parse(bundleContent) as Bundle;
  const sdk = await FhirBundleSdk.create(bundle);

  console.log(
    `>>> Bundle loaded successfully with ${sdk.total} entries in ${Date.now() - startedAt}ms`
  );

  return sdk;
}

async function main() {
  const program = new Command();
  program
    .name("load-fhir-bundle")
    .description("Load a FHIR bundle into the FHIR SDK")
    .option("-b, --bundle-path <path>", "Path to FHIR bundle JSON file")
    .option("-i, --interactive", "Start an interactive REPL after loading")
    .parse(process.argv);

  const options = program.opts();

  // Allow bundle path from env var for easier interactive usage
  const bundlePath = options.bundlePath || process.env.BUNDLE_PATH;

  if (!bundlePath) {
    console.error("Error: --bundle-path is required (or set BUNDLE_PATH env var)");
    process.exit(1);
  }

  try {
    const sdk = await loadBundle(bundlePath);

    // Make SDK available globally
    const globalObj = global as typeof global & {
      sdk: FhirBundleSdk;
    };
    globalObj.sdk = sdk;

    if (options.interactive) {
      console.log(`>>> SDK available as global 'sdk' variable`);
      console.log(`>>> Lodash available as '_' variable`);
      console.log(`>>> Starting interactive REPL... (press Ctrl+D to exit)`);

      // Start REPL
      const repl = await import("repl");
      const replServer = repl.start({
        prompt: "> ",
        useGlobal: true,
      });

      // Make sdk and lodash available in REPL context
      replServer.context.sdk = sdk;
      replServer.context._ = _;
    } else {
      console.log(`>>> Bundle loaded successfully. Use --interactive flag to start a REPL.`);
    }
  } catch (error) {
    console.error(`>>> Error: ${error}`);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Only run main automatically if not being imported as a module
if (require.main === module) {
  main();
}
