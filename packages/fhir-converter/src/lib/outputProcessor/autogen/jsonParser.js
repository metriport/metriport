// Generated from E:\work\health\src\FHIR-Converter-handlebars\src\lib\outputProcessor\json.g4 by ANTLR 4.9.2
// jshint ignore: start
var antlr4 = require("antlr4");
var jsonListener = require("./jsonListener").jsonListener;
var jsonVisitor = require("./jsonVisitor").jsonVisitor;

const serializedATN = [
  "\u0003\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786",
  "\u5964\u0003\u000eI\u0004\u0002\t\u0002\u0004\u0003\t\u0003\u0004\u0004",
  "\t\u0004\u0004\u0005\t\u0005\u0004\u0006\t\u0006\u0003\u0002\u0003\u0002",
  "\u0003\u0003\u0003\u0003\u0007\u0003\u0011\n\u0003\f\u0003\u000e\u0003",
  "\u0014\u000b\u0003\u0003\u0003\u0007\u0003\u0017\n\u0003\f\u0003\u000e",
  "\u0003\u001a\u000b\u0003\u0003\u0003\u0007\u0003\u001d\n\u0003\f\u0003",
  "\u000e\u0003 \u000b\u0003\u0003\u0003\u0003\u0003\u0003\u0004\u0003",
  "\u0004\u0003\u0004\u0003\u0004\u0003\u0004\u0005\u0004)\n\u0004\u0003",
  "\u0005\u0003\u0005\u0007\u0005-\n\u0005\f\u0005\u000e\u00050\u000b\u0005",
  "\u0003\u0005\u0007\u00053\n\u0005\f\u0005\u000e\u00056\u000b\u0005\u0003",
  "\u0005\u0007\u00059\n\u0005\f\u0005\u000e\u0005<\u000b\u0005\u0003\u0005",
  "\u0003\u0005\u0003\u0006\u0003\u0006\u0003\u0006\u0003\u0006\u0003\u0006",
  "\u0003\u0006\u0003\u0006\u0005\u0006G\n\u0006\u0003\u0006\u0002\u0002",
  "\u0007\u0002\u0004\u0006\b\n\u0002\u0002\u0002P\u0002\f\u0003\u0002",
  "\u0002\u0002\u0004\u000e\u0003\u0002\u0002\u0002\u0006(\u0003\u0002",
  "\u0002\u0002\b*\u0003\u0002\u0002\u0002\nF\u0003\u0002\u0002\u0002\f",
  "\r\u0005\u0004\u0003\u0002\r\u0003\u0003\u0002\u0002\u0002\u000e\u0018",
  "\u0007\u0003\u0002\u0002\u000f\u0011\u0007\u0004\u0002\u0002\u0010\u000f",
  "\u0003\u0002\u0002\u0002\u0011\u0014\u0003\u0002\u0002\u0002\u0012\u0010",
  "\u0003\u0002\u0002\u0002\u0012\u0013\u0003\u0002\u0002\u0002\u0013\u0015",
  "\u0003\u0002\u0002\u0002\u0014\u0012\u0003\u0002\u0002\u0002\u0015\u0017",
  "\u0005\u0006\u0004\u0002\u0016\u0012\u0003\u0002\u0002\u0002\u0017\u001a",
  "\u0003\u0002\u0002\u0002\u0018\u0016\u0003\u0002\u0002\u0002\u0018\u0019",
  "\u0003\u0002\u0002\u0002\u0019\u001e\u0003\u0002\u0002\u0002\u001a\u0018",
  "\u0003\u0002\u0002\u0002\u001b\u001d\u0007\u0004\u0002\u0002\u001c\u001b",
  "\u0003\u0002\u0002\u0002\u001d \u0003\u0002\u0002\u0002\u001e\u001c",
  "\u0003\u0002\u0002\u0002\u001e\u001f\u0003\u0002\u0002\u0002\u001f!",
  '\u0003\u0002\u0002\u0002 \u001e\u0003\u0002\u0002\u0002!"\u0007\u0005',
  '\u0002\u0002"\u0005\u0003\u0002\u0002\u0002#$\u0007\f\u0002\u0002$',
  ")\u0007\u0006\u0002\u0002%&\u0007\f\u0002\u0002&'\u0007\u0006\u0002",
  "\u0002')\u0005\n\u0006\u0002(#\u0003\u0002\u0002\u0002(%\u0003\u0002",
  "\u0002\u0002)\u0007\u0003\u0002\u0002\u0002*4\u0007\u0007\u0002\u0002",
  "+-\u0007\u0004\u0002\u0002,+\u0003\u0002\u0002\u0002-0\u0003\u0002\u0002",
  "\u0002.,\u0003\u0002\u0002\u0002./\u0003\u0002\u0002\u0002/1\u0003\u0002",
  "\u0002\u00020.\u0003\u0002\u0002\u000213\u0005\n\u0006\u00022.\u0003",
  "\u0002\u0002\u000236\u0003\u0002\u0002\u000242\u0003\u0002\u0002\u0002",
  "45\u0003\u0002\u0002\u00025:\u0003\u0002\u0002\u000264\u0003\u0002\u0002",
  "\u000279\u0007\u0004\u0002\u000287\u0003\u0002\u0002\u00029<\u0003\u0002",
  "\u0002\u0002:8\u0003\u0002\u0002\u0002:;\u0003\u0002\u0002\u0002;=\u0003",
  "\u0002\u0002\u0002<:\u0003\u0002\u0002\u0002=>\u0007\b\u0002\u0002>",
  "\t\u0003\u0002\u0002\u0002?G\u0007\f\u0002\u0002@G\u0007\r\u0002\u0002",
  "AG\u0005\u0004\u0003\u0002BG\u0005\b\u0005\u0002CG\u0007\t\u0002\u0002",
  "DG\u0007\n\u0002\u0002EG\u0007\u000b\u0002\u0002F?\u0003\u0002\u0002",
  "\u0002F@\u0003\u0002\u0002\u0002FA\u0003\u0002\u0002\u0002FB\u0003\u0002",
  "\u0002\u0002FC\u0003\u0002\u0002\u0002FD\u0003\u0002\u0002\u0002FE\u0003",
  "\u0002\u0002\u0002G\u000b\u0003\u0002\u0002\u0002\n\u0012\u0018\u001e",
  "(.4:F",
].join("");

