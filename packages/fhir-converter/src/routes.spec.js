// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const constants = require("./lib/constants/constants");
const supertest = require("supertest");
const express = require("express");
const fse = require("fs-extra");
const path = require("path");
var app = require("./routes")(express());
const fs = require("fs");
var assert = require("assert");
var HandlebarsConverter = require("./lib/handlebars-converter/handlebars-converter");
var dataHandlerFactory = require("./lib/dataHandler/dataHandlerFactory");

const apiKeys = ["123", "456"];
const API_KEY_HEADER = "X-MS-CONVERSION-API-KEY";

describe("GET /", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return status code 200", function (done) {
    supertest(app)
      .get("/")
      .expect(200)
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });
});

describe("GET /api-docs.json", function () {
  it("should return status code 200", function (done) {
    supertest(app)
      .get("/api-docs.json")
      .expect(200)
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });
});

describe("GET /api/helpers", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return 401 without a valid API key", function (done) {
    supertest(app)
      .get("/api/helpers")
      .expect(401)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return status code 200 and contain an array", function (done) {
    supertest(app)
      .get("/api/helpers")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body.helpers)) {
          throw new Error("Response is not array");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("GET /api/sample-data", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return 401 without a valid API key", function (done) {
    supertest(app)
      .get("/api/sample-data")
      .expect(401)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return status code 200 and contain an array", function (done) {
    supertest(app)
      .get("/api/sample-data")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body.messages)) {
          throw new Error("Response is not array");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("/api/sample-data (wrong configuration)", function () {
  before(function () {
    // Deep copy constants
    var myConstants = JSON.parse(JSON.stringify(app.getConstants()));
    myConstants.SAMPLE_DATA_LOCATION = "/foo/bar";
    app.setConstants(myConstants);
    app.setValidApiKeys(apiKeys);
  });

  after(function () {
    app.setConstants(constants);
  });

  it("GET should return 404 when configured with wrong storage location", function (done) {
    supertest(app)
      .get("/api/sample-data")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(404, {
        error: {
          code: "NotFound",
          message: "Unable to access sample data location",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("GET /api/sample-data/:file", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return status code 200 when getting ADT01-23.hl7", function (done) {
    supertest(app)
      .get("/api/sample-data/hl7v2/ADT01-23.hl7")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return status code 404 when getting foobar.hl7", function (done) {
    supertest(app)
      .get("/api/sample-data/foobar.hl7")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(404, {
        error: {
          code: "NotFound",
          message: "Sample data not found",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("/api/templates", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return 401 without a valid API key", function (done) {
    supertest(app)
      .get("/api/templates")
      .expect(401)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("GET should return status code 200 and return an array", function (done) {
    supertest(app)
      .get("/api/templates")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body.templates)) {
          throw new Error("Response is not array");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("GET should contain an array of template names that cannot start with . (dot)", function (done) {
    supertest(app)
      .get("/api/templates")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .expect(function (response) {
        for (var i = 0; i < response.body.templates.length; i++) {
          if (response.body.templates[i].templateName.startsWith(".")) {
            throw new Error("Response array contains elements starting with . (dot)");
          }
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("/api/templates (wrong configuration)", function () {
  before(function () {
    // Deep copy constants
    var myConstants = JSON.parse(JSON.stringify(app.getConstants()));
    myConstants.TEMPLATE_FILES_LOCATION = "/foo/bar";
    app.setConstants(myConstants);
  });

  after(function () {
    app.setConstants(constants);
  });

  it("GET should return 404 when configured with wrong storage location", function (done) {
    supertest(app)
      .get("/api/templates")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(404, {
        error: {
          code: "NotFound",
          message: "Unable to access templates location",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("GET /api/templates/:file", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return status code 200 for ADT_A01.hbs", function (done) {
    supertest(app)
      .get("/api/templates/hl7v2/ADT_A01.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) done(err);
        else done();
      });
  });

  it("should return status code 404 for nonExistingTemplate.hbs", function (done) {
    supertest(app)
      .get("/api/templates/nonExistingTemplate.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(404, {
        error: {
          code: "NotFound",
          message: "Template not found",
        },
      })
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });
});

describe("PUT/DELETE /api/templates/:file", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return 403 denied when attempting to write unallowed file name", function (done) {
    supertest(app)
      .put("/api/templates/%2F")
      .set(API_KEY_HEADER, apiKeys[0])
      .send('{ "myprop": "{{ val }}" }')
      .expect(403, {
        error: {
          code: "WriteError",
          message: "Unable to write template /",
        },
      })
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });

  it("should return 201 created when posting new file", function (done) {
    supertest(app)
      .put("/api/templates/brandnewtemplate.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .send('{ "myprop": "{{ val }}" }')
      .expect(201)
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });

  it("should return 200 OK updating an existing file", function (done) {
    supertest(app)
      .put("/api/templates/brandnewtemplate.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .send('{ "myprop": "{{ val }}" }')
      .expect(200)
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });

  it("should return 204 gone when deleting a file", function (done) {
    supertest(app)
      .delete("/api/templates/brandnewtemplate.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(204)
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });

  it("should return 404 not found when deleting a non existent file", function (done) {
    supertest(app)
      .delete("/api/templates/brandnewtemplate.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(404, {
        error: {
          code: "NotFound",
          message: "Unable to find a template with name brandnewtemplate.hbs to delete.",
        },
      })
      .end(function (err) {
        if (err) done(err);
        done();
      });
  });

  it("should return 201 created when posting new file in a sub directory", function (done) {
    supertest(app)
      .put("/api/templates/newSubDir/brandnewtemplate.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .send('{ "myprop": "{{ val }}" }')
      .expect(201)
      .end(function (err) {
        done(err);
      });
  });

  it("should return 403 WriteError when posting new file with incorrect path", function (done) {
    supertest(app)
      .put("/api/templates/newSubDir/brandnewtemplate.hbs/fileWithIncorrectPath.hbs") // parent folder is a file created above
      .set(API_KEY_HEADER, apiKeys[0])
      .send('{ "myprop": "{{ val }}" }')
      .expect(403)
      .expect(function (response) {
        var e = JSON.parse(response.text);
        if (
          e.error.code != "WriteError" ||
          !e.error.message.startsWith("Unable to write template")
        ) {
          throw new Error("Incorrect error response");
        }
      })
      .end(function (err) {
        done(err);
      });
  });

  it("should return 204 gone when deleting a file in a sub directory", function (done) {
    supertest(app)
      .delete("/api/templates/newSubDir/brandnewtemplate.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(204)
      .end(function (err) {
        done(err);
      });
  });
});

describe("/api/templates/git", function () {
  var repoRootPath = path.join(__dirname, "test-repos-root");
  var repoPath = path.join(repoRootPath, "service-templates");
  var myConstants = JSON.parse(JSON.stringify(app.getConstants()));

  before(function () {
    myConstants.TEMPLATE_FILES_LOCATION = repoPath;
    app.setConstants(myConstants);
  });

  after(function () {
    fse.removeSync(repoRootPath);
    app.setConstants(constants);
  });

  it("should return an array from status", function (done) {
    supertest(app)
      .get("/api/templates/git/status")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body)) {
          throw new Error("Response should be array");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return an array from branches", function (done) {
    supertest(app)
      .get("/api/templates/git/branches")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body)) {
          throw new Error("Response should be array");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return a non-empty array from status after adding new file", function (done) {
    fse.writeFileSync(path.join(repoPath, "file.txt"), "some text");
    supertest(app)
      .get("/api/templates/git/status")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body) || response.body.length == 0) {
          throw new Error("Response should be array with non-zero length");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK when committing all changes", function (done) {
    supertest(app)
      .post("/api/templates/git/commit")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  // There should be no changes at this point
  it("should return 409 conflict when committing with no changes", function (done) {
    supertest(app)
      .post("/api/templates/git/commit")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(409)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 bad request when posting a new branch without branch name", function (done) {
    supertest(app)
      .post("/api/templates/git/branches")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(400)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 201 created when posting a new branch", function (done) {
    supertest(app)
      .post("/api/templates/git/branches")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({ name: "newBranch" })
      .expect(201)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 201 created when posting a new branch based on an existing branch", function (done) {
    supertest(app)
      .post("/api/templates/git/branches")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({ name: "newBranch2", baseBranch: "newBranch" })
      .expect(201)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 409 conflict when posting a new branch based on an non-existing branch", function (done) {
    supertest(app)
      .post("/api/templates/git/branches")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({ name: "newBranch3", baseBranch: "foobar" })
      .expect(409)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 409 conflict when posting a new branch with a name that already exists", function (done) {
    supertest(app)
      .post("/api/templates/git/branches")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({ name: "newBranch" }) // Created above
      .expect(409)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 when attempting to checkout without branch name", function (done) {
    supertest(app)
      .post("/api/templates/git/checkout")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(400)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 404 when attempting to checkout with non-existent branch name", function (done) {
    supertest(app)
      .post("/api/templates/git/checkout")
      .send({ name: "foobar" })
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(404)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 when attempting to checkout with existent branch name", function (done) {
    supertest(app)
      .post("/api/templates/git/checkout")
      .send({ name: "newBranch" })
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK when committing all changes to a newly checked out branch.", function (done) {
    fse.writeFileSync(path.join(repoPath, "file.txt"), "some other text"); //This file has been added to master too.
    supertest(app)
      .post("/api/templates/git/commit")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 when attempting to switch back to master", function (done) {
    supertest(app)
      .post("/api/templates/git/checkout")
      .send({ name: "master" })
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 409 when attempting to checkout a branch while there is a conflict", function (done) {
    fse.writeFileSync(path.join(repoPath, "file.txt"), "some brand new text");
    supertest(app)
      .post("/api/templates/git/checkout")
      .send({ name: "newBranch" })
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(409)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("git endpoint", function () {
  var repoRootPath = path.join(__dirname, "test-repos-root");
  var repoPath = path.join(repoRootPath, "service-templates");
  var myConstants = JSON.parse(JSON.stringify(app.getConstants()));

  before(function () {
    myConstants.TEMPLATE_FILES_LOCATION = repoPath;
    app.setConstants(myConstants);
  });

  after(function () {
    fse.removeSync(repoRootPath);
    app.setConstants(constants);
  });

  it("should be possible to clone the git repo for the service /git", function (done) {
    supertest(app)
      .get("/git/info/refs?service=git-upload-pack")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return repo not found for non-existing other repos", function (done) {
    supertest(app)
      .get("/git/blahblah/info/refs?service=git-upload-pack")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(404)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe('Helper "evaluate" usage', function () {
  // Not using temp repo path since constants couldn't be modified inside helper function
  // even if helper/converter/worker modules were modified to have updated constants.
  const partialTemplateName = "hl7v2/helpersTestPartial.hbs";
  const partialTemplatePath = path.join(constants.TEMPLATE_FILES_LOCATION, partialTemplateName);
  const partialTemplateApiPath = "/api/templates/" + partialTemplateName;

  // Template : { {{#with (evaluate "helpersTestPartial.hbs" "x1":"1" "x2":"2")}} "out":"{{c}}" {{/with}} }
  const templateBase64Str =
    "eyB7eyN3aXRoIChldmFsdWF0ZSAiaGVscGVyc1Rlc3RQYXJ0aWFsLmhicyIgeDE9IjEiIHgyPSIyIil9fSAib3V0Ijoie3tjfX0iIHt7L3dpdGh9fSB9";

  // Message : MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
  const messageBase64Str =
    "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=";

  before(function () {
    if (fs.existsSync(partialTemplatePath)) {
      fs.unlinkSync(partialTemplatePath);
    }
  });

  after(function () {
    if (fs.existsSync(partialTemplatePath)) {
      fs.unlinkSync(partialTemplatePath);
    }
  });

  it("evaulate should get correct object from child template", function (done) {
    var session = require("cls-hooked").createNamespace(constants.CLS_NAMESPACE);
    var hl7v2Handler = dataHandlerFactory.createDataHandler("hl7v2");

    session.run(() => {
      var handlebarInstance = HandlebarsConverter.instance(
        true,
        hl7v2Handler,
        constants.TEMPLATE_FILES_LOCATION
      );
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
      session.set(constants.CLS_KEY_TEMPLATE_LOCATION, constants.TEMPLATE_FILES_LOCATION);

      supertest(app)
        .put(partialTemplateApiPath)
        .set(API_KEY_HEADER, apiKeys[0])
        .set("Content-Type", "text/plain")
        .send('{"a":"{{x1}}", "c":"{{x2}}"}')
        .end(function () {
          supertest(app)
            .post("/api/convert/hl7v2")
            .set(API_KEY_HEADER, apiKeys[0])
            .send({ templateBase64: templateBase64Str, srcDataBase64: messageBase64Str })
            .expect(200)
            .expect(function (response) {
              if (JSON.stringify(response.body.fhirResource) !== JSON.stringify({ out: "2" })) {
                throw new Error("incorrect fhir resource!");
              }
            })
            .end(function (err) {
              if (err) {
                done(err);
              } else {
                done();
              }
            });
        });
    });
  });
});

describe("POST /api/convert/hl7v2 (inline conversion)", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return 401 without a valid API key", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2")
      .send({
        templateBase64: "",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
      })
      .expect(401)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad Request when given a payload without a message", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({ templateBase64: "" })
      .expect(400, {
        error: {
          code: "BadRequest",
          message:
            "Unable to parse input data. The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received undefined",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad Request with invalid templatesMap", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "e30=",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
        templatesOverrideBase64: "abc==5",
      })
      .expect(400, {
        error: {
          code: "BadRequest",
          message: "templatesOverride is not a base 64 encoded string.",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad Request when given a payload with an invalid HL7 message", function (done) {
    //This test passes a message with first segment "MSQ" (instead of MSH)
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "",
        srcDataBase64:
          "TVNRfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
      })
      .expect(400, {
        error: {
          code: "BadRequest",
          message:
            "Unable to parse input data. Error: Invalid HL7 v2 message, first segment id = MSQ",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK for valid message with an empty template", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
      })
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body.v2.data)) {
          throw new Error("Response is not array");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK for valid message without a template", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
      })
      .expect(200)
      .expect(function (response) {
        if (!Array.isArray(response.body.v2.data)) {
          throw new Error("Response is not array");
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK with detailed report for valid message with valid template and report fields declaration", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    //Template: {}
    supertest(app)
      .post("/api/convert/hl7v2?unusedSegments=true&invalidAccess=true")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "e30=",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
        templatesOverrideBase64: "e30=",
      })
      .expect(200, {
        fhirResource: {},
        unusedSegments: [
          {
            field: [
              {
                component: [
                  {
                    index: 0,
                    value: "AccMgr",
                  },
                ],
                index: 2,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "1",
                  },
                ],
                index: 3,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "20050110045504",
                  },
                ],
                index: 6,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "ADT",
                  },
                  {
                    index: 1,
                    value: "A01",
                  },
                ],
                index: 8,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "599102",
                  },
                ],
                index: 9,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "P",
                  },
                ],
                index: 10,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "2.3",
                  },
                ],
                index: 11,
              },
            ],
            line: 0,
            type: "MSH",
          },
        ],
        invalidAccess: [],
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK without detailed report for valid message with valid template", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    //Template: {}
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "e30=",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
        templatesOverrideBase64: "e30=",
      })
      .expect(200, {
        fhirResource: {},
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK with single detailed report(unusedSegments) for valid message with valid template and single report field declaration", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    //Template: {}
    supertest(app)
      .post("/api/convert/hl7v2?unusedSegments=true")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "e30=",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
        templatesOverrideBase64: "e30=",
      })
      .expect(200, {
        fhirResource: {},
        unusedSegments: [
          {
            field: [
              {
                component: [
                  {
                    index: 0,
                    value: "AccMgr",
                  },
                ],
                index: 2,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "1",
                  },
                ],
                index: 3,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "20050110045504",
                  },
                ],
                index: 6,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "ADT",
                  },
                  {
                    index: 1,
                    value: "A01",
                  },
                ],
                index: 8,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "599102",
                  },
                ],
                index: 9,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "P",
                  },
                ],
                index: 10,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "2.3",
                  },
                ],
                index: 11,
              },
            ],
            line: 0,
            type: "MSH",
          },
        ],
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK with single detailed report(invalidAccess) for valid message with valid template and single report field declaration", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    //Template: {}
    supertest(app)
      .post("/api/convert/hl7v2?invalidAccess=true")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "e30=",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
        templatesOverrideBase64: "e30=",
      })
      .expect(200, {
        fhirResource: {},
        invalidAccess: [],
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad Request when given a payload with valid message but invalid template", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    //Template: invalid base64
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "\\",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
      })
      .expect(400, {
        error: {
          code: "BadRequest",
          message: "Template is not a base 64 encoded string.",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK when given a payload with valid message and template with extra commas", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    //Template: { , ,"a" : "1",,,,"b" : [, "c" , ,"d",,], ,}
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "eyAsCiwKImEiIDogIjEiLCwsLAoiYiIgOiBbLCAiYyIgLCAsImQiLCxdLCAsCn0=",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
      })
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad Request when given a payload with invalid message but valid template", function (done) {
    //Message: \
    //Template: {}
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({ templateBase64: "e30=", srcDataBase64: "\\" })
      .expect(400, {
        error: {
          code: "BadRequest",
          message: "srcData is not a base 64 encoded string.",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad Request when given a payload that references a non existent parital template", function (done) {
    //Message: MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
    //Template: {{>nonExistentPartial.hbs}}
    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: "e3s+bm9uRXhpc3RlbnRQYXJ0aWFsLmhic319",
        srcDataBase64:
          "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=",
      })
      .expect(400)
      .expect(function (response) {
        if (response.body.error.code !== "BadRequest") {
          throw "unexpected error code!";
        }
        if (
          !response.body.error.message.includes(
            "Unable to create result: Error: Referenced partial template nonExistentPartial.hbs not found on disk"
          )
        ) {
          throw "unexpected error message!";
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("UpdateBaseTemplates", function () {
  var repoPath = path.join(__dirname, "test-update-repo-templates");
  var baseTemplatesPath = path.join(__dirname, "test-update-base-templates");
  var myConstants = JSON.parse(JSON.stringify(app.getConstants()));
  const templateName = "UpdateTestTemplate.hbs";

  after(function () {
    fse.removeSync(repoPath);
    fse.removeSync(baseTemplatesPath);
  });

  it("should overwrite existing templates", function (done) {
    fse.removeSync(repoPath);
    fse.ensureDirSync(repoPath);
    fse.removeSync(baseTemplatesPath);
    fse.ensureDirSync(baseTemplatesPath);
    myConstants.TEMPLATE_FILES_LOCATION = repoPath;
    myConstants.BASE_TEMPLATE_FILES_LOCATION = baseTemplatesPath;
    app.setConstants(myConstants);

    var filePath = "folder1//fileX.txt"; //file under non-existing dir
    fse.ensureFileSync(path.join(baseTemplatesPath, filePath));

    fse.writeFileSync(path.join(baseTemplatesPath, templateName), '{"a":"1"}');
    fse.writeFileSync(path.join(baseTemplatesPath, filePath), '{"x":"1"}');
    fse.writeFileSync(path.join(repoPath, templateName), '{"a":"2"}');

    supertest(app)
      .post("/api/UpdateBaseTemplates")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          assert.equal(fs.readFileSync(path.join(repoPath, templateName)).toString(), '{"a":"1"}');
          assert.equal(fs.readFileSync(path.join(repoPath, filePath)).toString(), '{"x":"1"}');
          done();
        }
      });
  });

  it("should fail if provided incorrect destination path", function (done) {
    var basePath = path.join(__dirname, "temp", "test-update-base-templates");
    fse.removeSync(basePath);
    fse.ensureDirSync(basePath);
    fse.writeFileSync(path.join(basePath, templateName), '{"a":"1"}');
    myConstants.BASE_TEMPLATE_FILES_LOCATION = basePath;
    myConstants.TEMPLATE_FILES_LOCATION = path.join(__dirname, "temp"); //src contained inside dest will move src before copy starts
    app.setConstants(myConstants);

    supertest(app)
      .post("/api/UpdateBaseTemplates")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(403)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("Partial template cache usage and invalidation", function () {
  var repoPath = path.join(__dirname, "test-cache-repo-templates");
  var myConstants = JSON.parse(JSON.stringify(app.getConstants()));
  const partialTemplateName = "hl7v2/cachingTestPartial.hbs";
  const partialTemplateApiPath = "/api/templates/" + partialTemplateName;

  // Template : { "entry" : {{>cachingTestPartial.hbs}} }
  const templateBase64Str = "eyAiZW50cnkiIDoge3s+Y2FjaGluZ1Rlc3RQYXJ0aWFsLmhic319IH0=";

  // Message : MSH|^~\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||
  const messageBase64Str =
    "TVNIfF5+XCZ8QWNjTWdyfDF8fHwyMDA1MDExMDA0NTUwNHx8QURUXkEwMXw1OTkxMDJ8UHwyLjN8fHw=";

  before(function (done) {
    fse.removeSync(repoPath);
    fse.ensureDirSync(path.join(repoPath, "hl7v2"));
    myConstants.TEMPLATE_FILES_LOCATION = repoPath;
    app.setConstants(myConstants);

    fse.writeFileSync(path.join(repoPath, partialTemplateName), '{"myprop":"c"}');
    supertest(app)
      .post("/api/templates/git/commit")
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function () {
        supertest(app)
          .post("/api/templates/git/branches")
          .send({ name: "newBranch", baseBranch: "master" })
          .set(API_KEY_HEADER, apiKeys[0])
          .expect(201)
          .end(function () {
            supertest(app)
              .post("/api/templates/git/checkout")
              .send({ name: "newBranch" })
              .set(API_KEY_HEADER, apiKeys[0])
              .expect(200)
              .end(function (err) {
                if (err) {
                  done(err);
                } else {
                  done();
                }
              });
          });
      });
  });

  after(function () {
    fse.removeSync(repoPath);
    app.setConstants(constants);
  });

  beforeEach(function (done) {
    supertest(app)
      .put(partialTemplateApiPath)
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send('{"myprop":"a"}')
      .end(function () {
        supertest(app)
          .post("/api/templates/git/commit")
          .set(API_KEY_HEADER, apiKeys[0])
          .end(function (err) {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
      });
  });

  beforeEach(function (done) {
    var reqCount = 0;
    var cpuCount = require("os").cpus().length;

    for (var i = 0; i < cpuCount; ++i) {
      supertest(app)
        .post("/api/convert/hl7v2")
        .set(API_KEY_HEADER, apiKeys[0])
        .send({ templateBase64: templateBase64Str, srcDataBase64: messageBase64Str })
        .expect(200)
        .end(function () {
          ++reqCount;
          if (reqCount >= cpuCount) {
            done();
          }
        });
    }
  });

  it("should perform correct conversion after partial template is updated thru template api", function (done) {
    supertest(app)
      .put(partialTemplateApiPath)
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send('{"myprop":"b"}')
      .end(function () {
        supertest(app)
          .post("/api/convert/hl7v2")
          .set(API_KEY_HEADER, apiKeys[0])
          .send({ templateBase64: templateBase64Str, srcDataBase64: messageBase64Str })
          .expect(200)
          .expect(function (response) {
            if (
              JSON.stringify(response.body.fhirResource) !==
              JSON.stringify({ entry: { myprop: "b" } })
            ) {
              throw "unexpected result";
            }
          })
          .end(function (err) {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
      });
  });

  it("should keep using stale data due to cache if partial template is updated out of band", function (done) {
    var filePath = path.join(repoPath, partialTemplateName);
    fse.writeFileSync(filePath, "dummy text");

    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({
        templateBase64: templateBase64Str,
        srcDataBase64: messageBase64Str,
        templatesOverrideBase64: "e30=",
      })
      .expect(200)
      .expect(function (response) {
        if (
          JSON.stringify(response.body.fhirResource) !== JSON.stringify({ entry: { myprop: "a" } })
        ) {
          throw "unexpected result";
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should keep performing conversion due to cache if partial template is deleted out of band", function (done) {
    var filePath = path.join(repoPath, partialTemplateName);
    fse.removeSync(filePath);

    supertest(app)
      .post("/api/convert/hl7v2")
      .set(API_KEY_HEADER, apiKeys[0])
      .send({ templateBase64: templateBase64Str, srcDataBase64: messageBase64Str })
      .expect(200)
      .expect(function (response) {
        if (
          JSON.stringify(response.body.fhirResource) !== JSON.stringify({ entry: { myprop: "a" } })
        ) {
          throw "unexpected result";
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should throw error if partial template is deleted with template api", function (done) {
    supertest(app)
      .delete(partialTemplateApiPath)
      .set(API_KEY_HEADER, apiKeys[0])
      .end(function () {
        supertest(app)
          .post("/api/convert/hl7v2")
          .set(API_KEY_HEADER, apiKeys[0])
          .send({ templateBase64: templateBase64Str, srcDataBase64: messageBase64Str })
          .expect(400)
          .end(function (err) {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
      });
  });

  it("should perform correct conversion after partial template is updated by git branch switching", function (done) {
    supertest(app)
      .post("/api/templates/git/checkout")
      .send({ name: "master" })
      .set(API_KEY_HEADER, apiKeys[0])
      .expect(200)
      .end(function () {
        supertest(app)
          .post("/api/convert/hl7v2")
          .set(API_KEY_HEADER, apiKeys[0])
          .send({ templateBase64: templateBase64Str, srcDataBase64: messageBase64Str })
          .expect(200)
          .expect(function (response) {
            if (JSON.stringify(response.body.fhirResource) !== JSON.stringify({ myprop: "c" })) {
              throw "unexpected result";
            }
          })
          .end(function (err) {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
      });
  });
});

describe("Top level template cache usage and invalidation", function () {
  var repoPath = path.join(__dirname, "test-top-cache-repo-templates");
  var myConstants = JSON.parse(JSON.stringify(app.getConstants()));
  const templateName = "hl7v2/cachingTestTemplate.hbs";
  const templateApiPath = "/api/templates/" + templateName;
  const convertApiPath = "/api/convert/" + templateName;
  const message = "MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||";

  before(function () {
    fse.removeSync(repoPath);
    fse.ensureDirSync(repoPath);
    myConstants.TEMPLATE_FILES_LOCATION = repoPath;
    app.setConstants(myConstants);
  });

  after(function () {
    fse.removeSync(repoPath);
    app.setConstants(constants);
  });

  beforeEach(function (done) {
    supertest(app)
      .put(templateApiPath)
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send('{"myprop":"a"}')
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  beforeEach(function (done) {
    var reqCount = 0;
    var cpuCount = require("os").cpus().length;

    for (var i = 0; i < cpuCount; ++i) {
      supertest(app)
        .post(convertApiPath)
        .set(API_KEY_HEADER, apiKeys[0])
        .set("Content-Type", "text/plain")
        .send(message)
        .expect(200, '{"myprop":"a"}')
        .end(function () {
          ++reqCount;
          if (reqCount >= cpuCount) {
            done();
          }
        });
    }
  });

  it("should perform correct conversion after top template is updated thru template api", function (done) {
    supertest(app)
      .put(templateApiPath)
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send('{"myprop":"b"}')
      .end(function () {
        supertest(app)
          .post(convertApiPath)
          .set(API_KEY_HEADER, apiKeys[0])
          .set("Content-Type", "text/plain")
          .send(message)
          .expect(200)
          .expect(function (response) {
            if (JSON.stringify(response.body.fhirResource) !== JSON.stringify({ myprop: "b" })) {
              throw "unexpected result";
            }
          })
          .end(function (err) {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
      });
  });

  it("should keep using stale data due to cache if top template is updated out of band", function (done) {
    var filePath = path.join(repoPath, templateName);
    fse.writeFileSync(filePath, "dummy text");

    supertest(app)
      .post(convertApiPath)
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send(message)
      .expect(200)
      .expect(function (response) {
        if (JSON.stringify(response.body.fhirResource) !== JSON.stringify({ myprop: "a" })) {
          throw "unexpected result";
        }
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });
});

describe("POST /api/convert/hl7v2/:template (with stored template)", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  it("should return 401 without valid API key", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2/ADT_A01.hbs")
      .set("Content-Type", "text/plain")
      .send("MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||")
      .expect(401)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK with valid message and existing template", function (done) {
    const sourceData = [
      "MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||",
      "PID|1||10006579^^^1^MR^1||DUCK^DONALD^D||19241010|M||1|111 DUCK ST^^FOWL^CA^999990000^^M|1|8885551212|8885551212|1|2||40007716^^^AccMgr^VN^1|123121234|||||||||||NO",
      "PV1|1|I|PREOP^101^1^1^^^S|3|||37^DISNEY^WALT^^^^^^AccMgr^^^^CI|||01||||1|||37^DISNEY^WALT^^^^^^AccMgr^^^^CI|2|40007716^^^AccMgr^VN|4|||||||||||||||||||1||G|||20050110045253||||||",
    ];
    supertest(app)
      .post("/api/convert/hl7v2/ADT_A01.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send(sourceData.join("\n"))
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK and detailed reports with valid message and existing template and reports fields declaration", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2/ADT_A01.hbs?unusedSegments=true&invalidAcces=true")
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send("MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||")
      .expect(200, {
        fhirResource: {
          resourceType: "Bundle",
          type: "transaction",
        },
        unusedSegments: [
          {
            field: [
              {
                component: [
                  {
                    index: 0,
                    value: "AccMgr",
                  },
                ],
                index: 2,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "1",
                  },
                ],
                index: 3,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "20050110045504",
                  },
                ],
                index: 6,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "ADT",
                  },
                  {
                    index: 1,
                    value: "A01",
                  },
                ],
                index: 8,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "599102",
                  },
                ],
                index: 9,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "P",
                  },
                ],
                index: 10,
              },
              {
                component: [
                  {
                    index: 0,
                    value: "2.3",
                  },
                ],
                index: 11,
              },
            ],
            line: 0,
            type: "MSH",
          },
        ],
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 200 OK with valid message and existing template in a subdirectory", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2/Resources/Patient.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send("MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||")
      .expect(200)
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad Request with empty message and existing template", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2/ADT_A01.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send("")
      .expect(400, {
        error: {
          code: "BadRequest",
          message: "No srcData provided.",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad request with invalid message and existing template", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2/ADT_A01.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send("MSQ|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||")
      .expect(400, {
        error: {
          code: "BadRequest",
          message:
            "Unable to parse input data. Error: Invalid HL7 v2 message, first segment id = MSQ",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 404 not found with valid message and non-existing template", function (done) {
    supertest(app)
      .post("/api/convert/hl7v2/foobar.hbs")
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send("MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||")
      .expect(404, {
        error: {
          code: "NotFound",
          message: "Template not found",
        },
      })
      .end(function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
  });

  it("should return 400 Bad request with valid message and existing but invalid template", function (done) {
    var repoPath = path.join(__dirname, "test-invalid-templates");
    var myConstants = JSON.parse(JSON.stringify(app.getConstants()));
    const templateName = "invalidTemplate.hbs";
    const templateApiPath = "/api/templates/hl7v2/" + templateName;
    const convertApiPath = "/api/convert/hl7v2/" + templateName;

    fse.removeSync(repoPath);
    fse.ensureDirSync(repoPath);
    myConstants.TEMPLATE_FILES_LOCATION = repoPath;
    app.setConstants(myConstants);

    supertest(app)
      .put(templateApiPath)
      .set(API_KEY_HEADER, apiKeys[0])
      .set("Content-Type", "text/plain")
      .send("{ {{>nonExistingTemplate.hbs}} }")
      .end(function () {
        supertest(app)
          .post(convertApiPath)
          .set(API_KEY_HEADER, apiKeys[0])
          .set("Content-Type", "text/plain")
          .send("MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||")
          .expect(400)
          .expect(function (response) {
            if (response.body.error.code !== "BadRequest") {
              throw "unexpected error code!";
            }
            if (
              !response.body.error.message.includes(
                "Error during template evaluation. Error: Referenced partial template nonExistingTemplate.hbs not found on disk"
              )
            ) {
              throw "unexpected error message!";
            }
          })
          .end(function (err) {
            fse.removeSync(repoPath);
            app.setConstants(constants);
            if (err) {
              done(err);
            } else {
              done();
            }
          });
      });
  });
});
