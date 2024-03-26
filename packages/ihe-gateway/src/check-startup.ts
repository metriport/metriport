import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import axios from "axios";
import { spawn } from "child_process";
import dayjs from "dayjs";
import duration, { Duration } from "dayjs/plugin/duration";
import { getEnvVarOrFail, log as _log, sleep } from "./utils";

dayjs.extend(duration);

const maxHealthcheckDuration = dayjs.duration(80, "seconds");
const healthcheckChannelName = "healthcheck";
const outboundGroupName = "CareQuality Document Exchange - Outbound";
const inboundGroupName = "CareQuality Document Exchange - Inbound";
const expectedDeployedOutbound = 12;
const expectedDeployedInbound = 3;

const baseURL = getEnvVarOrFail("IHE_GW_URL");
const username = getEnvVarOrFail("ADMIN_USER");
const password = getEnvVarOrFail("ADMIN_PASSWORD");

const api = axios.create({
  baseURL,
  headers: { "X-Requested-With": "check-startup" },
  auth: { username, password },
});

type Channel = { id: string };
type Group = {
  id: string;
  name: string;
  channels: { channel: Channel[] };
};

type ExecutionTimedout = {
  timedout: true;
};
type ExecutionCompleted = {
  timedout: false;
};
type Execution = ExecutionTimedout | ExecutionCompleted;

async function main() {
  const log = _log("check-startup");
  const startedAt = Date.now();
  log(`Running at ${dayjs().toISOString()}`);

  try {
    const raceResult: Execution = await Promise.race([
      controlDuration(maxHealthcheckDuration),
      checkServerStatus(log),
    ]);
    if (raceResult.timedout) {
      log(`Healthcheck timedout`);
      killContainer(log);
      process.exit(1);
    }
    log(`Container is healthy, enabling healthcheck channel...`);
    await enableHealthCheckChannel(log);
  } catch (error) {
    log(`Error checking channels: ${error}`);
    killContainer(log);
    // throw error;
    process.exit(1);
  }

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  log(`Done in ${duration} ms / ${durationMin} min`);
  process.exit(0);
}

async function controlDuration(duration: Duration): Promise<ExecutionTimedout> {
  await sleep(duration.asMilliseconds());
  return { timedout: true };
}

async function checkServerStatus(log: typeof console.log): Promise<ExecutionCompleted> {
  log(`Waiting for API to be available...`);
  while (!(await isApiAvailable())) {
    await sleep(1_000);
  }
  await sleep(1_000);
  log(`API is ready, checking deployed channels and configuration map...`);

  await Promise.all([checkChannels(log), checkConfigMap(log)]);
  return { timedout: false };
}

async function isApiAvailable() {
  try {
    await api.get("/server/jvm");
    return true;
  } catch (error) {
    console.log(`API not available: ${error}`);
    return false;
  }
}

async function checkConfigMap(log: typeof console.log): Promise<void> {
  while (!(await isConfigMapSet(log))) {
    await sleep(2_000);
  }
}

async function isConfigMapSet(log: typeof console.log) {
  type ConfigMapResponse = {
    map?: {
      entry?: object[];
    };
  };
  try {
    const resp = await api.get<ConfigMapResponse>("/server/configurationMap");
    const entries = resp.data.map?.entry;
    if (entries?.length && entries.length > 0) {
      return true;
    }
    log(`Missing Configuration Map`);
  } catch (error) {
    console.log(`Error getting Configuration Map: ${error}`);
  }
  return false;
}

async function checkChannels(log: typeof console.log): Promise<void> {
  while (!(await areChannelsHealthy(log))) {
    await sleep(2_000);
  }
}

async function areChannelsHealthy(log: typeof console.log) {
  type GroupResponse = {
    list?: {
      channelGroup?: Group[];
    };
  };
  try {
    const respGroups = await api.get<GroupResponse>("/channelgroups");
    const groups = respGroups.data.list?.channelGroup;
    if (!groups?.length || groups?.length < 2) {
      log(`Missing channel groups`);
      return false;
    }

    const inboundGroup = groups.filter((g: Group) => g.name === inboundGroupName);
    const outboundGroup = groups.filter((g: Group) => g.name === outboundGroupName);

    const deployedInbound = await getDeployedChannels(inboundGroup);
    const deployedOutbound = await getDeployedChannels(outboundGroup);

    let error = false;
    if (deployedInbound !== expectedDeployedInbound) {
      log(
        `Inbound channels count mismatch (expected: ${expectedDeployedInbound}, actual: ${deployedInbound})`
      );
      error = true;
    }
    if (deployedOutbound !== expectedDeployedOutbound) {
      log(
        `Outbound channels count mismatch (expected: ${expectedDeployedOutbound}, actual: ${deployedOutbound})`
      );
      error = true;
    }
    if (!error) return true;
  } catch (error) {
    console.log(`Error getting channel status: ${error}`);
  }
  return false;
}

async function getDeployedChannels(group: Group[]): Promise<number> {
  type ChannelStatusResp = {
    list?: {
      dashboardStatus?: {
        channelId: string;
        name: string;
        state: string;
      }[];
    };
  };
  const channelIds = group.flatMap(g => g.channels.channel.map(c => c.id));
  const paramIds = arrayToHttpParam(channelIds, "channelId");
  const resp = await api.get<ChannelStatusResp>(`/channels/statuses?${paramIds}`, {
    params: {
      includeUndeployed: false,
    },
  });
  const channels = resp.data?.list?.dashboardStatus;
  const activeChannels = (channels ?? []).filter(c => c.state === "STARTED");
  return activeChannels?.length ?? 0;
}

async function enableHealthCheckChannel(log: typeof console.log): Promise<void> {
  type ChannelsResp = {
    map?: {
      entry?: {
        string: string[];
      }[];
    };
  };
  const respChannelList = await api.get<ChannelsResp>(`/channels/idsAndNames`, {
    params: {
      includeUndeployed: false,
    },
  });
  const channels = respChannelList.data?.map?.entry;
  const healthcheckChannelId: string | undefined = (channels ?? []).flatMap(c =>
    c.string[1] === healthcheckChannelName ? c.string[0] : []
  )[0];
  if (!healthcheckChannelId) throw new Error(`Could not find healthcheck channel`);

  const respStartChannel = await api.post(`/channels/${healthcheckChannelId}/_start`, {
    params: {
      returnErrors: false,
    },
  });
  log(
    `Result of starting the Healthcheck channel (${respStartChannel.status}): ${JSON.stringify(
      respStartChannel.data
    )}`
  );
}

function arrayToHttpParam(array: unknown[], paramName: string): string {
  return array.map(value => `${paramName}=${value}`).join("&");
}

async function killContainer(log: typeof console.log) {
  log(`Killing the container...`);
  spawn("pkill", ["java"], { detached: true });
}

main();
