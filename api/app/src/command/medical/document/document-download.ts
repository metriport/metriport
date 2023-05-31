import { makeLambdaClient } from "../../../external/aws/lambda";
import { makeS3Client } from "../../../external/aws/s3";
import { Config } from "../../../shared/config";
import { DocConversionType } from "../../../routes/medical/schemas/documents";

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
  let url;

  if (conversionType === htmlConversionType) {
    url = await getConversionUrl({ fileName, conversionType });
  } else if (conversionType === pdfConversionType) {
    url = await getConversionUrl({ fileName, conversionType });
  } else {
    url = await getSignedURL({ fileName });
  }

  if (!url) throw new Error("Invalid conversion type for conversion");

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
  const { exists, contentType } = await doesObjExist({ fileName: convertedFileName });

  if (exists) {
    return getSignedURL({ fileName: convertedFileName });
  } else if (contentType === "application/xml" || contentType === "text/xml") {
    return convertDoc({ fileName, conversionType });
  } else {
    throw new Error("Invalid file type for conversion");
  }
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
