import {
  ConversionType,
  Input as ConvertDocInput,
  Output as ConvertDocOutput,
  validConversionTypes,
} from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { getLambdaResultPayload } from "@metriport/core/external/aws/lambda";
import BadRequestError from "../../../errors/bad-request";
import NotFoundError from "../../../errors/not-found";
import { makeLambdaClient } from "../../../external/aws/lambda";
import { makeS3Client } from "../../../external/aws/s3";
import { Config } from "../../../shared/config";
import dayjs from "dayjs";

const SIGNED_URL_EXPIRATION_MINUTES = 5;
const s3client = makeS3Client();
const lambdaClient = makeLambdaClient();
const conversionLambdaName = Config.getConvertDocLambdaName();

export const downloadDocument = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType?: ConversionType;
}): Promise<string> => {
  const { exists, contentType, bucketName } = await doesObjExist({ fileName });

  if (!exists) throw new NotFoundError("File does not exist");

  if (conversionType && contentType !== "application/xml" && contentType !== "text/xml")
    throw new BadRequestError(
      `Source file must be xml to convert to ${conversionType}, but it was ${contentType}`
    );

  if (conversionType && validConversionTypes.includes(conversionType) && bucketName) {
    return getConversionUrl({ fileName, conversionType, bucketName });
  }
  return getSignedURL({ fileName });
};

const getConversionUrl = async ({
  fileName,
  conversionType,
  bucketName,
}: ConvertDocInput): Promise<string> => {
  const convertedFileName = fileName.concat(`.${conversionType}`);
  const { exists } = await doesObjExist({ fileName: convertedFileName });

  if (exists) return getSignedURL({ fileName: convertedFileName });
  else return convertDoc({ fileName, conversionType, bucketName });
};

export const convertDoc = async ({
  fileName,
  conversionType,
  bucketName,
}: ConvertDocInput): Promise<string> => {
  if (!conversionLambdaName) throw new Error("Conversion Lambda Name is undefined");

  const result = await lambdaClient
    .invoke({
      FunctionName: conversionLambdaName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ fileName, conversionType, bucketName }),
    })
    .promise();
  const resultPayload = getLambdaResultPayload({ result, lambdaName: conversionLambdaName });
  const parsedResult = JSON.parse(resultPayload) as ConvertDocOutput;
  return parsedResult.url;
};

const doesObjExist = async ({
  fileName,
}: {
  fileName: string;
}): Promise<
  | { exists: true; contentType: string; bucketName?: string }
  | { exists: false; contentType?: never; bucketName?: never }
> => {
  if (Config.isSandbox()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const bucketName = Config.getSandboxSeedBucketName()!;
      const head = await s3client
        .headObject({
          Bucket: bucketName,
          Key: fileName,
        })
        .promise();

      return {
        exists: true,
        contentType: head.ContentType ?? "",
        bucketName: bucketName,
      };
    } catch (error) {
      console.log(
        `Could not find seed file ${fileName} in the ${Config.getSandboxSeedBucketName()} bucket - trying medical documents bucket`
      );
    }
  }

  try {
    const bucketName = Config.getMedicalDocumentsBucketName();
    const head = await s3client
      .headObject({
        Bucket: bucketName,
        Key: fileName,
      })
      .promise();

    return {
      exists: true,
      contentType: head.ContentType ?? "",
      bucketName: bucketName,
    };
  } catch (error) {
    return { exists: false };
  }
};

export const getSignedURL = async ({ fileName }: { fileName: string }): Promise<string> => {
  const expirationTimeSeconds = dayjs
    .duration(SIGNED_URL_EXPIRATION_MINUTES, "minutes")
    .asSeconds();

  const url = s3client.getSignedUrl("getObject", {
    // TODO 760 Fix this
    Bucket: Config.isSandbox()
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Config.getSandboxSeedBucketName()!
      : Config.getMedicalDocumentsBucketName(),
    Key: fileName,
    Expires: expirationTimeSeconds,
  });

  // TODO try to remove this, moved here b/c this was being done upstream
  return url.replace(/['"]+/g, "");
};
