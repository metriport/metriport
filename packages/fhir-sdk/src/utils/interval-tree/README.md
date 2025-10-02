# node-interval-tree

An [Interval Tree](https://en.wikipedia.org/wiki/Interval_tree) data structure implemented as an augmented AVL Tree where each node maintains a list of records and their search intervals. Record is composed of an interval and its underlying data, sent by a client. This allows the interval tree to have the same interval inserted multiple times, as long as its data is different. Both insertion and deletion require `O(log n)` time. Searching requires `O(min(n, k * log n))` time, where `k` is the number of intervals in the output list.

[![NPM](https://img.shields.io/npm/v/node-interval-tree.svg?style=flat)](https://www.npmjs.org/package/node-interval-tree)

[![NPM](https://nodei.co/npm/node-interval-tree.png)](https://nodei.co/npm/node-interval-tree/)

## Usage

```ts
import IntervalTree from "node-interval-tree";
const intervalTree = new IntervalTree<string>();
```

### Insert

```ts
intervalTree.insert(low, high, "foo");
```

Insert an interval with associated data into the tree. Intervals with the same low and high value can be inserted, as long as their data is different.
Data can be any JS primitive or object.
`low` and `high` have to be numbers where `low <= high` (also the case for all other operations with `low` and `high`).
Returns true if successfully inserted, false if nothing inserted.

### Search

```ts
intervalTree.search(low, high);
```

Search all intervals that overlap low and high arguments, both of them inclusive. Low and high values don't need to be in the tree themselves.
Returns an array of all data objects of the intervals in the range [low, high]; doesn't return the intervals themselves.

### Remove

```ts
intervalTree.remove(low, high, "foo");
```

Remove an interval from the tree. To remove an interval, all arguments must match the one in the tree.
Returns true if successfully removed, false if nothing removed.

## Advanced usage

The default export is convenient to use but can be too limiting for some.
`exports.IntervalTree` operate on `Interval` directly, giving you access to the `low` and `high` values in the results.
You can attach extra properties to `Interval` but they should not be modified after insertion as objects in the tree are compared according to shallow equality.

```ts
import { Interval, IntervalTree } from "node-interval-tree";

interface StringInterval extends Interval {
  name: string;
}

const intervalTree = new IntervalTree<StringInterval>();
```

### Insert

```ts
intervalTree.insert({ low, high });
intervalTree.insert({ low, high, name: "foo" });
```

Insert an interval into the tree. Intervals are compared according to shallow equality and only inserted if unique.
Returns true if successfully inserted, false if nothing inserted.

### Search

```ts
intervalTree.search(low, high);
```

Search all intervals that overlap low and high arguments, both of them inclusive. Low and high values don't need to be in the tree themselves.
Returns an array of all intervals in the range [low, high].

### Remove

```ts
intervalTree.remove({ low, high });
intervalTree.remove({ low, high, name: "foo" });
```

Remove an interval from the tree. Intervals are compared according to shallow equality and only removed if all properties match.
Returns true if successfully removed, false if nothing removed.

## BigInt support

The `low` and `high` values of the interval are of type `number` by default. However, the library
offers support to use `bigint` type for interval keys instead.

With default export:

```ts
import IntervalTree from "node-interval-tree";
const intervalTree = new IntervalTree<string, bigint>();
```

With advanced export:

```ts
import { Interval, IntervalTree } from "node-interval-tree";

interface StringInterval extends Interval<bigint> {
  name: string;
}

const intervalTree = new IntervalTree<StringInterval, bigint>();
```

## Example

```ts
import IntervalTree from "node-interval-tree";

const intervalTree = new IntervalTree<string>();
intervalTree.insert(10, 15, "foo"); // -> true
intervalTree.insert(35, 50, "baz"); // -> true

intervalTree.search(12, 20); // -> ['foo']

intervalTree.remove(35, 50, "baz"); // -> true
intervalTree.insert(10, 15, "baz"); // -> true

intervalTree.search(12, 20); // -> ['foo', 'baz']
```

More examples can be found in the demo folder.

## License

MIT
