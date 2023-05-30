import { makeLambdaClient } from "../../../external/aws/lambda";
import { makeS3Client } from "../../../external/aws/s3";
import { Config } from "../../../shared/config";

const lambdaClient = makeLambdaClient();
const s3client = makeS3Client();

export const downloadDocument = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType?: string;
}): Promise<string> => {
  if (conversionType === "html") {
    const url = await getConversionUrl({ fileName, conversionType });
    return url;
  } else if (conversionType === "pdf") {
    const url = await getConversionUrl({ fileName, conversionType });
    return url;
  } else {
    const url = await getSignedURL({ fileName });
    return url;
  }
};

const getConversionUrl = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType?: string;
}): Promise<string> => {
  const convertedFileName = fileName.concat(`.${conversionType}`);
  const obj = await doesObjExist({ fileName: convertedFileName });

  if (obj) return await getSignedURL({ fileName: convertedFileName });
  else return await convertDoc({ fileName, conversionType });
};

const convertDoc = async ({
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

const doesObjExist = async ({ fileName }: { fileName: string }): Promise<boolean> => {
  try {
    await s3client
      .getObject({
        Bucket: Config.getMedicalDocumentsBucketName(),
        Key: fileName,
      })
      .promise();
    return true;
  } catch (error) {
    return false;
  }
};

const getSignedURL = async ({ fileName }: { fileName: string }): Promise<string> => {
  const seconds = 60;

  const url = s3client.getSignedUrl("getObject", {
    Bucket: Config.getMedicalDocumentsBucketName(),
    Key: fileName,
    Expires: seconds,
  });

  return url;
};
