import { SearchAutomaton } from "../search/search-automaton";

describe("Search automaton test", () => {
  /**
   * This is a classic textbook example which ensures that suffix links work properly.
   */
  it("should work on a textbook example", () => {
    const automaton = new SearchAutomaton(["he", "she", "his", "hers"]);
    expect(automaton.findAll("ushers")).toEqual([
      { searchTerm: "he", start: 2, end: 4 },
      { searchTerm: "she", start: 1, end: 4 },
      { searchTerm: "hers", start: 2, end: 6 },
    ]);
  });

  it("should work on overlapping matches", () => {
    const automaton = new SearchAutomaton(["aba", "bab"]);
    expect(automaton.findAll("ababa")).toEqual([
      { searchTerm: "aba", start: 0, end: 3 },
      { searchTerm: "bab", start: 1, end: 4 },
      { searchTerm: "aba", start: 2, end: 5 },
    ]);
  });

  it("should work on shared prefixes", () => {
    const automaton = new SearchAutomaton(["a", "ab", "abc"]);
    expect(automaton.findAll("abcab")).toEqual([
      { searchTerm: "a", start: 0, end: 1 },
      { searchTerm: "ab", start: 0, end: 2 },
      { searchTerm: "abc", start: 0, end: 3 },
      { searchTerm: "a", start: 3, end: 4 },
      { searchTerm: "ab", start: 3, end: 5 },
    ]);
  });

  it("should follow failure links back on partial matches", () => {
    const automaton = new SearchAutomaton(["abcd", "bcd", "cd"]);
    expect(automaton.findAll("xabcdcdy")).toEqual([
      { searchTerm: "abcd", start: 1, end: 5 },
      { searchTerm: "bcd", start: 2, end: 5 },
      { searchTerm: "cd", start: 3, end: 5 },
      { searchTerm: "cd", start: 5, end: 7 },
    ]);
  });

  it("should not report false positives", () => {
    const automaton = new SearchAutomaton(["xyz", "123"]);
    expect(automaton.findAll("yzabcdefgxy xyyz 121223 xya bxy 93210 2124")).toEqual([]);
  });

  it("should be able to search within a long clinical text for several keywords", () => {
    const automaton = new SearchAutomaton(["Medications:", "MEDS:", "MEDICATIONS"]);

    expect(
      automaton.findAll("MEDICATIONS: 10 mg tylenol, 20 mg ibuprofen, ... Medications: MEDS:")
    ).toEqual([
      { searchTerm: "MEDICATIONS", start: 0, end: 11 },
      { searchTerm: "Medications:", start: 49, end: 61 },
      { searchTerm: "MEDS:", start: 62, end: 67 },
    ]);
  });

  it("should be able to search for multiple terms", () => {
    const automaton = new SearchAutomaton(["hello", "world"]);
    expect(automaton.findAll("hello world")).toEqual([
      { searchTerm: "hello", start: 0, end: 5 },
      { searchTerm: "world", start: 6, end: 11 },
    ]);

    expect(automaton.findAll("world hello")).toEqual([
      { searchTerm: "world", start: 0, end: 5 },
      { searchTerm: "hello", start: 6, end: 11 },
    ]);

    expect(automaton.findAll("world hello world")).toEqual([
      { searchTerm: "world", start: 0, end: 5 },
      { searchTerm: "hello", start: 6, end: 11 },
      { searchTerm: "world", start: 12, end: 17 },
    ]);
  });

  it("should be able to search for multiple terms with overlapping matches", () => {
    const automaton = new SearchAutomaton(["aaa", "bbb", "aba", "bab", "baba"]);
    expect(automaton.findAll("aaabbbabababbb")).toEqual([
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
