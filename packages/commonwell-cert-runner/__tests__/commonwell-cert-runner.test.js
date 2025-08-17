'use strict';

const commonwellSdk = require('..');
const assert = require('assert').strict;

assert.strictEqual(commonwellSdk(), 'Hello from commonwellCertRunner');
console.info("commonwellCertRunner tests passed");
