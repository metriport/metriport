import {
  ConversionType,
  Input as ConvertDocInput,
  Output as ConvertDocOutput,
  validConversionTypes,
} from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { getLambdaResultPayload } from "@metriport/core/external/aws/lambda";
import dayjs from "dayjs";
import BadRequestError from "../../../errors/bad-request";
import NotFoundError from "../../../errors/not-found";
import { makeLambdaClient } from "../../../external/aws/lambda";
import { makeS3Client } from "../../../external/aws/s3";
import { Config } from "../../../shared/config";

const URL_EXPIRATION_TIME = dayjs.duration(5, "minutes");
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
  return getSignedURL({ fileName, bucketName });
};

const getConversionUrl = async ({
  fileName,
  conversionType,
  bucketName,
}: ConvertDocInput): Promise<string> => {
  const convertedFileName = fileName.concat(`.${conversionType}`);
  const { exists, bucketName: bucketContainingObj } = await doesObjExist({
    fileName: convertedFileName,
  });

  if (exists) return getSignedURL({ fileName: convertedFileName, bucketName: bucketContainingObj });
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
        `Could not find seed file ${fileName} in the ${Config.getSandboxSeedBucketName()} bucket - trying ${Config.getMedicalDocumentsBucketName()}`
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

export const getSignedURL = async ({
  fileName,
  bucketName,
}: {
  fileName: string;
  bucketName?: string;
}): Promise<string> => {
  const urlExpirationSeconds = URL_EXPIRATION_TIME.asSeconds();
  const bucket =
    bucketName ??
    (Config.isSandbox()
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Config.getSandboxSeedBucketName()!
      : Config.getMedicalDocumentsBucketName());

  const url = await s3client.getSignedUrlPromise("getObject", {
    Bucket: bucket,
    Key: fileName,
    Expires: urlExpirationSeconds,
  });

  // TODO try to remove this, moved here b/c this was being done upstream
  return url.replace(/['"]+/g, "");
};
