var path = require("path");
var fs = require("fs");
var Promise = require("promise");
var compileCache = require("memory-cache");
var constants = require("./lib/constants/constants");
var HandlebarsConverter = require("./lib/handlebars-converter/handlebars-converter");
var dataHandlerFactory = require("./lib/dataHandler/dataHandlerFactory");
var {
  extractEncounterTimePeriod,
  getEncompassingEncounterId,
} = require("./lib/inputProcessor/dateProcessor");

const { createNamespace } = require("cls-hooked");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

const AWS_REGION = process.env.AWS_REGION;
if (!AWS_REGION) throw new Error("Missing AWS_REGION env var");

const s3Client = new S3Client({ region: AWS_REGION });

async function getPayloadFromS3({ bucket, key, log }) {
  const ehrConversionBucket = process.env.EHR_FHIR_CONVERTER_S3_BUCKET;
  const fhirConverterBucket = process.env.FHIR_CONVERTER_S3_BUCKET;

  log(`Getting payload from S3: bucket=${bucket}, key=${key}`);
  if (!bucket) {
    throw new Error("S3 bucket not configured.");
  }

  if (bucket !== ehrConversionBucket && bucket !== fhirConverterBucket) {
    throw new Error(`Invalid S3 bucket: ${bucket}`);
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error("S3 GetObject returned no body");
  }
  const payload = await response.Body.transformToString();
  log(`Got payload from S3, size: ${payload.length} bytes`);
  return payload;
}
var session = createNamespace(constants.CLS_NAMESPACE);

var rebuildCache = true;

function GetHandlebarsInstance(dataTypeHandler, templatesMap) {
  // New instance should be created when using templatesMap
  let needToUseMap =
    templatesMap && Object.entries(templatesMap).length > 0 && templatesMap.constructor === Object;
  var instance = HandlebarsConverter.instance(
    needToUseMap ? true : rebuildCache,
    dataTypeHandler,
    path.join(process.cwd(), constants.BASE_TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType),
    templatesMap
  );
  rebuildCache = needToUseMap ? true : false; // New instance should be created also after templatesMap usage

  return instance;
}

function generateResult(
  dataTypeHandler,
  dataContext,
  template,
  patientId,
  encounterTimePeriod,
  encompassingEncounterIds
) {
  var result = dataTypeHandler.postProcessResult(
    template(dataContext, {
      data: { metriportPatientId: patientId, encounterTimePeriod, encompassingEncounterIds },
    })
  );
  return Object.assign(dataTypeHandler.getConversionResultMetadata(dataContext.msg), {
    fhirResource: result,
  });
}

async function ccdaToFhir(ccda, patientId) {
  return new Promise((fulfill, reject) => {
    session.run(() => {
      let srcData = ccda;
      if (!srcData || srcData.length == 0) {
        reject({
          status: 400,
          resultMsg: "No srcData provided.",
        });
      }
      if (!patientId) {
        reject({
          status: 400,
          resultMsg: "No patientId provided.",
        });
      }
      let templateName = "ccd.hbs";
      let srcDataType = "cda";
      let encounterTimePeriod = extractEncounterTimePeriod(srcData);
      let dataTypeHandler = dataHandlerFactory.createDataHandler(srcDataType);
      let handlebarInstance = GetHandlebarsInstance(dataTypeHandler);
      let encompassingEncounterIds = getEncompassingEncounterId(srcData);
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
      session.set(
        constants.CLS_KEY_TEMPLATE_LOCATION,
        path.join(process.cwd(), constants.BASE_TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType)
      );

      const getTemplate = templateName => {
        return new Promise((fulfill, reject) => {
          var template = compileCache.get(templateName);
          if (!template) {
            fs.readFile(
              path.join(
                process.cwd(),
                constants.BASE_TEMPLATE_FILES_LOCATION,
                srcDataType,
                templateName
              ),
              (err, templateContent) => {
                if (err) {
                  reject({
                    status: 404,
                    resultMsg: "Template not found",
                  });
                } else {
                  try {
                    template = handlebarInstance.compile(
                      dataTypeHandler.preProcessTemplate(templateContent.toString())
                    );
                    compileCache.put(templateName, template);
                    fulfill(template);
                  } catch (convertErr) {
                    reject({
                      status: 400,
                      resultMsg: "Error during template compilation. " + convertErr.toString(),
                    });
                  }
                }
              }
            );
          } else {
            fulfill(template);
          }
        });
      };

      dataTypeHandler
        .parseSrcData(srcData)
        .then(parsedData => {
          var dataContext = {
            msg: parsedData,
          };
          // console.log(dataContext);
          getTemplate(templateName).then(
            compiledTemplate => {
              try {
                fulfill({
                  status: 200,
                  resultMsg: generateResult(
                    dataTypeHandler,
                    dataContext,
                    compiledTemplate,
                    patientId,
                    encounterTimePeriod,
                    encompassingEncounterIds
                  ),
                });
              } catch (convertErr) {
                reject({
                  status: 400,
                  resultMsg: "Error during template evaluation. " + convertErr.toString(),
                });
              }
            },
            err => {
              reject(err);
            }
          );
        })
        .catch(err => {
          reject({
            status: 400,
            resultMsg: `Unable to parse input data for template ${templateName}. ${err.toString()}`,
          });
        });
    });
  });
}

