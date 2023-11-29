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
import { searchDocuments } from "../../../external/fhir/document/search-documents";
import { chunk } from "lodash";
import { processPatientDocumentRequest, MAPIWebhookStatus } from "./document-webhook";
import {
  DocumentBulkDownloadDTO,
  toDTO,
} from "../../../routes/medical/dtos/document-bulk-downloadDTO";

import { DocumentBulkDownloadProgress } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";
import { getSignedUrls } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";

const BATCH_SIZE = 100;
const s3client = makeS3Client();
const lambdaClient = makeLambdaClient();
const conversionLambdaName = Config.getConvertDocLambdaName();
const bulkSigningLambdaName = Config.getBulkUrlSigningLambdaName();

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
  const seconds = 60;

  const url = s3client.getSignedUrl("getObject", {
    // TODO 760 Fix this
    Bucket: Config.isSandbox()
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Config.getSandboxSeedBucketName()!
      : Config.getMedicalDocumentsBucketName(),
    Key: fileName,
    Expires: seconds,
  });

  // TODO try to remove this, moved here b/c this was being done upstream
  return url.replace(/['"]+/g, "");
};

export const triggerBulkUrlSigning = async (
  cxId: string,
  patientId: string
): Promise<DocumentBulkDownloadProgress> => {
  if (!bulkSigningLambdaName) throw new Error("Bulk Signing Lambda Name is undefined");

  const documents = await searchDocuments({ cxId, patientId });
  // Todo remove this
  console.log("Doc Ref Payload", documents[0]);

  const batches = chunk(documents, BATCH_SIZE);

  const documentBulkDownloadProgress: DocumentBulkDownloadProgress = {};
  documentBulkDownloadProgress.download = {
    status: "processing",
    total: documents.length,
  };

  // Process each batch
  for (const batch of batches) {
    const dtos: DocumentBulkDownloadDTO[] = [];
    const payload = {
      filenames: batch
        .map(doc => {
          if (doc.content && doc.content[0] && doc.content[0].attachment) {
            return doc.content[0].attachment.title;
          }
          return undefined;
        })
        .filter((filename): filename is string => filename !== undefined),
    };

    // Invoke the lambda function
    // const result = await lambdaClient
    //   .invoke({
    //     FunctionName: bulkSigningLambdaName,
    //     InvocationType: "RequestResponse",
    //     Payload: JSON.stringify(payload),
    //   })
    //   .promise();

    // const resultPayload = getLambdaResultPayload({ result, lambdaName: bulkSigningLambdaName });
    // const parsedResult = JSON.parse(resultPayload);

    const parsedResult: string[] = await getSignedUrls(
      payload.filenames,
      Config.getMedicalDocumentsBucketName(),
      "us-east-2"
    );
    console.log("Parsed Result", parsedResult);

    // Create DTOs for each signed URL
    for (let i = 0; i < parsedResult.length; i++) {
      const signedUrl = parsedResult[i];
      const doc = batch[i];
      const dto = toDTO(doc, signedUrl);
      if (dto) {
        dtos.push(dto);
      }
    }

    // Collect the URLs
    processPatientDocumentRequest(
      cxId,
      patientId,
      "medical.document-bulk-download",
      MAPIWebhookStatus.completed,
      dtos
    );
  }
  return documentBulkDownloadProgress;
};
