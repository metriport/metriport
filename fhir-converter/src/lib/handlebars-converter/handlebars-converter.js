// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var fs = require("fs");
var Handlebars = require("handlebars");
var helpers = require("./handlebars-helpers").external;

var handlebarsInstances = {};

module.exports.instance = function (
  createNew,
  dataHandler,
  templateFilesLocation,
  currentContextTemplatesMap
) {
  if (createNew) {
    handlebarsInstances = {};
  }

  let dataType = dataHandler.dataType;

  if (!handlebarsInstances[dataType]) {
    handlebarsInstances[dataType] = Handlebars.create();
    var origResolvePartial = handlebarsInstances[dataType].VM.resolvePartial;
    handlebarsInstances[dataType].VM.resolvePartial = function (partial, context, options) {
      if (!options.partials[options.name]) {
        try {
          var content;
          if (currentContextTemplatesMap && options.name in currentContextTemplatesMap) {
            content = currentContextTemplatesMap[options.name];
          } else {
            content = fs.readFileSync(templateFilesLocation + "/" + options.name);
          }
          var preprocessedContent = dataHandler.preProcessTemplate(content.toString());
          handlebarsInstances[dataType].registerPartial(options.name, preprocessedContent);

          // Need to set partial entry here due to a bug in Handlebars (refer # 70386).
          /* istanbul ignore else  */
          if (!options.partials[options.name]) {
            options.partials[options.name] = preprocessedContent;
          }
        } catch (err) {
          throw new Error(`Referenced partial template ${options.name} not found on disk : ${err}`);
        }
      }

      return origResolvePartial(partial, context, options);
    };

    helpers.forEach(h => {
      handlebarsInstances[dataType].registerHelper(h.name, h.func);
    });
  }

  return handlebarsInstances[dataType];
};
