import { out } from "../../../../util/log";

export async function getDocument({
  cxId,
  patientId,
  documentId,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
}): Promise<string> {
  const { log } = out(`sde.getDocument - cx ${cxId}, pat ${patientId}, doc ${documentId}`);
  log("Getting document...");
  return "todo";
}

// const documentBundles: Bundle[] = [];

// await executeAsynchronously(documentKeys, async documentKey => {
//   if (! documentKey.endsWith(documentKeyFilter)) return;
//   const document = await s3.downloadFile({ bucket: bucketName, key: documentKey });
//   log(`Downloaded document: ${document}`);
//   const bundle = parseFhirBundle(document.toString());
//   if (!bundle) return;
//   documentBundles.push(bundle);
// }, {
//   numberOfParallelExecutions,
// });

// return documentBundles;