function buildSuccessResponse(payload) {
  return {
    statusCode: 200,
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

function buildErrorResponse(status, message) {
  return {
    statusCode: status,
    body: JSON.stringify({ status, detail: message }),
    headers: {
      "Content-Type": "application/json",
    },
  };
}

async function uploadPayloadToS3(payload, bucket, key, log) {
  const newKey = buildKey(key);
  const command = new PutObjectCommand({
    Key: newKey,
    Bucket: bucket,
    Body: bundleToBuffer(payload),
  });
  await s3Client.send(command);
  log(`Uploaded payload to S3: bucket=${bucket}, key=${newKey}`);
  return newKey;
}

function buildKey(key) {
  return `${key}_ConvertedToFhir.json`;
}

function bundleToBuffer(bundle) {
  const { entry, ...rest } = bundle;
  const restJson = JSON.stringify(rest);
  const prefix = restJson.slice(0, -1);
  const chunks = [Buffer.from(prefix)];
  if (entry) {
    const comma = prefix.length > 1 ? "," : "";
    chunks.push(Buffer.from(comma + '"entry":['));
    for (let i = 0; i < entry.length; i++) {
      chunks.push(Buffer.from((i > 0 ? "," : "") + JSON.stringify(entry[i])));
    }
    chunks.push(Buffer.from("]"));
  }
  chunks.push(Buffer.from("}"));
  return Buffer.concat(chunks);
}

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId;
  function log(...args) {
    console.log(`[${requestId}]`, ...args);
  }

  log(`event.queryStringParameters`, JSON.stringify(event.queryStringParameters));
  const queryParams = event.queryStringParameters || {};
  const patientId = queryParams.patientId || "";
  const s3Key = queryParams.s3Key;
  const s3Bucket = queryParams.s3Bucket;

  if (!s3Key) {
    return buildErrorResponse(400, "Missing required parameter: s3Key");
  }

  if (!s3Bucket) {
    return buildErrorResponse(400, "Missing required parameter: s3Bucket");
  }

  try {
    const ccda = await getPayloadFromS3({ bucket: s3Bucket, key: s3Key, log });
    const fhirResp = await ccdaToFhir(ccda, patientId);
    log(`Converted to FHIR bundle successfully!`);
    const outputS3Key = await uploadPayloadToS3(
      fhirResp.resultMsg.fhirResource,
      s3Bucket,
      s3Key,
      log
    );
    return buildSuccessResponse({ s3Key: outputS3Key, s3BucketName: s3Bucket });
  } catch (err) {
    log(`Error ${JSON.stringify(err.message)}, stack: ${JSON.stringify(err.stack)}`);
    if (err.status && err.resultMsg) {
      return buildErrorResponse(err.status, err.resultMsg);
    }

    return buildErrorResponse(500, "Something went wrong, ping support@metriport.com for help!");
  }
};
