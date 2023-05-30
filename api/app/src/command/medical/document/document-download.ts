import { makeLambdaClient } from "../../../external/aws/lambda";
import { Config } from "../../../shared/config";

const lambdaClient = makeLambdaClient();

export const downloadDocument = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType?: string;
}): Promise<string> => {
  const result = await lambdaClient
    .invoke({
      FunctionName: Config.getConvertDocLambdaName() ?? "",
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ fileName, conversionType }),
    })
    .promise();

  if (result.Payload === undefined) throw new Error("Payload is undefined");

  return result.Payload.toString();
};