const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map((ds, index) => new antlr4.dfa.DFA(ds, index));

const sharedContextCache = new antlr4.PredictionContextCache();

class jsonParser extends antlr4.Parser {
  static grammarFileName = "json.g4";
  static literalNames = [
    null,
    "'{'",
    "','",
    "'}'",
    "':'",
    "'['",
    "']'",
    "'true'",
    "'false'",
    "'null'",
  ];
  static symbolicNames = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "STRING",
    "NUMBER",
    "WS",
  ];
  static ruleNames = ["json", "obj", "pair", "array", "value"];

  constructor(input) {
    super(input);
    this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
    this.ruleNames = jsonParser.ruleNames;
    this.literalNames = jsonParser.literalNames;
    this.symbolicNames = jsonParser.symbolicNames;
  }

  get atn() {
    return atn;
  }

  json() {
    let localctx = new JsonContext(this, this._ctx, this.state);
    this.enterRule(localctx, 0, jsonParser.RULE_json);
    try {
      this.enterOuterAlt(localctx, 1);
      this.state = 10;
      this.obj();
    } catch (re) {
      if (re instanceof antlr4.error.RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }

  obj() {
    let localctx = new ObjContext(this, this._ctx, this.state);
    this.enterRule(localctx, 2, jsonParser.RULE_obj);
    var _la = 0; // Token type
    try {
      this.enterOuterAlt(localctx, 1);
      this.state = 12;
      this.match(jsonParser.T__0);
      this.state = 22;
      this._errHandler.sync(this);
      var _alt = this._interp.adaptivePredict(this._input, 1, this._ctx);
      while (_alt != 2 && _alt != antlr4.atn.ATN.INVALID_ALT_NUMBER) {
        if (_alt === 1) {
          this.state = 16;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
          while (_la === jsonParser.T__1) {
            this.state = 13;
            this.match(jsonParser.T__1);
            this.state = 18;
            this._errHandler.sync(this);
            _la = this._input.LA(1);
          }
          this.state = 19;
          this.pair();
        }
        this.state = 24;
        this._errHandler.sync(this);
        _alt = this._interp.adaptivePredict(this._input, 1, this._ctx);
      }

      this.state = 28;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
      while (_la === jsonParser.T__1) {
        this.state = 25;
        this.match(jsonParser.T__1);
        this.state = 30;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
      }
      this.state = 31;
      this.match(jsonParser.T__2);
    } catch (re) {
      if (re instanceof antlr4.error.RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }

  pair() {
    let localctx = new PairContext(this, this._ctx, this.state);
    this.enterRule(localctx, 4, jsonParser.RULE_pair);
    try {
      this.state = 38;
      this._errHandler.sync(this);
      var la_ = this._interp.adaptivePredict(this._input, 3, this._ctx);
      switch (la_) {
        case 1:
          this.enterOuterAlt(localctx, 1);
          this.state = 33;
          this.match(jsonParser.STRING);
          this.state = 34;
          this.match(jsonParser.T__3);
          break;

        case 2:
          this.enterOuterAlt(localctx, 2);
          this.state = 35;
          this.match(jsonParser.STRING);
          this.state = 36;
          this.match(jsonParser.T__3);
          this.state = 37;
          this.value();
          break;
      }
    } catch (re) {
      if (re instanceof antlr4.error.RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }

  array() {
    let localctx = new ArrayContext(this, this._ctx, this.state);
    this.enterRule(localctx, 6, jsonParser.RULE_array);
    var _la = 0; // Token type
    try {
      this.enterOuterAlt(localctx, 1);
      this.state = 40;
      this.match(jsonParser.T__4);
      this.state = 50;
      this._errHandler.sync(this);
      var _alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
      while (_alt != 2 && _alt != antlr4.atn.ATN.INVALID_ALT_NUMBER) {
        if (_alt === 1) {
          this.state = 44;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
          while (_la === jsonParser.T__1) {
            this.state = 41;
            this.match(jsonParser.T__1);
            this.state = 46;
            this._errHandler.sync(this);
            _la = this._input.LA(1);
          }
          this.state = 47;
          this.value();
        }
        this.state = 52;
        this._errHandler.sync(this);
        _alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
      }

      this.state = 56;
      this._errHandler.sync(this);
      _la = this._input.LA(1);
      while (_la === jsonParser.T__1) {
        this.state = 53;
        this.match(jsonParser.T__1);
        this.state = 58;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
      }
      this.state = 59;
      this.match(jsonParser.T__5);
    } catch (re) {
      if (re instanceof antlr4.error.RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }

  value() {
    let localctx = new ValueContext(this, this._ctx, this.state);
    this.enterRule(localctx, 8, jsonParser.RULE_value);
    try {
      this.state = 68;
      this._errHandler.sync(this);
      switch (this._input.LA(1)) {
        case jsonParser.STRING:
          this.enterOuterAlt(localctx, 1);
          this.state = 61;
          this.match(jsonParser.STRING);
          break;
        case jsonParser.NUMBER:
          this.enterOuterAlt(localctx, 2);
          this.state = 62;
          this.match(jsonParser.NUMBER);
          break;
        case jsonParser.T__0:
          this.enterOuterAlt(localctx, 3);
          this.state = 63;
          this.obj();
          break;
        case jsonParser.T__4:
          this.enterOuterAlt(localctx, 4);
          this.state = 64;
          this.array();
          break;
        case jsonParser.T__6:
          this.enterOuterAlt(localctx, 5);
          this.state = 65;
          this.match(jsonParser.T__6);
          break;
        case jsonParser.T__7:
          this.enterOuterAlt(localctx, 6);
          this.state = 66;
          this.match(jsonParser.T__7);
          break;
        case jsonParser.T__8:
          this.enterOuterAlt(localctx, 7);
          this.state = 67;
          this.match(jsonParser.T__8);
          break;
        default:
          throw new antlr4.error.NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof antlr4.error.RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
}

jsonParser.EOF = antlr4.Token.EOF;
jsonParser.T__0 = 1;
jsonParser.T__1 = 2;
jsonParser.T__2 = 3;
jsonParser.T__3 = 4;
jsonParser.T__4 = 5;
jsonParser.T__5 = 6;
jsonParser.T__6 = 7;
jsonParser.T__7 = 8;
jsonParser.T__8 = 9;
jsonParser.STRING = 10;
jsonParser.NUMBER = 11;
jsonParser.WS = 12;

jsonParser.RULE_json = 0;
jsonParser.RULE_obj = 1;
jsonParser.RULE_pair = 2;
jsonParser.RULE_array = 3;
jsonParser.RULE_value = 4;

class JsonContext extends antlr4.ParserRuleContext {
  constructor(parser, parent, invokingState) {
    if (parent === undefined) {
      parent = null;
    }
    if (invokingState === undefined || invokingState === null) {
      invokingState = -1;
    }
    super(parent, invokingState);
    this.parser = parser;
    this.ruleIndex = jsonParser.RULE_json;
  }

  obj() {
    return this.getTypedRuleContext(ObjContext, 0);
  }

  enterRule(listener) {
    if (listener instanceof jsonListener) {
      listener.enterJson(this);
    }
  }

  exitRule(listener) {
    if (listener instanceof jsonListener) {
      listener.exitJson(this);
    }
  }

  accept(visitor) {
    if (visitor instanceof jsonVisitor) {
      return visitor.visitJson(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ObjContext extends antlr4.ParserRuleContext {
  constructor(parser, parent, invokingState) {
    if (parent === undefined) {
      parent = null;
    }
    if (invokingState === undefined || invokingState === null) {
      invokingState = -1;
    }
    super(parent, invokingState);
    this.parser = parser;
    this.ruleIndex = jsonParser.RULE_obj;
  }

  pair = function (i) {
    if (i === undefined) {
      i = null;
    }
    if (i === null) {
      return this.getTypedRuleContexts(PairContext);
    } else {
      return this.getTypedRuleContext(PairContext, i);
    }
  };

  enterRule(listener) {
    if (listener instanceof jsonListener) {
      listener.enterObj(this);
    }
  }

  exitRule(listener) {
    if (listener instanceof jsonListener) {
      listener.exitObj(this);
    }
  }

  accept(visitor) {
    if (visitor instanceof jsonVisitor) {
      return visitor.visitObj(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class PairContext extends antlr4.ParserRuleContext {
  constructor(parser, parent, invokingState) {
    if (parent === undefined) {
      parent = null;
    }
    if (invokingState === undefined || invokingState === null) {
      invokingState = -1;
    }
    super(parent, invokingState);
    this.parser = parser;
    this.ruleIndex = jsonParser.RULE_pair;
  }

  STRING() {
    return this.getToken(jsonParser.STRING, 0);
  }

  value() {
    return this.getTypedRuleContext(ValueContext, 0);
  }

  enterRule(listener) {
    if (listener instanceof jsonListener) {
      listener.enterPair(this);
    }
  }

  exitRule(listener) {
    if (listener instanceof jsonListener) {
      listener.exitPair(this);
    }
  }

  accept(visitor) {
    if (visitor instanceof jsonVisitor) {
      return visitor.visitPair(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ArrayContext extends antlr4.ParserRuleContext {
  constructor(parser, parent, invokingState) {
    if (parent === undefined) {
      parent = null;
    }
    if (invokingState === undefined || invokingState === null) {
      invokingState = -1;
    }
    super(parent, invokingState);
    this.parser = parser;
    this.ruleIndex = jsonParser.RULE_array;
  }

  value = function (i) {
    if (i === undefined) {
      i = null;
    }
    if (i === null) {
      return this.getTypedRuleContexts(ValueContext);
    } else {
      return this.getTypedRuleContext(ValueContext, i);
    }
  };

  enterRule(listener) {
    if (listener instanceof jsonListener) {
      listener.enterArray(this);
    }
  }

  exitRule(listener) {
    if (listener instanceof jsonListener) {
      listener.exitArray(this);
    }
  }

  accept(visitor) {
    if (visitor instanceof jsonVisitor) {
      return visitor.visitArray(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

class ValueContext extends antlr4.ParserRuleContext {
  constructor(parser, parent, invokingState) {
    if (parent === undefined) {
      parent = null;
    }
    if (invokingState === undefined || invokingState === null) {
      invokingState = -1;
    }
    super(parent, invokingState);
    this.parser = parser;
    this.ruleIndex = jsonParser.RULE_value;
  }

  STRING() {
    return this.getToken(jsonParser.STRING, 0);
  }

  NUMBER() {
    return this.getToken(jsonParser.NUMBER, 0);
  }

  obj() {
    return this.getTypedRuleContext(ObjContext, 0);
  }

  array() {
    return this.getTypedRuleContext(ArrayContext, 0);
  }

  enterRule(listener) {
    if (listener instanceof jsonListener) {
      listener.enterValue(this);
    }
  }

  exitRule(listener) {
    if (listener instanceof jsonListener) {
      listener.exitValue(this);
    }
  }

  accept(visitor) {
    if (visitor instanceof jsonVisitor) {
      return visitor.visitValue(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

jsonParser.JsonContext = JsonContext;
jsonParser.ObjContext = ObjContext;
jsonParser.PairContext = PairContext;
jsonParser.ArrayContext = ArrayContext;
jsonParser.ValueContext = ValueContext;

exports.jsonParser = jsonParser;
