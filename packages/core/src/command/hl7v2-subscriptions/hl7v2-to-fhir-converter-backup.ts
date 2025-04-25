// import { Hl7Message } from "@medplum/core";
// import { Bundle, Resource } from "@medplum/fhirtypes";
// import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
// import axios from "axios";
// import dayjs from "dayjs";
// import duration from "dayjs/plugin/duration";
// import { S3Utils, StoreInS3Params, storeInS3WithRetries } from "../../external/aws/s3";
// import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
// import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
// import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
// import { capture, out } from "../../util";
// import { Config } from "../../util/config";
// import { JSON_APP_MIME_TYPE } from "../../util/mime";
// import { convertHl7v2MessageToFhir } from "./hl7v2-to-fhir-conversion";
// import { getHl7MessageTypeOrFail } from "./hl7v2-to-fhir-conversion/msh";
// import {
//   buildHl7MessageCombinedBundleFileKey,
//   buildHl7MessageFhirBundleFileKey,
// } from "./hl7v2-to-fhir-conversion/shared";

// dayjs.extend(duration);

// const region = Config.getAWSRegion();

// const supportedTypes = ["A01", "A03"];
// const INTERNAL_HL7_ENDPOINT = `notification`;
// const INTERNAL_PATIENT_ENDPOINT = "internal/patient";
// const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

// type Hl7ToFhirLambdaProps = {
//   cxId: string;
//   patientId: string;
//   message: string;
//   messageId: string;
//   messageReceivedTimestamp: string;
//   apiUrl?: string;
//   bucketName?: string;
// };

// function getS3UtilsInstance(): S3Utils {
//   return new S3Utils(region);
// }

// export async function convertHl7MessageToFhirAndUpload({
//   cxId,
//   patientId,
//   message,
//   messageId,
//   messageReceivedTimestamp,
//   apiUrl,
//   bucketName,
// }: Hl7ToFhirLambdaProps): Promise<void> {
//   const baseUrl = apiUrl || Config.getApiLoadBalancerAddress();
//   const s3BucketName = bucketName || Config.getOutgoingHl7NotificationBucketName();

//   const { log } = out(`Hl7 to FHIR Lambda - cx: ${cxId}, pt: ${patientId}`);
//   log(`Converting message from ${messageReceivedTimestamp}`);

//   const hl7Message = Hl7Message.parse(message);
//   const s3Client = getS3UtilsInstance();
//   const internalHl7RouteUrl = `${baseUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}/${INTERNAL_HL7_ENDPOINT}`;
//   const internalGetPatientUrl = `${baseUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}?cxId=${cxId}`;

//   const msgType = getHl7MessageTypeOrFail(hl7Message);
//   if (!supportedTypes.includes(msgType.triggerEvent)) {
//     log(`Message type ${msgType.triggerEvent} is not supported. Skipping...`);
//     return;
//   }

//   const patient = await executeWithNetworkRetries(
//     async () => await axios.get(internalGetPatientUrl)
//   );
//   const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });

//   const convertedBundle = convertHl7v2MessageToFhir({
//     hl7Message,
//     cxId,
//     patientId,
//     messageId,
//     timestampString: messageReceivedTimestamp,
//   });

//   const newBundle = saturateConvertedBundle({
//     bundle: convertedBundle,
//     fhirPatient,
//   });

//   const sharedUploadParams: Omit<StoreInS3Params, "fileName" | "payload"> = {
//     s3Utils: s3Client,
//     bucketName: s3BucketName,
//     contentType: JSON_APP_MIME_TYPE,
//     log,
//     errorConfig: {
//       errorMessage: "Error uploading HL7 FHIR bundle to S3",
//       context: "convertHl7MessageToFhirAndUpload",
//       captureParams: {
//         patientId,
//         cxId,
//         messageReceivedTimestamp,
//       },
//       shouldCapture: true,
//     },
//   };

//   const newBundleFileName = buildHl7MessageFhirBundleFileKey({
//     cxId,
//     patientId,
//     timestamp: messageReceivedTimestamp,
//     messageId,
//     messageType: msgType.messageType,
//     messageCode: msgType.triggerEvent,
//   });

//   const newBundleUploadPromise = storeInS3WithRetries({
//     ...sharedUploadParams,
//     payload: JSON.stringify(newBundle),
//     fileName: newBundleFileName,
//   });

