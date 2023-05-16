// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const path = require("path");
const fs = require("fs-extra");
const cases = require("../config");
const WorkerPool = require("../../../../src/lib/workers/workerPool");
const utils = require("./utils");
const constants = require("../../../../src/lib/constants/constants");

const truthsExist = basePath => {
  const cdaPath = path.join(basePath, "cda");
  const hl7v2Path = path.join(basePath, "hl7v2");

  const promises = [cdaPath, hl7v2Path].map(
    subPath => new Promise(fulfill => fs.exists(subPath, fulfill))
  );
  return Promise.all(promises).then(flags => flags.some(x => x));
};

const generateTruths = (workerPool, basePath, domain, subCases) => {
  const templateBasePath = path.join(constants.TEMPLATE_FILES_LOCATION, domain);
  const dataBasePath = path.join(constants.SAMPLE_DATA_LOCATION, domain);
  const subPath = path.join(basePath, domain);

  return subCases.map(
    subCase =>
      new Promise((fulfill, reject) => {
        const templateContent = fs.readFileSync(path.join(templateBasePath, subCase.templateFile));
        const dataContent = fs.readFileSync(path.join(dataBasePath, subCase.dataFile));
        const subTemplatePath = path.join(subPath, subCase.templateFile);
        fs.ensureDirSync(subTemplatePath);

        const payload = {
          type: `/api/convert/:srcDataType`,
          srcDataType: domain,
          templateBase64: Buffer.from(templateContent).toString("base64"),
          srcDataBase64: Buffer.from(dataContent).toString("base64"),
        };

        workerPool
          .exec(payload)
          .then(result => {
            const filePath = path.join(subTemplatePath, utils.getGroundTruthFileName(subCase));
            fs.writeFile(
              filePath,
              JSON.stringify(result.resultMsg.fhirResource, null, 4),
              "UTF8",
              () => {
                fulfill(filePath);
              }
            );
          })
          .catch(reject);
      })
  );
};

const main = basePath => {
  const prompt = `
        The truths files are already exist in ${basePath}. 
        Please remove them manually for the normal operation of the program.
    `;

  return new Promise((fulfill, reject) => {
    truthsExist(basePath)
      .then(flag => {
        if (flag) {
          fulfill(prompt);
        } else {
          const workerPath = path.join(__dirname, "../../../../src/lib/workers/worker.js");
          const workerPool = new WorkerPool(workerPath, require("os").cpus().length);
          const cdaPromises = generateTruths(workerPool, basePath, "cda", cases.cdaCases);
          const hl7v2Promises = generateTruths(workerPool, basePath, "hl7v2", cases.hl7v2Cases);

          const cdaFinalPromise = Promise.all(cdaPromises);
          const hl7v2FinalPromise = Promise.all(hl7v2Promises);

          return Promise.all([cdaFinalPromise, hl7v2FinalPromise])
            .then(fulfill)
            .catch(reject)
            .finally(() => workerPool.destroy());
        }
      })
      .catch(reject);
  });
};

// Be very careful before invoking `main` function and make sure that you indeed want
// to generate new ground truths.
// You can generate ground truth files in command line by requiring `main` function.

module.exports = {
  generate: main,
};
