import { DynamoDB } from "aws-sdk";
import axios from "axios";
import dayjs from "dayjs";
import { capture } from "./capture";
import { Log } from "./log";
import { sleep } from "./sleep";

// Keep this as early on the file as possible
capture.init();

// const converterKeysTableName = getEnvOrFail("SIDECHAIN_FHIR_CONVERTER_KEYS_TABLE_NAME");
enum converterKeysStatus {
  active = "active",
  rateLimit = "rate-limit",
  revoked = "revoked",
}
const MAX_CONVERTER_ATTEMPTS = 5;
const CONVERTER_INITIAL_TIME_BETTWEEN_ATTEMPTS_MILLIS = 500;

const createFhirConverter = (axiosTimeoutSeconds: number) =>
  axios.create({
    // Only response timeout, no option for connection timeout: https://github.com/axios/axios/issues/4835
    timeout: axiosTimeoutSeconds * 1_000, // should be less than the lambda timeout
    transitional: {
      // enables ETIMEDOUT instead of ECONNABORTED for timeouts - https://betterstack.com/community/guides/scaling-nodejs/nodejs-errors/
      clarifyTimeoutError: true,
    },
  });

export async function postToConverter({
  url,
  payload,
  axiosTimeoutSeconds,
  converterKeysTableName,
  log,
  contentType,
  conversionType,
}: {
  url: string;
  payload: unknown;
  axiosTimeoutSeconds: number;
  converterKeysTableName: string;
  log: Log;
  contentType?: string;
  conversionType: "cda" | "fhir";
}) {
  const sidechainUrl = url;
  const notFHIRResponseError = "Response is not a FHIR response";
  let attempt = 0;
  let timeBetweenAttemptsMillis = CONVERTER_INITIAL_TIME_BETTWEEN_ATTEMPTS_MILLIS;
  let apiKey: string;
  while (attempt++ < MAX_CONVERTER_ATTEMPTS) {
    apiKey = await getAndUpdateSidechainConverterKeys(converterKeysTableName);
    log(`(${attempt}) Calling sidechain converter on url ${sidechainUrl}`);
    try {
      const fhirConverter = createFhirConverter(axiosTimeoutSeconds);

      const res = await fhirConverter.post(sidechainUrl, payload, {
        headers: {
          ...(contentType ? { "Content-Type": contentType } : {}),
          Accept: "application/json",
          "x-api-key": apiKey,
        },
      });

      if (conversionType === "fhir") {
        if (!res.data || !res.data.resourceType) {
          throw new Error(notFHIRResponseError);
        }
        if (res.data.resourceType !== "Bundle") {
          throw new Error("CDA XML failed to convert to a FHIR bundle - needs investigation");
        }
      }

      return res;
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if ([401, 429].includes(error.response?.status) || error.message === notFHIRResponseError) {
        const msg = "Sidechain quota/auth error, trying again";
        const extra = {
          url: sidechainUrl,
          apiKey,
          statusCode: error.response?.status,
          attempt,
          error,
        };
        log(msg, extra);
        capture.message(msg, { extra, level: "info" });
        if (error.response?.status === 429 || error.message === notFHIRResponseError) {
          await markSidechainConverterKeyAsRateLimited(apiKey, converterKeysTableName);
        } else {
          await markSidechainConverterKeyAsRevoked(apiKey, converterKeysTableName);
        }
        await sleep(timeBetweenAttemptsMillis);
        timeBetweenAttemptsMillis *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Too many errors from sidechain converter`);
}

async function getAndUpdateSidechainConverterKeys(converterKeysTableName: string): Promise<string> {
  if (!converterKeysTableName) {
    throw new Error(`Programming error - SIDECHAIN_FHIR_CONVERTER_KEYS_TABLE_NAME is not set`);
  }
  const docClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
  });

  // get all keys that haven't been revoked
  const keysTableItems = await docClient
    .scan({
      TableName: converterKeysTableName,
      FilterExpression:
        "attribute_exists(keyStatus) AND (keyStatus = :active OR keyStatus = :rateLimit)",
      ExpressionAttributeValues: {
        ":active": converterKeysStatus.active,
        ":rateLimit": converterKeysStatus.rateLimit,
      },
    })
    .promise();

  if (!keysTableItems.Items) {
    throw new Error(`No keys found in sidechain keys table`);
  }
  const activeKeys: string[] = [];
  const keysToUpdate: string[] = [];
  for (const keyItem of keysTableItems.Items) {
    if (!keyItem.keyStatus || !keyItem.apiKey) {
      throw new Error(`Keys found in sidechain keys table not in expected format`);
    }

    if (keyItem.keyStatus === converterKeysStatus.active.toString()) {
      activeKeys.push(keyItem.apiKey);
    } else if (
      keyItem.keyStatus === converterKeysStatus.rateLimit.toString() &&
      keyItem.rateLimitDate &&
      dayjs().isAfter(keyItem.rateLimitDate, "month")
    ) {
      // this key should have its rate limit reset by now
      keysToUpdate.push(keyItem.apiKey);
      activeKeys.push(keyItem.apiKey);
    }
  }

  const newKeyItemPutRequests = keysToUpdate.map(apiKey => {
    return {
      PutRequest: {
        Item: {
          TableName: converterKeysTableName,
          apiKey,
          keyStatus: converterKeysStatus.active,
        },
      },
    };
  });

  if (newKeyItemPutRequests.length > 0) {
    await docClient
      .batchWrite({
        RequestItems: {
          [converterKeysTableName]: newKeyItemPutRequests,
        },
      })
      .promise();
  }
  if (activeKeys.length < 1)
    throw new Error(`No active key found in sidechain keys table - can't do conversion`);
  // pick a random key
  return activeKeys[Math.floor(Math.random() * activeKeys.length)] ?? "";
}

async function markSidechainConverterKeyAsRateLimited(
  apiKey: string,
  converterKeysTableName: string
): Promise<void> {
  if (!converterKeysTableName) {
    throw new Error(`Programming error - SIDECHAIN_FHIR_CONVERTER_KEYS_TABLE_NAME is not set`);
  }

  const docClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
  });

  await docClient
    .put({
      TableName: converterKeysTableName,
      Item: {
        apiKey,
        keyStatus: converterKeysStatus.rateLimit.toString(),
        rateLimitDate: dayjs().format("YYYY-MM-DD"),
      },
    })
    .promise();
}

async function markSidechainConverterKeyAsRevoked(
  apiKey: string,
  converterKeysTableName: string
): Promise<void> {
  if (!converterKeysTableName) {
    throw new Error(`Programming error - SIDECHAIN_FHIR_CONVERTER_KEYS_TABLE_NAME is not set`);
  }

  const docClient = new DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
  });

  await docClient
    .put({
      TableName: converterKeysTableName,
      Item: {
        apiKey,
        keyStatus: converterKeysStatus.revoked.toString(),
      },
    })
    .promise();
}
