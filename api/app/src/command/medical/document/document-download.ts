import { makeLambdaClient } from "../../../external/aws/lambda";
import { makeS3Client } from "../../../external/aws/s3";
import { Config } from "../../../shared/config";
import { DocConversionType } from "../../../routes/medical/schemas/documents";
import NotFoundError from "../../../errors/not-found";
import BadRequestError from "../../../errors/bad-request";

const lambdaClient = makeLambdaClient();
const s3client = makeS3Client();

const htmlConversionType = "html";
const pdfConversionType = "pdf";

export const downloadDocument = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType?: DocConversionType;
}): Promise<string> => {
  const { exists, contentType } = await doesObjExist({ fileName });

  if (!exists) throw new NotFoundError("File does not exist");

  if (conversionType && contentType !== "application/xml" && contentType !== "text/xml")
    throw new BadRequestError(
      `Source file must be xml to convert to ${conversionType}, but it was ${contentType}`
    );

  let url;

  if (conversionType === htmlConversionType) {
    url = await getConversionUrl({ fileName, conversionType });
  } else if (conversionType === pdfConversionType) {
    url = await getConversionUrl({ fileName, conversionType });
  } else {
    url = await getSignedURL({ fileName });
  }

  return url;
};

const getConversionUrl = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType?: string;
}): Promise<string> => {
  const convertedFileName = fileName.concat(`.${conversionType}`);
  const { exists } = await doesObjExist({ fileName: convertedFileName });

  if (exists) return getSignedURL({ fileName: convertedFileName });
  else return convertDoc({ fileName, conversionType });
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

const doesObjExist = async ({
  fileName,
}: {
  fileName: string;
}): Promise<{ exists: true; contentType: string } | { exists: false; contentType?: never }> => {
  try {
    const head = await s3client
      .headObject({
        Bucket: Config.getMedicalDocumentsBucketName(),
        Key: fileName,
      })
      .promise();
    return { exists: true, contentType: head.ContentType ?? "" };
  } catch (error) {
    return { exists: false };
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
