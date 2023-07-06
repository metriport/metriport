// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const handlebarsBlockKeywords = [
  "#with",
  "#if",
  "else",
  "#each",
  "#unless",
  "/with",
  "/if",
  "/each",
  "/unless",
];
const handlebarsAtKeywords = ["root", "first", "index", "key", "last", "level"];
const handlebarsHelperKeywords = ["lookup", "log"];
const varNameRegexp = /as\s+\|(\w+)\||'(\w\w\w)'/g;
const helpersHintRegexp = /\($/;
const mixHintRegexp = /{{$/;
const varNamesHintRegexp = /{{#if\s$|{{#with\s$/;
const templatesHintRegexp = /{{>$/;
const handlebarAtKeywordsHintRegexp = /@$/;
var hintAfterChars = {};
var helperNames;
var hintExtraKeysObj = {};

initHintAfterChars();
initHintExtraKeysObj();
initHelperList();

function initHintExtraKeysObj() {
  hintExtraKeysObj[`"Ctrl-Space"`] = "autocomplete";
  hintExtraKeysObj["'>'"] = completeAfter;
  hintExtraKeysObj["'('"] = completeAfter;
  hintExtraKeysObj["'{'"] = completeAfter;
  hintExtraKeysObj["' '"] = completeAfter;
  hintExtraKeysObj["'@'"] = completeAfter;
  Object.keys(hintAfterChars).forEach(c => {
    hintExtraKeysObj[`"${c}"`] = completeAfter;
  });
}

function getVarNames(editor, startLine, endLine) {
  var varNames = [];
  for (var lineNum = startLine; lineNum < endLine; ++lineNum) {
    var text = editor.getLine(lineNum);
    if (varNameRegexp.test(text)) {
      varNameRegexp.lastIndex = 0;
      varNames.push(...[...text.matchAll(varNameRegexp)].map(match => match[1] || match[2]));
    }
  }
  varNames.push("this");
  return varNames;
}

function initHintAfterChars() {
  var charList = ["-", "_", ".", "/", "#"];
  for (var i = "a".charCodeAt(0); i <= "z".charCodeAt(0); i++) {
    charList.push(String.fromCharCode(i));
  }
  for (var j = "A".charCodeAt(0); j <= "Z".charCodeAt(0); j++) {
    charList.push(String.fromCharCode(j));
  }
  for (var k = "0".charCodeAt(0); k <= "9".charCodeAt(0); k++) {
    charList.push(String.fromCharCode(k));
  }
  charList.forEach(c => (hintAfterChars[c] = true));
}

function initHelperList() {
  /*global getApiKey*/
  $.getJSON("/api/helpers?code=" + getApiKey(), function (helperList) {
    helperNames = helperList;
  });
}

function completeAfter(cm, pred) {
  if (!pred || pred())
    setTimeout(function () {
      if (!cm.state.completionActive) cm.showHint({ completeSingle: false });
    }, 1);
  return CodeMirror.Pass;
}

(function (mod) {
  mod(CodeMirror);
})(function (CodeMirror) {
  "use strict";

  var lineRange = 500;

  CodeMirror.registerHelper("hint", "anyword", function (editor) {
    var cur = editor.getCursor(),
      curLine = editor.getLine(cur.line);

    var end = cur.ch,
      start = end;

    while (start > 0 && hintAfterChars[curLine[start - 1]]) {
      --start;
    }

    var candidates = [];
    var slice = curLine.slice(Math.max(0, start - 8), start);

    if (helpersHintRegexp.test(slice)) {
      helpersHintRegexp.lastIndex = 0;
      helperNames.helpers.forEach(h => candidates.push(h.name));
      candidates.push(...handlebarsHelperKeywords);
    } else if (mixHintRegexp.test(slice)) {
      mixHintRegexp.lastIndex = 0;
      helperNames.helpers.forEach(h => candidates.push(h.name));
      candidates.push(...handlebarsHelperKeywords);
      candidates.push(...handlebarsBlockKeywords);
      getVarNames(editor, Math.max(0, cur.line - lineRange), cur.line).forEach(v =>
        candidates.push(v)
      );
    } else if (varNamesHintRegexp.test(slice)) {
      varNamesHintRegexp.lastIndex = 0;
      getVarNames(editor, Math.max(0, cur.line - lineRange), cur.line).forEach(v =>
        candidates.push(v)
      );
    } else if (templatesHintRegexp.test(slice)) {
      templatesHintRegexp.lastIndex = 0;
      /*global templateNames*/
      templateNames.forEach(x => candidates.push(x));
    } else if (handlebarAtKeywordsHintRegexp.test(slice)) {
      handlebarAtKeywordsHintRegexp.lastIndex = 0;
      candidates.push(...handlebarsAtKeywords);
    }

    // dedup
    candidates = Array.from(new Set(candidates));

    // filter
    if (start < end) {
      var prefix = curLine.slice(start, end).toLowerCase();
      candidates = candidates.filter(x => x.toLowerCase().indexOf(prefix) != -1);
    }

    candidates.sort();

    return {
      list: candidates,
      from: CodeMirror.Pos(cur.line, start),
      to: CodeMirror.Pos(cur.line, end),
    };
  });
});
