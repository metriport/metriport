import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { spawn } from "child_process";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getEcsTasks } from "./ecs";

dayjs.extend(duration);

const awsRegion = getEnvVarOrFail("AWS_REGION");
const ecsCluster = getEnvVarOrFail("ECS_CLUSTER");
const outboundService = getEnvVarOrFail("IHE_OUTBOUND_ECS_SERVICE");
const inboundService = getEnvVarOrFail("IHE_INBOUND_ECS_SERVICE");
const adminPath = getEnvVarOrFail("ADMIN_PATH");

const logsDirName = "./logs";

async function main() {
  if (!fs.existsSync(logsDirName)) {
    fs.mkdirSync(logsDirName);
  }

  const program = new Command();
  program
    .name("admin")
    .description("CLI to run the Administrator connecting to all ECS tasks of a given service.")
    .argument(
      `[service]`,
      `The service to connect to, one of "inbound" | "outbound" | "all"`,
      "all"
    )
    .showHelpAfterError()
    .action(run);

  await program.parseAsync(process.argv);
}

async function run(serviceParam: string) {
  const startedAt = Date.now();
  const service = getParam(serviceParam);
  if (!service) return;
  console.log(`Running wih service: ${service} at ${dayjs().toISOString()}...`);

  if (service === "outbound" || service === "all") await runService(outboundService);
  if (service === "inbound" || service === "all") await runService(inboundService);

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Done in ${duration} ms / ${durationMin} min`);
}

async function runService(serviceName: string) {
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
}

function getParam(value: string): "inbound" | "outbound" | "all" | undefined {
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

main();
