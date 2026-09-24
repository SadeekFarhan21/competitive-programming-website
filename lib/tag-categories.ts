// Collapses each judge's detailed tags ("Depth-First Search", "dsu",
// "Divisibility / Factorization") into a few broad categories.
// Listed in display priority: the most specific categories win the two slots.
const CATEGORIES: [string, RegExp][] = [
  ["DP", /dynamic programming|\bdp\b|memoization|knapsack/],
  ["Graphs", /graph|\bdfs\b|\bbfs\b|depth-first|breadth-first|shortest path|dijkstra|union.?find|\bdsu\b|topological|flows?\b|matching|2-sat|spanning tree|eulerian/],
  ["Trees", /(?<!segment |indexed )\btrees?\b|binary tree|\btrie\b|lca/],
  ["Strings", /string|hashing|\bkmp\b|suffix|palindrom/],
  ["Geometry", /geometr/],
  ["Math", /math|number theory|combinator|probabilit|prime|divisib|factoriz|modular|\bgcd\b|common.divisor|counting|\bfft\b|game theory|matrices/],
  ["Binary Search", /binary search(?! tree)/],
  ["Data Structures", /data structure|segment tree|fenwick|binary indexed|heap|priority queue|stack|queue|hash table|linked list|ordered set|sparse table|range quer|monotonic/],
  ["Greedy", /greedy/],
  ["Bit Manipulation", /\bbit|bitmask/],
  ["Sorting", /sort/],
  ["Arrays", /array|two pointers|sliding window|prefix sum|matrix/],
  ["Implementation", /implementation|simulation|brute force|constructive|ad.hoc|one-liner|basics|introduct|loops|basic programming|conditional|cakewalk/],
];

export function tagCategories(tags: string[], limit = 2): string[] {
  const found = new Set<string>();
  for (const tag of tags) {
    const value = tag.toLowerCase();
    for (const [category, pattern] of CATEGORIES) {
      if (pattern.test(value)) found.add(category);
    }
  }
  return CATEGORIES.map(([category]) => category)
    .filter((category) => found.has(category))
    .slice(0, limit);
}
