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

const { Worker, MessageChannel } = require("worker_threads");
var Promise = require("promise");

// worker pool : assigns the tasks (as soon as they are created) to the workers,
// so that worker thread can utilize CPU efficiently in case of IO bound stuff in
// the task.
// In case worker exits, all the tasks already asigned to it also fail.

// Usage:
//     Parent:
//         var workerThreadPool = new WorkerPool('./src/worker.js', 4);
//         workerThreadPool.exec({'param1': 1, 'param2' : 2}, (result) => { ... });
//     Workers:
//         worker.workerTaskProcessor((msg) => {
//             return new Promise((fulfill, reject) => {...}});

module.exports = class WorkerPool {
  constructor(filename, size) {
    this._workers = [];
    this._filename = filename;
    this._rrIndex = 0;
    for (var i = 0; i < size; i++) {
      this._workers.push(this._createSingleWorker(i));
    }
  }

  _createSingleWorker(index) {
    var worker = new Worker(this._filename);

    worker.once("exit", code => {
      //console.log(`worker ${index} exiting with code ${code}`);
      if (code <= 1) {
        // worker.terminate uses exit code 1
        return;
      }
      this._replace(worker, index);
      worker.terminate();
      worker.removeAllListeners();
    });

    //console.log(`created worker ${index} with thread id ${worker.threadId}. count = ${this._workers.length}`);
    return worker;
  }

  destroy() {
    this._workers.forEach(worker => worker.terminate());
    this._workers = null;
  }

  _replace(worker, index) {
    const newWorker = this._createSingleWorker(index);
    this._workers[index] = newWorker;
  }

  exec(msg) {
    return new Promise((fulfill, reject) => {
      // For reference, Msg channel creation is 3 orders of magnitude cheaper
      // than worker creation (~10 micro sec vs ~7 milli sec).
      const channel = new MessageChannel();

      const stopWaiting = code => {
        reject(`worker exited with code ${code}!`);
      };

      const selectedWorkerIndex = this._rrIndex++ % this._workers.length;

      channel.port2.once("message", result => {
        this._workers[selectedWorkerIndex].removeListener("exit", stopWaiting);
        channel.port1.close();
        channel.port2.close();
        fulfill(result);
      });

      this._workers[selectedWorkerIndex].prependOnceListener("exit", stopWaiting);

      this._workers[selectedWorkerIndex].postMessage(
        { channelWorkerPort: channel.port1, msg: msg },
        [channel.port1]
      );
    });
  }

  broadcast(msg) {
    for (var i = 0; i < this._workers.length; ++i) {
      var channel = new MessageChannel();
      this._workers[i].postMessage({ channelWorkerPort: channel.port1, msg: msg }, [channel.port1]);
    }
  }
};
