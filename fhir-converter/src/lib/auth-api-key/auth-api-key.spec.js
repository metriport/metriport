var assert = require("assert");
var authApiKey = require("./auth-api-key");

describe("auth-api-key.setValidApiKeys", function () {
  it("should throw when given input that is not an array of strings", function () {
    assert.throws(
      () => {
        authApiKey.setValidApiKeys("foo");
      },
      Error,
      "Keys must be an array of strings"
    );
  });
});

describe("auth-api-key.validateApiKey (without keys)", function () {
  before(function () {
    // Mock the keys
    authApiKey.setValidApiKeys([]);
  });

  it("should call next() without a valid code query parameter or header", function (done) {
    var req = {
      get: function () {
        return undefined;
      },
      query: {},
    };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
    };
    authApiKey.validateApiKey(req, res, function () {
      done();
    });
  });
});

describe("auth-api-key.validateApiKey (with keys)", function () {
  before(function () {
    // Mock the keys
    authApiKey.setValidApiKeys(["123", " 456 "]); // Spaces added around second code to test trim
  });

  it("should call next() with valid code (123) query parameter", function (done) {
    var req = {
      get: function () {
        return undefined;
      },
      query: { code: "123" },
    };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
      cookie: function () {},
    };
    authApiKey.validateApiKey(req, res, function () {
      done();
    });
  });

  it("should call next() with valid code (456) query parameter", function (done) {
    var req = {
      get: function () {
        return undefined;
      },
      query: { code: "456" },
    };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
      cookie: function () {},
    };
    authApiKey.validateApiKey(req, res, function () {
      done();
    });
  });

  it("should call next() with valid header (123) key", function (done) {
    var req = {
      get: function () {
        return "123";
      },
      query: {},
    };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
      cookie: function () {},
    };
    authApiKey.validateApiKey(req, res, function () {
      done();
    });
  });

  it("should call next() with valid header (456) key", function (done) {
    var req = {
      get: function () {
        return "456";
      },
      query: {},
    };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
      cookie: function () {},
    };
    authApiKey.validateApiKey(req, res, function () {
      done();
    });
  });

  it("should call next() with valid cookie (456) key", function (done) {
    var req = { get: function () {}, query: {}, cookies: { key: "456" } };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
      cookie: function () {},
    };
    authApiKey.validateApiKey(req, res, function () {
      done();
    });
  });

  it("should set correct cookie when cookie is sent", function (done) {
    var req = { get: function () {}, query: {}, cookies: { key: "456" } };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
      cookie: function (x, y, z) {
        if (x == "key" && y == "456" && z.httpOnly && z.secure) {
          done();
        }
      },
    };
    authApiKey.validateApiKey(req, res, function () {});
  });

  it("should set correct cookie when valid header is sent", function (done) {
    var req = {
      get: function () {
        return "456";
      },
      query: {},
    };
    var res = {
      status: function () {
        done(new Error("res.status() should not be called"));
      },
      json: function () {
        done(new Error("res.json() should not be called"));
      },
      cookie: function (x, y, z) {
        if (x == "key" && y == "456" && z.httpOnly && z.secure) {
          done();
        }
      },
    };
    authApiKey.validateApiKey(req, res, function () {});
  });

  it("should return 401 without valid key", function (done) {
    var req = {
      get: function () {
        return undefined;
      },
      query: {},
      cookies: { key: "dummy" },
    };
    var res = {
      status: function (s) {
        if (s == 401) return done();
      },
      json: function () {},
    };
    authApiKey.validateApiKey(req, res, function () {
      new Error("next() should not be called");
    });
  });

  it("should return 401 without valid key (key with spaces --> 456 <---)", function (done) {
    var req = {
      get: function () {
        return " 456 ";
      },
      query: {},
      cookies: { key: "dummy" },
    };
    var res = {
      status: function (s) {
        if (s == 401) return done();
      },
      json: function () {},
    };
    authApiKey.validateApiKey(req, res, function () {
      new Error("next() should not be called");
    });
  });
});
