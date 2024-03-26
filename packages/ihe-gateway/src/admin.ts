import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { spawn } from "child_process";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as dotenv from "dotenv";
import fs from "fs";
import { getEcsTasks } from "./ecs";

dayjs.extend(duration);

/**
 * Utility to run the Administrator connecting to the IHE Gateway.
 *
 * It can connect to different environments by providing the environment name as the first argument:
 * - `dev` for local development;
 * - `staging` for the staging environment;
 * - `production` for the production environment.
 *
 * When not in `dev` mode, it can connect to the `inbound` or `outbound` services by providing the
 * service name as the second argument:
 * - `inbound` to connect to the Inbound service;
 * - `outbound` to connect to the Outbound service;
 * - `all` to connect to both services (default).
 *
 * Example:
 * - `$ npm run admin -- staging outbound`
 * - `$ npm run admin -- dev`
 * - `$ npm run admin -- production all`
 *
 * Requires a .env file for each environment, like so:
 * - `.env` for the local development environment (or `.env.dev` or `.env.local`);
 * - `.env.staging` for the staging environment;
 * - `.env.production` for the production environment.
 */

const logsDirName = "./logs";
type Config = {
  adminPath: string;
  awsRegion: string;
  ecsCluster: string;
};

async function main() {
  if (!fs.existsSync(logsDirName)) {
    fs.mkdirSync(logsDirName);
  }

  const program = new Command();
  program
    .name("admin")
    .description("CLI to run the Administrator connecting to all ECS tasks of a given service.")
    .argument(
      `<env>`,
      `The environment where the service is running, one of "dev" | "staging" | "production"`
    )
    .argument(
      `[service]`,
      `The service to connect to, one of "inbound" | "outbound" | "all" (only applicable when not in dev mode)`,
      "all"
    )
    .showHelpAfterError()
    .action(run);

  await program.parseAsync(process.argv);
  process.exit(0);
}

async function run(envParam: string, serviceParam: string) {
  const startedAt = Date.now();
  const env = getEnvParam(envParam);
  if (!env) return;
  const service = getServiceParam(serviceParam);
  if (!service) return;
  console.log(`Running @ env ${env} with service: ${service} at ${dayjs().toISOString()}...`);

  loadEnvConfig(env);
  dotenv.config();
  const awsRegion = getEnvVarOrFail("AWS_REGION");
  const ecsCluster = getEnvVarOrFail("ECS_CLUSTER");
  const outboundService = getEnvVarOrFail("IHE_OUTBOUND_ECS_SERVICE");
  const inboundService = getEnvVarOrFail("IHE_INBOUND_ECS_SERVICE");
  const adminPath = getEnvVarOrFail("ADMIN_PATH");

  const config = {
    adminPath,
    awsRegion,
    ecsCluster,
  };

  if (env === "dev") {
    connectToIp("localhost", config);
  } else {
    if (service === "outbound" || service === "all") await runService(outboundService, config);
    if (service === "inbound" || service === "all") await runService(inboundService, config);
  }

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Done in ${duration} ms / ${durationMin} min`);
}

function loadEnvConfig(env: "dev" | "staging" | "production") {
  if (env === "production") {
    dotenv.config({ path: `.env.production` });
    return;
  }
  if (env === "staging") {
    dotenv.config({ path: `.env.staging` });
    return;
  }
  dotenv.config({ path: `.env.dev` });
  dotenv.config({ path: `.env.local` });
  dotenv.config({ path: `.env` });
}

async function runService(serviceName: string, config: Config) {
  const { awsRegion, ecsCluster } = config;
  const tasks = await getEcsTasks({
    region: awsRegion,
    clusterName: ecsCluster,
    serviceName: serviceName,
  });

  const ips = (
    await Promise.all(
      (tasks.tasks ?? []).map(async task => {
        return task.containers?.flatMap(container => {
          return container.networkInterfaces?.map(i => {
            return i.privateIpv4Address;
          });
        });
      })
    )
  )
    .flat()
    .flatMap(r => r ?? []);

  for (const ip of ips) {
    connectToIp(ip, config);
  }
}

function connectToIp(ip: string, { adminPath }: Config) {
  const out = fs.openSync(`./logs/out${ip}.log`, "a");
  const err = fs.openSync(`./logs/err_${ip}.log`, "a");
  const childProcess = spawn(
    "jre/bin/java",
    ["-jar", "mirth-client-launcher.jar", "-a", `https://${ip}:8443`],
    {
      cwd: adminPath,
      detached: true,
      stdio: ["ignore", out, err],
    }
  );
  console.log(`Connecting to ${ip} with PID ${childProcess.pid}...`);
  childProcess.stdout?.on("data", data => {
    console.log(`stdout: ${data}`);
  });
  childProcess.stderr?.on("data", data => {
    console.error(`stderr: ${data}`);
  });
}

function getServiceParam(value: string): "inbound" | "outbound" | "all" | undefined {
  switch (value) {
    case "inbound":
      return "inbound";
    case "outbound":
      return "outbound";
    case undefined:
    case "all":
      return "all";
  }
  console.log(`Invalid service: ${value}`);
  return undefined;
}

function getEnvParam(value: string): "dev" | "staging" | "production" | undefined {
  switch (value) {
    case "dev":
      return "dev";
    case "production":
      return "production";
    case undefined:
    case "staging":
      return "staging";
  }
  console.log(`Invalid env: ${value}`);
  return undefined;
}

main();
