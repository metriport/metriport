import { SearchAutomaton } from "../search/search-automaton";

describe("Search automaton test", () => {
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
});
