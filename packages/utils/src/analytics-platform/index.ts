import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Command } from "commander";
import { Config } from "@metriport/core/util/config";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import fhirToCsv from "./1-fhir-to-csv";
import mergeCsvs from "./2-merge-csvs";
import ingestFromMergedCsvs from "./snowflake/3-ingest-from-merged-csvs";

/**
 * This is the main command registry for the Surescripts CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();
FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

program.addCommand(fhirToCsv);
program.addCommand(mergeCsvs);
program.addCommand(ingestFromMergedCsvs);
program.parse();