//   const combinedBundleFileName = buildHl7MessageCombinedBundleFileKey(cxId, patientId);
//   let combinedBundle = newBundle;
//   try {
//     const existingCombinedBundleRaw = await s3Client.downloadFile({
//       bucket: s3BucketName,
//       key: combinedBundleFileName,
//     });
//     const existingBundle = JSON.parse(existingCombinedBundleRaw.toString("utf-8"));
//     const mergedBundle = await mergeIncomingBundleIntoCombined({
//       cxId,
//       patientId,
//       existingBundle,
//       incomingBundle: newBundle,
//       log,
//     });
//     combinedBundle = mergedBundle;
//   } catch (err) {
//     log(`No existing combined bundle found. Creating a new one.`);
//     // intentionally not throwing
//   }

//   const combinedBundleUploadPromise = storeInS3WithRetries({
//     ...sharedUploadParams,
//     payload: JSON.stringify(combinedBundle),
//     fileName: combinedBundleFileName,
//     ...(sharedUploadParams.errorConfig
//       ? {
//           errorConfig: {
//             ...sharedUploadParams.errorConfig,
//             errorMessage: "Error uploading updated HL7 Combined FHIR bundle to S3",
//           },
//         }
//       : undefined),
//   });

//   const bundlePresignedUrlPromise = await s3Client.getSignedUrl({
//     bucketName: s3BucketName,
//     fileName: newBundleFileName,
//     durationSeconds: SIGNED_URL_DURATION_SECONDS,
//   });

//   const [, , bundlePresignedUrl] = await Promise.all([
//     newBundleUploadPromise,
//     combinedBundleUploadPromise,
//     bundlePresignedUrlPromise,
//   ]);

//   try {
//     await executeWithNetworkRetries(
//       async () =>
//         await axios.post(internalHl7RouteUrl, undefined, {
//           params: {
//             cxId,
//             patientId,
//             triggerEvent: msgType.triggerEvent,
//             presignedUrl: bundlePresignedUrl,
//           },
//         })
//     );
//     log(`Successfully sent HL7 FHIR bundle to the API`);
//   } catch (err) {
//     log(`Error hitting the API endpoint: - ${errorToString(err)}`);
//     throw err;
//   }
// }

// function saturateConvertedBundle({
//   bundle,
//   fhirPatient,
// }: {
//   bundle: Bundle<Resource>;
//   fhirPatient: Resource;
// }): Bundle<Resource> {
//   const fhirPatientEntry = buildBundleEntry(fhirPatient);
//   const combinedEntries = bundle.entry ? [fhirPatientEntry, ...bundle.entry] : [];
//   return buildBundle({ type: "collection", entries: combinedEntries });
// }

// async function mergeIncomingBundleIntoCombined({
//   cxId,
//   patientId,
//   existingBundle,
//   incomingBundle,
//   log,
// }: {
//   cxId: string;
//   patientId: string;
//   existingBundle: Bundle<Resource>;
//   incomingBundle: Bundle<Resource>;
//   log: typeof console.log;
// }) {
//   try {
//     const combinedEntries = [existingBundle, incomingBundle].flatMap((bundle) => bundle.entry || []);
//     const combinedBundle = buildBundle({
//       type: "collection",
//       entries: combinedEntries,
//     });

//     const dedupedCombinedBundle = await deduplicate({
//       cxId,
//       patientId,
//       bundle: combinedBundle,
//     });
//     log(`Combined and deduped the incoming bundle with the existing one.`);

//     return dedupedCombinedBundle;
//   } catch (error) {
//     log(`Error during bundle merging or deduplication: ${errorToString(error)}`);
//     capture.error("Failed to merge or deduplicate bundles", {
//       extra: {
//         patientId,
//         cxId,
//         error,
//         entriesCount: {
//           existing: existingBundle.entry?.length || 0,
//           incoming: incomingBundle.entry?.length || 0,
//         },
//       },
//     });
//     // Return the incoming bundle as fallback
//     return incomingBundle;
//   }
// }

// export function buildHl7MessageCombinedBundleFileKey(cxId: string, patientId: string) {
//     return `${createFolderName(cxId, patientId)}/COMBINED_BUNDLE${JSON_FILE_EXTENSION}`;
//   }
