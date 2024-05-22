var path = require("path");
var fs = require("fs");
var Promise = require("promise");
var compileCache = require("memory-cache");
var constants = require("../lib/constants/constantsnts");
var errorCodes = require("../lib/error/error").errorCodes;
var errorMessage = require("../lib/error/error").errorMessage;
var HandlebarsConverter = require("../lib/handlebars-converter/handlebars-converter");
var dataHandlerFactory = require("../lib/dataHandler/dataHandlerFactory");
var {
  extractEncounterTimePeriod,
  getEncompassingEncounterId,
} = require("../lib/inputProcessor/dateProcessor");

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
    path.join(constants.TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType),
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
  encompassingEncounterId
) {
  var result = dataTypeHandler.postProcessResult(
    template(dataContext, {
      data: { metriportPatientId: patientId, encounterTimePeriod, encompassingEncounterId },
    })
  );
  return Object.assign(dataTypeHandler.getConversionResultMetadata(dataContext.msg), {
    fhirResource: result,
  });
}

async function ccdaToFhir(ccda, patientId) {
  return new Promise((fulfill, reject) => {
    session.run(() => {
      if (!srcData || srcData.length == 0) {
        reject({
          status: 400,
          resultMsg: errorMessage(errorCodes.BadRequest, "No srcData provided."),
        });
      }
      if (!patientId) {
        reject({
          status: 400,
          resultMsg: errorMessage(errorCodes.BadRequest, "No patientId provided."),
        });
      }
      let srcData = ccda;
      let templateName = "ccd.hbs";
      let srcDataType = "cda";
      let encounterTimePeriod = extractEncounterTimePeriod(srcData);
      let dataTypeHandler = dataHandlerFactory.createDataHandler(srcDataType);
      let handlebarInstance = GetHandlebarsInstance(dataTypeHandler);
      let encompassingEncounterId = getEncompassingEncounterId(srcData);
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
      session.set(
        constants.CLS_KEY_TEMPLATE_LOCATION,
        path.join(constants.TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType)
      );

      const getTemplate = templateName => {
        return new Promise((fulfill, reject) => {
          var template = compileCache.get(templateName);
          if (!template) {
            fs.readFile(
              path.join(constants.TEMPLATE_FILES_LOCATION, srcDataType, templateName),
              (err, templateContent) => {
                if (err) {
                  reject({
                    status: 404,
                    resultMsg: errorMessage(errorCodes.NotFound, "Template not found"),
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
                      resultMsg: errorMessage(
                        errorCodes.BadRequest,
                        "Error during template compilation. " + convertErr.toString()
                      ),
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
                    encompassingEncounterId
                  ),
                });
              } catch (convertErr) {
                reject({
                  status: 400,
                  resultMsg: errorMessage(
                    errorCodes.BadRequest,
                    "Error during template evaluation. " + convertErr.toString()
                  ),
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
            resultMsg: errorMessage(
              errorCodes.BadRequest,
              `Unable to parse input data for template ${templateName}. ${err.toString()}`
            ),
          });
        });
    });
  });
}

exports.handler = async event => {
  const patientId = event.queryStringParameters.patientId;
  const ccda = event.body;
  try {
    const fhirResp = await ccdaToFhir(ccda, patientId);
    const response = {
      statusCode: 200,
      body: fhirResp.fhirResource,
    };
    return response;
  } catch (err) {
    console.log(`Error`, error);
    throw err;
  }
};
