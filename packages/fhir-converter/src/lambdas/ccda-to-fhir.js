var path = require("path");
var fs = require("fs");
var Promise = require("promise");
var compileCache = require("memory-cache");
var constants = require("./lib/constants/constants");
var errorCodes = require("./lib/error/error").errorCodes;
var errorMessage = require("./lib/error/error").errorMessage;
var HandlebarsConverter = require("./lib/handlebars-converter/handlebars-converter");
var dataHandlerFactory = require("./lib/dataHandler/dataHandlerFactory");
var {
  extractEncounterTimePeriod,
  getEncompassingEncounterId,
} = require("./lib/inputProcessor/dateProcessor");

const { createNamespace } = require("cls-hooked");
var session = createNamespace(constants.CLS_NAMESPACE);

var rebuildCache = true;

function GetHandlebarsInstance(dataTypeHandler, templatesMap) {
  // New instance should be created when using templatesMap
  let needToUseMap =
    templatesMap && Object.entries(templatesMap).length > 0 && templatesMap.constructor === Object;
  var instance = HandlebarsConverter.instance(
    needToUseMap ? true : rebuildCache,
    dataTypeHandler,
    path.join(constants.BASE_TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType),
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
        path.join(constants.BASE_TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType)
      );

      const getTemplate = templateName => {
        return new Promise((fulfill, reject) => {
          var template = compileCache.get(templateName);
          if (!template) {
            fs.readFile(
              path.join(constants.BASE_TEMPLATE_FILES_LOCATION, srcDataType, templateName),
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

exports.handler = async event => {
  const patientId = event.queryStringParameters ? event.queryStringParameters.patientId : "";
  const ccda = event.body;
  try {
    const fhirResp = await ccdaToFhir(ccda, patientId);
    console.log(`Converted to FHIR bundle successfully!`);
    return buildSuccessResponse(fhirResp.resultMsg.fhirResource);
  } catch (err) {
    console.log(`Error`, JSON.stringify(err));
    if (err.status && err.resultMsg) {
      return buildErrorResponse(err.status, err.resultMsg);
    }

    return buildErrorResponse(500, "Something went wrong, ping support@metriport.com for help!");
  }
};
