// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var path = require("path");
var fs = require("fs");
var Promise = require("promise");
var compileCache = require("memory-cache");
var constants = require("../constants/constants");
var errorCodes = require("../error/error").errorCodes;
var errorMessage = require("../error/error").errorMessage;
var HandlebarsConverter = require("../handlebars-converter/handlebars-converter");
var WorkerUtils = require("./workerUtils");
var dataHandlerFactory = require("../dataHandler/dataHandlerFactory");
var {
  extractEncounterTimePeriod,
  getEncompassingEncounterId,
} = require("../inputProcessor/dateProcessor");
var { v4: uuidv4 } = require("uuid");

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

function expireCache() {
  rebuildCache = true;
  compileCache.clear();
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

WorkerUtils.workerTaskProcessor(msg => {
  return new Promise((fulfill, reject) => {
    session.run(() => {
      switch (msg.type) {
        case "/api/convert/:srcDataType":
          {
            try {
              const base64RegEx = /^[a-zA-Z0-9/\r\n+]*={0,2}$/;

              if (!base64RegEx.test(msg.srcDataBase64)) {
                reject({
                  status: 400,
                  resultMsg: errorMessage(
                    errorCodes.BadRequest,
                    "srcData is not a base 64 encoded string."
                  ),
                });
              }

              if (!base64RegEx.test(msg.templateBase64)) {
                reject({
                  status: 400,
                  resultMsg: errorMessage(
                    errorCodes.BadRequest,
                    "Template is not a base 64 encoded string."
                  ),
                });
              }

              var templatesMap = undefined;
              if (msg.templatesOverrideBase64) {
                if (!base64RegEx.test(msg.templatesOverrideBase64)) {
                  reject({
                    status: 400,
                    resultMsg: errorMessage(
                      errorCodes.BadRequest,
                      "templatesOverride is not a base 64 encoded string."
                    ),
                  });
                }
                templatesMap = JSON.parse(
                  Buffer.from(msg.templatesOverrideBase64, "base64").toString()
                );
              }

              var templateString = "";
              if (msg.templateBase64) {
                templateString = Buffer.from(msg.templateBase64, "base64").toString();
              }

              try {
                var b = Buffer.from(msg.srcDataBase64, "base64");
                var s = b.toString();
              } catch (err) {
                reject({
                  status: 400,
                  resultMsg: errorMessage(
                    errorCodes.BadRequest,
                    `Unable to parse input data from b64. ${err.message}`
                  ),
                });
              }
              var dataTypeHandler = dataHandlerFactory.createDataHandler(msg.srcDataType);
              let handlebarInstance = GetHandlebarsInstance(dataTypeHandler, templatesMap);
              session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
              session.set(
                constants.CLS_KEY_TEMPLATE_LOCATION,
                path.join(constants.TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType)
              );

              dataTypeHandler
                .parseSrcData(s)
                .then(parsedData => {
                  var dataContext = { msg: parsedData };
                  if (templateString == null || templateString.length == 0) {
                    var result = Object.assign(
                      dataTypeHandler.getConversionResultMetadata(dataContext.msg),
                      JSON.parse(JSON.stringify(dataContext.msg))
                    );

                    fulfill({ status: 200, resultMsg: result });
                  } else {
                    var template = handlebarInstance.compile(
                      dataTypeHandler.preProcessTemplate(templateString)
                    );

                    try {
                      fulfill({
                        status: 200,
                        resultMsg: generateResult(dataTypeHandler, dataContext, template),
                      });
                    } catch (err) {
                      reject({
                        status: 400,
                        resultMsg: errorMessage(
                          errorCodes.BadRequest,
                          "Unable to create result: " + err.toString()
                        ),
                      });
                    }
                  }
                })
                .catch(err => {
                  reject({
                    status: 400,
                    resultMsg: errorMessage(
                      errorCodes.BadRequest,
                      `Unable to parse input data for data type ${
                        dataTypeHandler.dataType
                      }. ${err.toString()}`
                    ),
                  });
                });
            } catch (err) {
              reject({
                status: 400,
                resultMsg: errorMessage(errorCodes.BadRequest, `${err.toString()}`),
              });
            }
          }
          break;

        case "/api/convert/:srcDataType/:template":
          {
            let srcData = msg.srcData;
            let templateName = msg.templateName;
            let srcDataType = msg.srcDataType;
            let patientId = msg.patientId;
            let encounterTimePeriod = extractEncounterTimePeriod(srcData);
            let dataTypeHandler = dataHandlerFactory.createDataHandler(srcDataType);
            let handlebarInstance = GetHandlebarsInstance(dataTypeHandler);
            let encompassingEncounterId = getEncompassingEncounterId(srcData);
            session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
            session.set(
              constants.CLS_KEY_TEMPLATE_LOCATION,
              path.join(constants.TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType)
            );

            if (!srcData || srcData.length == 0) {
              reject({
                status: 400,
                resultMsg: errorMessage(errorCodes.BadRequest, "No srcData provided."),
              });
            }

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
          }
          break;

        case "templatesUpdated":
          {
            expireCache();
            fulfill();
          }
          break;

        case "constantsUpdated":
          {
            constants = JSON.parse(msg.data);
            expireCache();
            fulfill();
          }
          break;
      }
    });
  });
});
