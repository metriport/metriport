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

var constants = require("./lib/constants/constants");
var express = require("express");
var cookieParser = require("cookie-parser");
var errorCodes = require("./lib/error/error").errorCodes;
var errorMessage = require("./lib/error/error").errorMessage;
var fs = require("fs");
var fse = require("fs-extra");
var path = require("path");
var bodyParser = require("body-parser");
var swaggerUi = require("swagger-ui-express");
var swaggerJSDoc = require("swagger-jsdoc");
var WorkerPool = require("./lib/workers/workerPool");
var fileSystemCache = require("./lib/fsCache/cache");
var ncp = require("ncp").ncp;

module.exports = function (app) {
  const amountOfWorkers = require("os").cpus().length;
  console.log(
    `Creating a pool of ${amountOfWorkers} workers (${require("os").cpus().length} vCPUs)`
  );
  const workerPool = new WorkerPool("./src/lib/workers/worker.js", amountOfWorkers);
  let templateCache = new fileSystemCache(constants.TEMPLATE_FILES_LOCATION);
  templateCache.init();
  app.use(bodyParser.json({ limit: "50mb", extended: true }));
  app.use(bodyParser.text({ limit: "50mb", extended: true }));

  // access function for constants (test instrumentation)
  app.getConstants = function () {
    return constants;
  };

  // access function for constants  (test instrumentation)
  app.setConstants = function (c) {
    constants = c;
    templateCache = new fileSystemCache(c.TEMPLATE_FILES_LOCATION);
    workerPool.broadcast({ type: "constantsUpdated", data: JSON.stringify(c) });
  };

  const swaggerSpec = swaggerJSDoc({
    swaggerDefinition: {
      info: {
        title: "FHIR Converter API",
        // If changing the version update the checks in convert/hl7 and convert/hl7/:template
        version: "1.0",
      },
    },
    apis: [__filename],
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  app.use(cookieParser());

  /**
   * @swagger
   * /api/UpdateBaseTemplates:
   *   post:
   *     description: Updates base templates (deletes existing data). This should be used only when latest version of templates needs to be pulled.
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: code
   *         in: query
   *         description: 'API key'
   *         required: false
   *         type: string
   *       - name: X-MS-CONVERSION-API-KEY
   *         in: header
   *         description: 'API key'
   *         required: false
   *         type: string
   *     responses:
   *       200:
   *         description: templates updated
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   */
  app.post("/api/UpdateBaseTemplates", function (req, res) {
    let tempFolderName = path.join(
      constants.TEMPLATE_FILES_LOCATION,
      `.temp${new Date().getTime()}`
    );
    fse.ensureDirSync(tempFolderName);

    // Rename (instead of delete) to avoid timeout.
    var existingFiles = fs.readdirSync(constants.TEMPLATE_FILES_LOCATION);
    existingFiles.forEach(function (fl) {
      if (!fl.startsWith(".")) {
        fse.renameSync(
          path.join(constants.TEMPLATE_FILES_LOCATION, fl),
          path.join(tempFolderName, fl)
        );
      }
    });

    // Using ncp since fs/fs-extra failed randomly with ENOENT for src files.
    ncp.limit = 16;
    ncp(constants.BASE_TEMPLATE_FILES_LOCATION, constants.TEMPLATE_FILES_LOCATION, function (err) {
      if (err) {
        res.status(403);
        res.json(errorMessage(errorCodes.WriteError, err.message));
      } else {
        templateCache.clear();
        workerPool.broadcast({ type: "templatesUpdated" });
        res.status(200);
        res.end();
      }
    });
  });

  /**
   * @swagger
   * /api/convert/{srcDataType}/{template}:
   *   post:
   *     description: Converts given data to FHIR using template
   *     produces:
   *       - application/json
   *     consumes:
   *       - text/plain
   *     parameters:
   *       - name: srcDataType
   *         description: Data type of the source (e.g. 'cda')
   *         in: path
   *         required: true
   *         type: string
   *       - name: template
   *         description: Name of a specific template
   *         in: path
   *         required: true
   *         type: string
   *       - name: srcData
   *         description: the source data to convert
   *         in: body
   *         required: true
   *         schema:
   *           type: string
   *       - name: api-version
   *         in: query
   *         description: API version to use. The current version is 1.0. Previous versions, including passing no version, are deprecated.
   *         required: false
   *         type: string
   *       - name: code
   *         in: query
   *         description: 'API key'
   *         required: false
   *         type: string
   *       - name: unusedSegments
   *         in: query
   *         description: 'Flag about whether to return the "unusedSegments", only used in web portal'
   *         required: false
   *         type: bool
   *       - name: invalidAccess
   *         in: query
   *         description: 'Flag about whether to return the "invalidAccess", only used in web portal'
   *         required: false
   *         type: bool
   *     responses:
   *       200:
   *         description: Converted message
   *       400:
   *         description: Bad request
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Template not found
   */
  app.post("/api/convert/:srcDataType/:template(*)", function (req, res) {
    const retUnusedSegments = req.query.unusedSegments == "true";
    const retInvalidAccess = req.query.invalidAccess == "true";
    const patientId = req.query.patientId;
    const fileName = req.query.fileName;
    const startTime = new Date().getTime();
    workerPool
      .exec({
        type: "/api/convert/:srcDataType/:template",
        srcData: req.body.toString(),
        srcDataType: req.params.srcDataType,
        templateName: req.params.template,
        patientId,
      })
      .then(result => {
        const duration = new Date().getTime() - startTime;
        const resultMessage = result.resultMsg;
        if (!retUnusedSegments) {
          delete resultMessage["unusedSegments"];
        }
        if (!retInvalidAccess) {
          delete resultMessage["invalidAccess"];
        }
        console.log(
          `[patient ${patientId}] Took ${duration}ms / status ${result.status} to process file ${fileName}`
        );
        res.status(result.status);
        res.json(resultMessage);
        return;
      });
  });
  return app;
};
