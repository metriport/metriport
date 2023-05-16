// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var constants = require("../constants/constants");
var fs = require("fs");
var hl7 = require("../hl7v2/hl7v2");
var path = require("path");
var HandlebarsConverter = require("./handlebars-converter");
var jsonProcessor = require("../outputProcessor/jsonProcessor");
var templatePreprocessor = require("../inputProcessor/templatePreprocessor");
var dataHandlerFactory = require("../dataHandler/dataHandlerFactory");

describe("HandlebarsConverter", function () {
  var session = require("cls-hooked").createNamespace(constants.CLS_NAMESPACE);
  var hl7v2Handler = dataHandlerFactory.createDataHandler("hl7v2");

  it("should compile the ADT_A01.hbs template, which includes nested partials (using handlebar new insatnce)", function (done) {
    session.run(() => {
      var handlebarInstance = HandlebarsConverter.instance(
        true,
        hl7v2Handler,
        path.join(__dirname, "../../templates/hl7v2")
      );
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
      session.set(
        constants.CLS_KEY_TEMPLATE_LOCATION,
        path.join(__dirname, "../../templates/hl7v2")
      );

      fs.readFile(
        path.join(constants.HL7V2_TEMPLATE_LOCATION, "ADT_A01.hbs"),
        function (tErr, templateContent) {
          if (tErr) done(tErr);
          fs.readFile(
            path.join(constants.HL7V2_DATA_LOCATION, "ADT01-23.hl7"),
            function (mErr, messageContent) {
              if (mErr) done(mErr);

              var template;
              try {
                template = handlebarInstance.compile(
                  templatePreprocessor.Process(templateContent.toString())
                );
              } catch (ex) {
                done(ex);
              }

              var context = { msg: hl7.parseHL7v2(messageContent.toString()) };

              try {
                JSON.parse(jsonProcessor.Process(template(context)));
                done();
              } catch (ex) {
                done(ex);
              }
            }
          );
        }
      );
    });
  });

  it("should compile the ADT_A01.hbs template, which includes nested partials (using handlebar existing instance)", function (done) {
    session.run(() => {
      var handlebarExistingInstance = HandlebarsConverter.instance(
        false,
        hl7v2Handler,
        path.join(__dirname, "../../templates/hl7v2")
      );
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarExistingInstance);
      session.set(
        constants.CLS_KEY_TEMPLATE_LOCATION,
        path.join(__dirname, "../../templates/hl7v2")
      );

      fs.readFile(
        path.join(constants.HL7V2_TEMPLATE_LOCATION, "ADT_A01.hbs"),
        function (tErr, templateContent) {
          if (tErr) done(tErr);
          fs.readFile(
            path.join(constants.HL7V2_DATA_LOCATION, "ADT01-23.hl7"),
            function (mErr, messageContent) {
              if (mErr) done(mErr);

              var template;
              try {
                template = handlebarExistingInstance.compile(
                  templatePreprocessor.Process(templateContent.toString())
                );
                var context = { msg: hl7.parseHL7v2(messageContent.toString()) };
                JSON.parse(jsonProcessor.Process(template(context)));
                done();
              } catch (ex) {
                done(ex);
              }
            }
          );
        }
      );
    });
  });

  it("should compile the ADT_A01.hbs template, which includes nested partials (using templatesMap)", function (done) {
    session.run(() => {
      var templatesMap = {};
      templatesMap["Resources/Patient.hbs"] = '{"key1":"value1"}';
      templatesMap["Resources/Encounter.hbs"] = '{"key2":"value2"}';
      var handlebarInstanceWithTemplatesMap = HandlebarsConverter.instance(
        true,
        hl7v2Handler,
        path.join(__dirname, "../../templates/hl7v2"),
        templatesMap
      );
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstanceWithTemplatesMap);
      session.set(
        constants.CLS_KEY_TEMPLATE_LOCATION,
        path.join(__dirname, "../../templates/hl7v2")
      );

      fs.readFile(
        path.join(constants.HL7V2_TEMPLATE_LOCATION, "ADT_A01.hbs"),
        function (tErr, templateContent) {
          if (tErr) done(tErr);
          fs.readFile(
            path.join(constants.HL7V2_DATA_LOCATION, "ADT01-23.hl7"),
            function (mErr, messageContent) {
              if (mErr) done(mErr);

              var template;
              try {
                template = handlebarInstanceWithTemplatesMap.compile(
                  templatePreprocessor.Process(templateContent.toString())
                );
                var context = { msg: hl7.parseHL7v2(messageContent.toString()) };
                var conversionOutput = template(context);
                if (conversionOutput.includes("key1") && conversionOutput.includes("key2")) {
                  done();
                }
              } catch (ex) {
                done(ex);
              }
            }
          );
        }
      );
    });
  });

  it("should throw error when referencing partial that is not cached or found on disk", function () {
    var context = {
      msg: hl7.parseHL7v2(
        "MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||\nEVN|A01|20050110045502|||||"
      ),
    };
    var handlerbarInstance = HandlebarsConverter.instance(
      true,
      hl7v2Handler,
      path.join(__dirname, "../../templates/hl7v2")
    );
    var template = handlerbarInstance.compile("{{>nonExistingTemplate.hbs}}");
    assert.throws(
      () => {
        JSON.parse(template(context));
      },
      Error,
      "Referenced partial template not found on disk"
    );
  });
});
