// -------------------------------------------------------------------------------------------------
// Copyright (c) 2022-present Metriport Inc.
//
// Licensed under AGPLv3. See LICENSE in the repo root for license information.
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//     Copyright (c) Microsoft Corporation. All rights reserved.
//
//     Permission to use, copy, modify, and/or distribute this software
//     for any purpose with or without fee is hereby granted, provided
//     that the above copyright notice and this permission notice appear
//     in all copies.
//
//     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
//     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
//     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
//     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
//     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
//     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
//     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
//     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
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
  encompassingEncounterIds,
  isDebug
) {
  try {
    var result = dataTypeHandler.postProcessResult(
      template(dataContext, {
        data: { metriportPatientId: patientId, encounterTimePeriod, encompassingEncounterIds },
      })
    );
    return Object.assign(dataTypeHandler.getConversionResultMetadata(dataContext.msg), {
      fhirResource: result,
    });
  } catch (err) {
    if (isDebug) console.log(`[patient ${patientId}] DEBUG Error: ${err?.message}`, err?.stack);
    throw err;
  }
}

WorkerUtils.workerTaskProcessor(msg => {
  return new Promise((fulfill, reject) => {
    session.run(() => {
      const startTime = new Date().getTime();
      const nowIso = new Date().toISOString();
      const getDuration = () => new Date().getTime() - startTime;

      // Cleanup function to ensure session state is reset
      const cleanup = () => {
        try {
          session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, null);
          session.set(constants.CLS_KEY_TEMPLATE_LOCATION, null);
        } catch (cleanupErr) {
          console.error(`[worker] Error during cleanup: ${cleanupErr.message}`);
        }
      };

      try {
        switch (msg.type) {
          case "/api/convert/:srcDataType/:template":
            {
              let srcData = msg.srcData;
              let templateName = msg.templateName;
              let srcDataType = msg.srcDataType;
              let patientId = msg.patientId;
              let fileName = msg.fileName;
              const isDebug = msg.isDebug;

              console.log(`[patient ${patientId}] Processing file ${fileName} at ${nowIso}`);

              let encounterTimePeriod = extractEncounterTimePeriod(srcData);
              let dataTypeHandler = dataHandlerFactory.createDataHandler(srcDataType);
              let handlebarInstance = GetHandlebarsInstance(dataTypeHandler);
              let encompassingEncounterIds = getEncompassingEncounterId(srcData);
              session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
              session.set(
                constants.CLS_KEY_TEMPLATE_LOCATION,
                path.join(constants.TEMPLATE_FILES_LOCATION, dataTypeHandler.dataType)
              );

              if (!srcData || srcData.length == 0) {
                cleanup();
                reject({
                  status: 400,
                  resultMsg: errorMessage(errorCodes.BadRequest, "No srcData provided."),
                  duration: getDuration(),
                });
                return;
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
                            duration: getDuration(),
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
                                "Error during template compilation. " + errorToString(convertErr)
                              ),
                              duration: getDuration(),
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
                            encompassingEncounterIds,
                            isDebug
                          ),
                          duration: getDuration(),
                        });
                      } catch (convertErr) {
                        cleanup();
                        reject({
                          status: 400,
                          resultMsg: errorMessage(
                            errorCodes.BadRequest,
                            "Error during template evaluation. " + errorToString(convertErr)
                          ),
                          duration: getDuration(),
                        });
                      }
                    },
                    err => {
                      cleanup();
                      reject(err);
                    }
                  );
                })
                .catch(err => {
                  cleanup();
                  console.error(
                    `Error parsing input data for template ${templateName}: ${errorToString(
                      err
                    )}, fileName: ${fileName}`
                  );
                  console.error(err.stack);
                  reject({
                    status: 400,
                    resultMsg: errorMessage(
                      errorCodes.BadRequest,
                      `Unable to parse input data for template ${templateName}. ${errorToString(
                        err
                      )}`
                    ),
                    duration: getDuration(),
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

          default:
            cleanup();
            reject({
              status: 400,
              resultMsg: errorMessage(errorCodes.BadRequest, `Unknown message type: ${msg.type}`),
              duration: getDuration(),
            });
        }
      } catch (unhandledError) {
        cleanup();
        console.error(
          `[worker] Unhandled error in worker task processor: ${
            unhandledError.stack ?? errorToString(unhandledError) ?? unhandledError
          }`
        );
        reject({
          status: 500,
          resultMsg: errorMessage(
            errorCodes.InternalServerError,
            `Worker error: ${unhandledError.message}`
          ),
          duration: getDuration(),
        });
      }
    });
  });
});

function errorToString(err) {
  return err ? err.toString().slice(0, 40) : undefined;
}
