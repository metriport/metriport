// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var WorkerPool = require("./workerPool");
var Promise = require("promise");

const testWorkerFileName = "./src/lib/workers/testWorker.js";

describe("workerPool", function () {
  it("should replenish the pool if worker exits.", async () => {
    const pool = new WorkerPool(testWorkerFileName, 1);

    try {
      await pool.exec({ TestOnly: "exit" });
      assert.fail();
    } catch (err) {
      //ignore
    }
    const result = await pool.exec({ TestOnly: "msg1" });
    assert.equal(result, "b"); //should come here only if worker pool is replenished
    pool.destroy();
  });

  it("worker thrown error should be passed as msg to parent.", async () => {
    const pool = new WorkerPool(testWorkerFileName, 1);
    const result = await pool.exec({ TestOnly: "error" });
    assert.equal(result, "random error");
    pool.destroy();
  });

  it("worker responses should map to correct request.", async () => {
    const pool = new WorkerPool(testWorkerFileName, 2);
    const execArr = [];
    for (let i = 0; i < 3; i++) {
      execArr.push(pool.exec({ TestOnly: "msg1" }));
      execArr.push(pool.exec({ TestOnly: "msg2" }));
    }
    const resArr = await Promise.all(execArr);
    assert.deepEqual(resArr, ["b", "c", "b", "c", "b", "c"]);
    pool.destroy();
  });
});
