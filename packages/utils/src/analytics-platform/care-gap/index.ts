import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Command } from "commander";
import { Config } from "@metriport/core/util/config";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import runCareGaps from "./1-run-care-gaps";
import s3ToSnowflake from "./2-s3-to-snowflake";
import runHedisValidation from "./run-hedis-validation";

/**
 * This is the main command registry for the Care Gap CLI. You should add any new
 * commands to this registry, and ensure that your command has a unique name.
 */
const program = new Command();
FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

program.addCommand(runCareGaps);
program.addCommand(s3ToSnowflake);
program.addCommand(runHedisValidation);
program.parse();
