// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var fsCache = require("./cache");
var fse = require("fs-extra");
var path = require("path");

describe("fsCache", function () {
  let folderPath = path.join(__dirname, "test-fsCache");
  let fileName = "fsCacheTempFile.hbs";
  let filePath = path.join(folderPath, fileName);

  before(function () {
    fse.removeSync(folderPath);
    fse.ensureDirSync(folderPath);
    fse.writeFileSync(filePath, "hello");
  });

  it("should use Cache for get", function () {
    let cache = new fsCache(folderPath);

    cache
      .get(fileName)
      .then(data1 => {
        assert.equal(data1, "hello");
        fse.removeSync(path.join(folderPath, fileName));
        cache
          .get(fileName)
          .then(data2 => {
            assert.equal(data2, "hello");
          })
          .catch(() => assert.fail());
      })
      .catch(() => {
        assert.fail();
      });
  });

  it("Cache should get expired on file update", function () {
    let cache = new fsCache(folderPath);

    cache
      .get(fileName)
      .then(data1 => {
        assert.equal(data1, "hello");
        cache
          .set(fileName, "world")
          .then(() => {
            fse.removeSync(path.join(folderPath, fileName));
            cache
              .get(fileName)
              .then(() => {
                assert.fail();
              })
              .catch(() => assert.ok());
          })
          .catch(() => assert.fail());
      })
      .catch(() => {
        assert.fail();
      });
  });

  it("Cache has() should return false for non-existent file", function () {
    let cache = new fsCache(folderPath);

    cache
      .has("nonExistentFile")
      .then(result => {
        assert.equal(result, false);
      })
      .catch(() => {
        assert.fail();
      });
  });

  it("Cache has() should return true for existing file", function () {
    let cache = new fsCache(folderPath);

    cache
      .has(fileName)
      .then(result => {
        assert.equal(result, true);
      })
      .catch(() => {
        assert.fail();
      });
  });
});
