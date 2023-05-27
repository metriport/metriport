import { z } from "zod";
import { makeS3Client } from "../../../external/aws/s3";
import { Config } from "../../../shared/config";
import { Util } from "../../../shared/util";
import { convertToHtml } from "./convertToHtml";
const s3client = makeS3Client();

const conversionTypeSchema = z.enum(["pdf", "html"]);

export const downloadDocument = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType: string | undefined;
}): Promise<string> => {
  if (conversionType) {
    const type = conversionTypeSchema.parse(conversionType);
    const document = await downloadDocumentFromS3({ fileName });

    if (type === "html") {
      const url = await convertStoreAndReturnHtmlDocUrl({ fileName, document });
      return url;
    }

    if (type === "pdf") {
      // const url = await convertStoreAndReturnPdfDocUrl({ fileName, document });
      // return url;
    }
  }

  const url = await getSignedUrl({ fileName });

  return url;
};

const downloadDocumentFromS3 = async ({ fileName }: { fileName: string }): Promise<string> => {
  const file = await s3client
    .getObject({
      Bucket: Config.getMedicalDocumentsBucketName(),
      Key: fileName,
    })
    .createReadStream();

  const fileContents = await Util.streamToString(file);

  return fileContents;
};

const convertStoreAndReturnHtmlDocUrl = async ({
  fileName,
  document,
}: {
  fileName: string;
  document: string;
}) => {
  const convertDoc = await convertToHtml(document);

  const newFileName = fileName.replace(".xml.ccda", ".html");

  await s3client
    .putObject({
      Bucket: Config.getMedicalDocumentsBucketName(),
      Key: newFileName,
      Body: convertDoc.toString(),
      ContentType: "text/html",
    })
    .promise();

  const urlHtml = await getSignedUrl({ fileName: newFileName });

  return urlHtml;
};

// const convertStoreAndReturnPdfDocUrl = async ({
//   fileName,
//   document,
// }: {
//   fileName: string;
//   document: string;
// }) => {
//   const convertDoc = await convertToHtml(document);
//   const newFileName = fileName.replace(".xml.ccda", ".html");
//   const options = { format: "A4" };

//   return "urlHtml";
// };

const getSignedUrl = async ({ fileName }: { fileName: string }): Promise<string> => {
  const seconds = 60;

  const url = s3client.getSignedUrl("getObject", {
    Bucket: Config.getMedicalDocumentsBucketName(),
    Key: fileName,
    Expires: seconds,
  });

  return url;
};
