import { SearchAutomaton } from "../search/search-automaton";

describe("Search automaton test", () => {
  it("should be able to search within a long clinical text for several keywords", () => {
    const automaton = new SearchAutomaton(["Medications:", "MEDS:", "MEDICATIONS"]);

    expect(automaton.findAll("MEDICATIONS: Medications: MEDS:")).toEqual([
      { searchTerm: "Medications:", start: 0, end: 10 },
      { searchTerm: "MEDS:", start: 11, end: 15 },
      { searchTerm: "MEDICATIONS", start: 16, end: 28 },
    ]);
  });

  it("should be able to search for multiple terms", () => {
    const automaton = new SearchAutomaton(["hello", "world"]);
    expect(automaton.findAll("hello world")).toEqual([
      { searchTerm: "hello", start: 0, end: 4 },
      { searchTerm: "world", start: 6, end: 10 },
    ]);

    expect(automaton.findAll("world hello")).toEqual([
      { searchTerm: "world", start: 0, end: 4 },
      { searchTerm: "hello", start: 6, end: 10 },
    ]);

    expect(automaton.findAll("world hello world")).toEqual([
      { searchTerm: "world", start: 0, end: 4 },
      { searchTerm: "hello", start: 6, end: 10 },
      { searchTerm: "world", start: 12, end: 16 },
    ]);
  });

  it("should be able to search for multiple terms with overlapping matches", () => {
    const automaton = new SearchAutomaton(["aaa", "bbb", "aba", "bab", "baba"]);
    const testText = "aaabbbabababbb";
    console.log(automaton.findAll(testText));

    expect(automaton.findAll(testText)).toEqual([
      { searchTerm: "aaa", start: 0, end: 3 },
      { searchTerm: "bbb", start: 3, end: 6 },
      { searchTerm: "bab", start: 5, end: 8 },
      { searchTerm: "aba", start: 6, end: 9 },
      { searchTerm: "baba", start: 5, end: 9 },
      { searchTerm: "bab", start: 7, end: 10 },
      { searchTerm: "aba", start: 8, end: 11 },
      { searchTerm: "baba", start: 7, end: 11 },
      { searchTerm: "bab", start: 9, end: 12 },
      { searchTerm: "bbb", start: 11, end: 14 },
    ]);
  });
});
