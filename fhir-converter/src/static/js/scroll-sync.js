// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------
/* eslint-disable no-undef, no-unused-vars */
function setLastScrollPosition(editor) {
  if (lastScrollEditors.indexOf(editor) < 0) lastScrollEditors.push(editor);
  lastScrollPositions["editor." + lastScrollEditors.indexOf(editor)] = editor.getScrollInfo();
}

function getLastScrollPosition(editor) {
  return lastScrollPositions["editor." + lastScrollEditors.indexOf(editor)];
}

function setSkipNextScrollHandler(editor, state) {
  if (lastScrollEditors.indexOf(editor) < 0) lastScrollEditors.push(editor);
  skipScrollHandlers["editor." + lastScrollEditors.indexOf(editor)] = state;
}

function shouldSkipNextScrollHandler(editor) {
  if (lastScrollEditors.indexOf(editor) < 0) lastScrollEditors.push(editor);
  return skipScrollHandlers["editor." + lastScrollEditors.indexOf(editor)];
}

function adjustScrolling(scrollSourceEditor, scrollTargetEditor, sourceLines, targetLines) {
  if (!getSettings().scrollSync) {
    return;
  }

  if (shouldSkipNextScrollHandler(scrollSourceEditor)) {
    setSkipNextScrollHandler(scrollSourceEditor, false);
    return;
  }

  var sourceScrollInfo = scrollSourceEditor.getScrollInfo();
  var targetScrollInfo = scrollTargetEditor.getScrollInfo();

  var sourceLineTop = scrollSourceEditor.coordsChar(
    { left: sourceScrollInfo.left, top: sourceScrollInfo.top },
    "local"
  ).line;
  var sourceLineBottom = scrollSourceEditor.coordsChar(
    { left: sourceScrollInfo.left, top: sourceScrollInfo.top + sourceScrollInfo.clientHeight },
    "local"
  ).line;
  var sourceRange = { top: sourceLineTop, bottom: sourceLineBottom };

  var targetLineTop = scrollTargetEditor.coordsChar(
    { left: targetScrollInfo.left, top: targetScrollInfo.top },
    "local"
  ).line;
  var targetLineBottom = scrollTargetEditor.coordsChar(
    { left: targetScrollInfo.left, top: targetScrollInfo.top + targetScrollInfo.clientHeight },
    "local"
  ).line;
  var currentTargetRange = { top: targetLineTop, bottom: targetLineBottom };

  // Map based on current line mapping
  var destinationRange = sourceRangeToDestinationRange(sourceRange, sourceLines, targetLines);

  // If the destination range is taller than the editor size,
  // we need to adjust the destination range:
  //   if (scrolling down) trim the top
  //   else trim the bottom of the range

  var destinationHeightLines = destinationRange.bottom - destinationRange.top;
  var targetHeightLines = currentTargetRange.bottom - currentTargetRange.top;

  var lastScrollInfo = getLastScrollPosition(scrollSourceEditor) || sourceScrollInfo;
  setLastScrollPosition(scrollSourceEditor);

  if (lastScrollInfo.top == sourceScrollInfo.top) {
    return;
  } else if (lastScrollInfo.top > sourceScrollInfo.top) {
    // Scrolling up
    if (destinationHeightLines > targetHeightLines) {
      destinationRange.bottom =
        destinationRange.bottom - (destinationHeightLines - targetHeightLines);
    }
  } else {
    if (destinationHeightLines > targetHeightLines) {
      destinationRange.top = destinationRange.top + (destinationHeightLines - targetHeightLines);
    }
  }

  setSkipNextScrollHandler(scrollTargetEditor, true); // So we don't trigger while we manipulate scroll
  scrollTargetEditor.scrollIntoView({
    from: { line: destinationRange.top, ch: 0 },
    to: { line: destinationRange.bottom, ch: 0 },
  });
}

/* 
    Give a sourceRange ({top: lineNum, bottom: lineNum})
    and two arrays of source and destination lines
    map the sourceRange to a destinationRange.
*/
function sourceRangeToDestinationRange(sourceRange, sourceLines, destinationLines) {
  if (sourceLines.length != destinationLines.length) {
    throw Error("Source and destination arrays lengths do not match");
  }

  // Assume destination range is the max range and we will narrow it below
  var topTarget = { source: 0, destination: Math.min(...destinationLines) }; // mapping.reduce((prev, current) => (prev.destination < current.destination) ? prev : current);
  var bottomTarget = {
    source: Math.max(...sourceLines),
    destination: Math.max(...destinationLines),
  }; // mapping.reduce((prev, current) => (prev.destination > current.destination) ? prev : current);

  for (var i = 0; i < sourceLines.length; i++) {
    // Is this a good candidate for the top target
    if (
      sourceLines[i] <= sourceRange.top && // If this one is above the current source range
      sourceRange.top - sourceLines[i] <= sourceRange.top - topTarget.source && // If it is closer to the line we currently have
      destinationLines[i] > topTarget.destination // If the destination is further up
    ) {
      topTarget = { source: sourceLines[i], destination: destinationLines[i] };
    }

    // Is this a good candidate for the bottom target
    if (
      sourceLines[i] >= sourceRange.bottom && // If this line is below the sour target
      sourceLines[i] - sourceRange.bottom <= bottomTarget.source - sourceRange.bottom && // If it is closer to the line we currently have
      destinationLines[i] < bottomTarget.destination // If the destination is further down
    ) {
      bottomTarget = { source: sourceLines[i], destination: destinationLines[i] };
    }
  }

  return { top: topTarget.destination, bottom: bottomTarget.destination };
}
