import crypto from "crypto";
import { AttributeValue, DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { ComprehendType } from "./types";

export class ComprehendCache {
  private readonly client: DynamoDBClient;
  private readonly tableName: string;

  constructor({ tableName, region }: { tableName: string; region: string }) {
    this.client = new DynamoDBClient({ region });
    this.tableName = tableName;
  }

  async hasCachedRxNormOutput(text: string): Promise<boolean> {
    return this.hasCachedOutput("rxnorm", text);
  }

  async hasCachedICD10CMOutput(text: string): Promise<boolean> {
    return this.hasCachedOutput("icd10cm", text);
  }

  async hasCachedSNOMEDCTOutput(text: string): Promise<boolean> {
    return this.hasCachedOutput("snomedct", text);
  }

  private async hasCachedOutput(comprehendType: ComprehendType, text: string): Promise<boolean> {
    const hashKey = getHashKey(text);
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: buildKey({ comprehendType, hashKey, rangeKey: hashKey }),
    });
    try {
      const response = await this.client.send(command);
      return response.Item != null;
    } catch (error) {
      return false;
    }
  }
}

function buildKey({
  comprehendType,
  hashKey,
  rangeKey,
}: {
  comprehendType: ComprehendType;
  hashKey: string;
  rangeKey: string;
}): Record<string, AttributeValue> {
  return {
    pk: { S: `${comprehendType}|${hashKey}` },
    sk: { S: rangeKey },
  };
}

function getHashKey(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
