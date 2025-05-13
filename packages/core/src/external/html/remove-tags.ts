const genericStopWords = ["nullFlavor"];

const htmlStopWords = [
  "html",
  "br",
  "table",
  "th",
  "tr",
  "td",
  "tbody",
  "thead",
  "div",
  "col",
  "colgroup",
  "paragraph",
];

const regexGenericWords = new RegExp(
  `(${genericStopWords.map(w => w.toLowerCase()).join("|")})`,
  "g"
);
// removes the tag w/ attributes, but without content
const regexHTML = new RegExp(
  `</?(${htmlStopWords.map(w => w.toLowerCase()).join("|")})(\\s.*?)?/?>`,
  "g"
);
const regexFormatting = new RegExp(/(__+|--+)/g);
const regexMarkupAttributes = new RegExp(/((\w+(:\w+)?)(:\w+)?="(?<content>[^"]+?)")/g);
const regexAdditionalMarkup = new RegExp(/<(\w+(:\w+)?)(\s*|\s(?<content>[^>]+?))\/?>/g);
const regexClosingMarkup = new RegExp(/<\/(\w+(:\w+)?)>/g);
const regexNewlinesTabs = new RegExp(/"|(\n\n)|\n|\t|\r|<!/g);
const regexMultipleSpaces = new RegExp(/(\s\s+)/g);

/**
 * Removes HTML tags from the contents.
 * @param contents - The contents to remove HTML tags from.
 * @param log - The log function to use.
 * @param isTracing - Whether to trace/log the steps.
 * @returns The contents with HTML tags removed.
 */
export function removeHtmlTags({
  contents,
  isRemoveNewLinesAndSpaces = true,
  log,
  isTracing = false,
}: {
  contents: string;
  isRemoveNewLinesAndSpaces?: boolean;
  log?: typeof console.log;
  isTracing?: boolean;
}): string {
  log && log(`Removing HTML tags...`);

  const trace = (msg: string) => isTracing && log && log(msg);

  // Have this here so we can debug it easier when there's a problem. Use the unit test to add new
  // cases to represent future issues.
  let step = 1;
  const runStep = (fn: () => string, action: string): string => {
    const res = fn();
    trace(`Step${step}: ${action}`);
    trace(`Step${step}: ${res}`);
    step++;
    return res;
  };
  const regexStep = (updatedContents: string, regex: RegExp, replacement: string): string => {
    return runStep(() => updatedContents.replace(regex, replacement), regex.toString());
  };

  // The order is important!
  const step1 = runStep(() => contents.trim(), "trim");
  const regexSteps = [
    (input: string) => regexStep(input, regexHTML, " "),
    (input: string) => regexStep(input, regexFormatting, " "),
    (input: string) => regexStep(input, regexMarkupAttributes, " $<content> "),
    (input: string) => regexStep(input, regexAdditionalMarkup, " $<content> "),
    (input: string) => regexStep(input, regexClosingMarkup, " "),
    (input: string) => regexStep(input, regexGenericWords, " "),
    ...(isRemoveNewLinesAndSpaces
      ? [
          (input: string) => regexStep(input, regexNewlinesTabs, " "),
          (input: string) => regexStep(input, regexMultipleSpaces, " "),
        ]
      : []),
  ];
  let lastStepResult = step1;
  for (const step of regexSteps) {
    lastStepResult = step(lastStepResult);
  }
  return lastStepResult;
}
