/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// This file is a modified version of the original node-interval-tree library.
// We want to make as few / minimal changes as possible, and ignore lint errors.

// An augmented AVL Tree where each node maintains a list of records and their search intervals.
// Record is composed of an interval and its underlying data, sent by a client. This allows the
// interval tree to have the same interval inserted multiple times, as long its data is different.
// Both insertion and deletion require O(log n) time. Searching requires O(k*logn) time, where `k`
// is the number of intervals in the output list.

import { shallowEqual } from "./shallowequal";

export interface Interval<N extends number | bigint = number> {
  readonly low: N;
  readonly high: N;
}

function max<N extends number | bigint>(a: N, b: N): N {
  return a < b ? b : a;
}

function height<T extends Interval<N>, N extends number | bigint = number>(node?: Node<T, N>) {
  if (node === undefined) {
    return -1;
  } else {
    return node.height;
  }
}

export class Node<T extends Interval<N>, N extends number | bigint = number> {
  public key: N;
  public max: N;
  public records: T[] = [];
  public parent?: Node<T, N>;
  public height = 0;
  public left?: Node<T, N>;
  public right?: Node<T, N>;

  constructor(public intervalTree: IntervalTree<T, N>, record: T) {
    this.key = record.low;
    this.max = record.high;

    // Save the array of all records with the same key for this node
    this.records.push(record);
  }

  // Gets the highest record.high value for this node
  public getNodeHigh() {
    let high = this.records[0].high;

    for (let i = 1; i < this.records.length; i++) {
      if (this.records[i].high > high) {
        high = this.records[i].high;
      }
    }

    return high;
  }

  // Updates height value of the node. Called during insertion, rebalance, removal
  public updateHeight() {
    this.height = max(height(this.left), height(this.right)) + 1;
  }

  // Updates the max value of all the parents after inserting into already existing node, as well as
  // removing the node completely or removing the record of an already existing node. Starts with
  // the parent of an affected node and bubbles up to root
  public updateMaxOfParents() {
    if (this === undefined) {
      return;
    }

    const thisHigh = this.getNodeHigh();
    if (this.left !== undefined && this.right !== undefined) {
      this.max = max(max(this.left.max, this.right.max), thisHigh);
    } else if (this.left !== undefined && this.right === undefined) {
      this.max = max(this.left.max, thisHigh);
    } else if (this.left === undefined && this.right !== undefined) {
      this.max = max(this.right.max, thisHigh);
    } else {
      this.max = thisHigh;
    }

    if (this.parent) {
      this.parent.updateMaxOfParents();
    }
  }

  /*
  Left-Left case:

         z                                      y
        / \                                   /   \
       y   T4      Right Rotate (z)          x     z
      / \          - - - - - - - - ->       / \   / \
     x   T3                                T1 T2 T3 T4
    / \
  T1   T2

  Left-Right case:

       z                               z                           x
      / \                             / \                        /   \
     y   T4  Left Rotate (y)         x  T4  Right Rotate(z)     y     z
    / \      - - - - - - - - ->     / \      - - - - - - - ->  / \   / \
  T1   x                           y  T3                      T1 T2 T3 T4
      / \                         / \
    T2   T3                      T1 T2
  */

  // Handles Left-Left case and Left-Right case after rebalancing AVL tree
  private _updateMaxAfterRightRotate() {
    const parent = this.parent!;
    const left = parent.left!;
    // Update max of left sibling (x in first case, y in second)
    const thisParentLeftHigh = left.getNodeHigh();
    if (left.left === undefined && left.right !== undefined) {
      left.max = max(thisParentLeftHigh, left.right.max);
    } else if (left.left !== undefined && left.right === undefined) {
      left.max = max(thisParentLeftHigh, left.left.max);
    } else if (left.left === undefined && left.right === undefined) {
      left.max = thisParentLeftHigh;
    } else {
      left.max = max(max(left.left!.max, left.right!.max), thisParentLeftHigh);
    }

    // Update max of itself (z)
    const thisHigh = this.getNodeHigh();
    if (this.left === undefined && this.right !== undefined) {
      this.max = max(thisHigh, this.right.max);
    } else if (this.left !== undefined && this.right === undefined) {
      this.max = max(thisHigh, this.left.max);
    } else if (this.left === undefined && this.right === undefined) {
      this.max = thisHigh;
    } else {
      this.max = max(max(this.left!.max, this.right!.max), thisHigh);
    }

    // Update max of parent (y in first case, x in second)
    parent.max = max(max(parent.left!.max, parent.right!.max), parent.getNodeHigh());
  }

  /*
  Right-Right case:

    z                               y
   / \                            /   \
  T1  y     Left Rotate(z)       z     x
     / \   - - - - - - - ->     / \   / \
    T2  x                      T1 T2 T3 T4
       / \
      T3 T4

  Right-Left case:

     z                            z                            x
    / \                          / \                         /   \
   T1  y   Right Rotate (y)     T1  x      Left Rotate(z)   z     y
      / \  - - - - - - - - ->      / \   - - - - - - - ->  / \   / \
     x  T4                        T2  y                   T1 T2 T3 T4
    / \                              / \
  T2   T3                           T3 T4
  */

  // Handles Right-Right case and Right-Left case in rebalancing AVL tree
  private _updateMaxAfterLeftRotate() {
    const parent = this.parent!;
    const right = parent.right!;
    // Update max of right sibling (x in first case, y in second)
    const thisParentRightHigh = right.getNodeHigh();
    if (right.left === undefined && right.right !== undefined) {
      right.max = max(thisParentRightHigh, right.right.max);
    } else if (right.left !== undefined && right.right === undefined) {
      right.max = max(thisParentRightHigh, right.left.max);
    } else if (right.left === undefined && right.right === undefined) {
      right.max = thisParentRightHigh;
    } else {
      right.max = max(max(right.left!.max, right.right!.max), thisParentRightHigh);
    }

    // Update max of itself (z)
    const thisHigh = this.getNodeHigh();
    if (this.left === undefined && this.right !== undefined) {
      this.max = max(thisHigh, this.right.max);
    } else if (this.left !== undefined && this.right === undefined) {
      this.max = max(thisHigh, this.left.max);
    } else if (this.left === undefined && this.right === undefined) {
      this.max = thisHigh;
    } else {
      this.max = max(max(this.left!.max, this.right!.max), thisHigh);
    }

    // Update max of parent (y in first case, x in second)
    parent.max = max(max(parent.left!.max, right.max), parent.getNodeHigh());
  }

  private _leftRotate() {
    const rightChild = this.right!;
    rightChild.parent = this.parent;

    if (rightChild.parent === undefined) {
      this.intervalTree.root = rightChild;
    } else {
      if (rightChild.parent.left === this) {
        rightChild.parent.left = rightChild;
      } else if (rightChild.parent.right === this) {
        rightChild.parent.right = rightChild;
      }
    }

    this.right = rightChild.left;
    if (this.right !== undefined) {
      this.right.parent = this;
    }
    rightChild.left = this;
    this.parent = rightChild;
    this.updateHeight();
    rightChild.updateHeight();
  }

  private _rightRotate() {
    const leftChild = this.left!;
    leftChild.parent = this.parent;

    if (leftChild.parent === undefined) {
      this.intervalTree.root = leftChild;
    } else {
      if (leftChild.parent.left === this) {
        leftChild.parent.left = leftChild;
      } else if (leftChild.parent.right === this) {
        leftChild.parent.right = leftChild;
      }
    }

    this.left = leftChild.right;
    if (this.left !== undefined) {
      this.left.parent = this;
    }
    leftChild.right = this;
    this.parent = leftChild;
    this.updateHeight();
    leftChild.updateHeight();
  }

  // Rebalances the tree if the height value between two nodes of the same parent is greater than
  // two. There are 4 cases that can happen which are outlined in the graphics above
  private _rebalance() {
    if (height(this.left) >= 2 + height(this.right)) {
      const left = this.left!;
      if (height(left.left) >= height(left.right)) {
        // Left-Left case
        this._rightRotate();
        this._updateMaxAfterRightRotate();
      } else {
        // Left-Right case
        left._leftRotate();
        this._rightRotate();
        this._updateMaxAfterRightRotate();
      }
    } else if (height(this.right) >= 2 + height(this.left)) {
      const right = this.right!;
      if (height(right.right) >= height(right.left)) {
        // Right-Right case
        this._leftRotate();
        this._updateMaxAfterLeftRotate();
      } else {
        // Right-Left case
        right._rightRotate();
        this._leftRotate();
        this._updateMaxAfterLeftRotate();
      }
    }
  }

  public insert(record: T) {
    if (record.low < this.key) {
      // Insert into left subtree
      if (this.left === undefined) {
        this.left = new Node(this.intervalTree, record);
        this.left.parent = this;
      } else {
        this.left.insert(record);
      }
    } else {
      // Insert into right subtree
      if (this.right === undefined) {
        this.right = new Node(this.intervalTree, record);
        this.right.parent = this;
      } else {
        this.right.insert(record);
      }
    }

    // Update the max value of this ancestor if needed
    if (this.max < record.high) {
      this.max = record.high;
    }

    // Update height of each node
    this.updateHeight();

    // Rebalance the tree to ensure all operations are executed in O(logn) time. This is especially
    // important in searching, as the tree has a high chance of degenerating without the rebalancing
    this._rebalance();
  }

  private _getOverlappingRecords(currentNode: Node<T, N>, low: N, high: N) {
    if (currentNode.key <= high && low <= currentNode.getNodeHigh()) {
      // Nodes are overlapping, check if individual records in the node are overlapping
      const tempResults: T[] = [];
      for (let i = 0; i < currentNode.records.length; i++) {
        if (currentNode.records[i].high >= low) {
          tempResults.push(currentNode.records[i]);
        }
      }
      return tempResults;
    }
    return [];
  }

  public search(low: N, high: N) {
    // Don't search nodes that don't exist
    if (this === undefined) {
      return [];
    }

    let leftSearch: T[] = [];
    let ownSearch: T[] = [];
    let rightSearch: T[] = [];

    // If interval is to the right of the rightmost point of any interval in this node and all its
    // children, there won't be any matches
    if (low > this.max) {
      return [];
    }

    // Search left children
    if (this.left !== undefined && this.left.max >= low) {
      leftSearch = this.left.search(low, high);
    }

    // Check this node
    ownSearch = this._getOverlappingRecords(this, low, high);

    // If interval is to the left of the start of this interval, then it can't be in any child to
    // the right
    if (high < this.key) {
      return leftSearch.concat(ownSearch);
    }

    // Otherwise, search right children
    if (this.right !== undefined) {
      rightSearch = this.right.search(low, high);
    }

    // Return accumulated results, if any
    return leftSearch.concat(ownSearch, rightSearch);
  }

  // Searches for a node by a `key` value
  public searchExisting(low: N): Node<T, N> | undefined {
    if (this === undefined) {
      return undefined;
    }

    if (this.key === low) {
      return this;
    } else if (low < this.key) {
      if (this.left !== undefined) {
        return this.left.searchExisting(low);
      }
    } else {
      if (this.right !== undefined) {
        return this.right.searchExisting(low);
      }
    }

    return undefined;
  }

  // Returns the smallest node of the subtree
  private _minValue(): Node<T, N> {
    if (this.left === undefined) {
      return this;
    } else {
      return this.left._minValue();
    }
  }

  public remove(node: Node<T, N>): Node<T, N> | undefined {
    const parent = this.parent!;

    if (node.key < this.key) {
      // Node to be removed is on the left side
      if (this.left !== undefined) {
        return this.left.remove(node);
      } else {
        return undefined;
      }
    } else if (node.key > this.key) {
      // Node to be removed is on the right side
      if (this.right !== undefined) {
        return this.right.remove(node);
      } else {
        return undefined;
      }
    } else {
      if (this.left !== undefined && this.right !== undefined) {
        // Node has two children
        const minValue = this.right._minValue();
        this.key = minValue.key;
        this.records = minValue.records;
        return this.right.remove(this);
      } else if (parent.left === this) {
        // One child or no child case on left side
        if (this.right !== undefined) {
          parent.left = this.right;
          this.right.parent = parent;
        } else {
          parent.left = this.left;
          if (this.left !== undefined) {
            this.left.parent = parent;
          }
        }
        parent.updateMaxOfParents();
        parent.updateHeight();
        parent._rebalance();
        return this;
      } else if (parent.right === this) {
        // One child or no child case on right side
        if (this.right !== undefined) {
          parent.right = this.right;
          this.right.parent = parent;
        } else {
          parent.right = this.left;
          if (this.left !== undefined) {
            this.left.parent = parent;
          }
        }
        parent.updateMaxOfParents();
        parent.updateHeight();
        parent._rebalance();
        return this;
      }
    }

    // Make linter happy
    return undefined;
  }
}

export class IntervalTree<T extends Interval<N>, N extends number | bigint = number> {
  public root?: Node<T, N>;
  public count = 0;

  public insert(record: T) {
    if (record.low > record.high) {
      throw new Error("`low` value must be lower or equal to `high` value");
    }

    if (this.root === undefined) {
      // Base case: Tree is empty, new node becomes root
      this.root = new Node(this, record);
      this.count++;
      return true;
    } else {
      // Otherwise, check if node already exists with the same key
      const node = this.root.searchExisting(record.low);
      if (node !== undefined) {
        // Check the records in this node if there already is the one with same low, high, data
        for (let i = 0; i < node.records.length; i++) {
          if (shallowEqual(node.records[i], record)) {
            // This record is same as the one we're trying to insert; return false to indicate
            // nothing has been inserted
            return false;
          }
        }

        // Add the record to the node
        node.records.push(record);

        // Update max of the node and its parents if necessary
        if (record.high > node.max) {
          node.max = record.high;
          if (node.parent) {
            node.parent.updateMaxOfParents();
          }
        }
        this.count++;
        return true;
      } else {
        // Node with this key doesn't already exist. Call insert function on root's node
        this.root.insert(record);
        this.count++;
        return true;
      }
    }
  }

  public search(low: N, high: N) {
    if (this.root === undefined) {
      // Tree is empty; return empty array
      return [];
    } else {
      return this.root.search(low, high);
    }
  }

  public remove(record: T) {
    if (this.root === undefined) {
      // Tree is empty; nothing to remove
      return false;
    } else {
      const node = this.root.searchExisting(record.low);
      if (node === undefined) {
        return false;
      } else if (node.records.length > 1) {
        let removedRecord: T | undefined;
        // Node with this key has 2 or more records. Find the one we need and remove it
        for (let i = 0; i < node.records.length; i++) {
          if (shallowEqual(node.records[i], record)) {
            removedRecord = node.records[i];
            node.records.splice(i, 1);
            break;
          }
        }

        if (removedRecord) {
          removedRecord = undefined;
          // Update max of that node and its parents if necessary
          if (record.high === node.max) {
            const nodeHigh = node.getNodeHigh();
            if (node.left !== undefined && node.right !== undefined) {
              node.max = max(max(node.left.max, node.right.max), nodeHigh);
            } else if (node.left !== undefined && node.right === undefined) {
              node.max = max(node.left.max, nodeHigh);
            } else if (node.left === undefined && node.right !== undefined) {
              node.max = max(node.right.max, nodeHigh);
            } else {
              node.max = nodeHigh;
            }
            if (node.parent) {
              node.parent.updateMaxOfParents();
            }
          }
          this.count--;
          return true;
        } else {
          return false;
        }
      } else if (node.records.length === 1) {
        // Node with this key has only 1 record. Check if the remaining record in this node is
        // actually the one we want to remove
        if (shallowEqual(node.records[0], record)) {
          // The remaining record is the one we want to remove. Remove the whole node from the tree
          if (this.root.key === node.key) {
            // We're removing the root element. Create a dummy node that will temporarily take
            // root's parent role
            const rootParent = new Node<T, N>(this, { low: record.low, high: record.low } as T);
            rootParent.left = this.root;
            this.root.parent = rootParent;
            let removedNode = this.root.remove(node);
            this.root = rootParent.left;
            if (this.root !== undefined) {
              this.root.parent = undefined;
            }
            if (removedNode) {
              removedNode = undefined;
              this.count--;
              return true;
            } else {
              return false;
            }
          } else {
            let removedNode = this.root.remove(node);
            if (removedNode) {
              removedNode = undefined;
              this.count--;
              return true;
            } else {
              return false;
            }
          }
        } else {
          // The remaining record is not the one we want to remove
          return false;
        }
      } else {
        // No records at all in this node?! Shouldn't happen
        return false;
      }
    }
  }

  public inOrder() {
    return new InOrder(this.root);
  }

  public reverseInOrder() {
    return new ReverseInOrder(this.root);
  }

  public preOrder() {
    return new PreOrder(this.root);
  }
}

export interface DataInterval<T, N extends number | bigint = number> extends Interval<N> {
  data: T;
}

/**
 * The default export just wraps the `IntervalTree`, while providing a simpler API. Check out the
 * README for description on how to use each.
 */
export default class DataIntervalTree<T, N extends number | bigint = number> {
  private tree = new IntervalTree<DataInterval<T, N>, N>();

  public insert(low: N, high: N, data: T) {
    return this.tree.insert({ low, high, data });
  }

  public remove(low: N, high: N, data: T) {
    return this.tree.remove({ low, high, data });
  }

  public search(low: N, high: N) {
    return this.tree.search(low, high).map(v => v.data);
  }

  public inOrder() {
    return this.tree.inOrder();
  }

  public reverseInOrder() {
    return this.tree.reverseInOrder();
  }

  public preOrder() {
    return this.tree.preOrder();
  }

  get count() {
    return this.tree.count;
  }
}

export class InOrder<T extends Interval<N>, N extends number | bigint = number>
  implements IterableIterator<T>
{
  private stack: Node<T, N>[] = [];

  private currentNode?: Node<T, N>;
  private i: number;

  constructor(startNode?: Node<T, N>) {
    if (startNode !== undefined) {
      this.push(startNode);
    }
  }

  [Symbol.iterator]() {
    return this;
  }

  public next(): IteratorResult<T> {
    // Will only happen if stack is empty and pop is called
    if (this.currentNode === undefined) {
      return {
        done: true,
        value: undefined,
      } as any as IteratorResult<T>;
    }

    // Process this node
    if (this.i < this.currentNode.records.length) {
      return {
        done: false,
        value: this.currentNode.records[this.i++],
      };
    }

    if (this.currentNode.right !== undefined) {
      // Can we go right?
      this.push(this.currentNode.right);
    } else {
      // Otherwise go up
      // Might pop the last and set this.currentNode = undefined
      this.pop();
    }
    return this.next();
  }

  private push(node: Node<T, N>) {
    this.currentNode = node;
    this.i = 0;

    while (this.currentNode.left !== undefined) {
      this.stack.push(this.currentNode);
      this.currentNode = this.currentNode.left;
    }
  }

  private pop() {
    this.currentNode = this.stack.pop();
    this.i = 0;
  }
}

export class ReverseInOrder<T extends Interval<N>, N extends number | bigint = number>
  implements IterableIterator<T>
{
  private stack: Node<T, N>[] = [];

  private currentNode?: Node<T, N>;
  private i: number;

  constructor(startNode?: Node<T, N>) {
    if (startNode !== undefined) {
      this.push(startNode);
    }
  }

  [Symbol.iterator]() {
    return this;
  }

  public next(): IteratorResult<T> {
    // Will only happen if stack is empty and pop is called
    if (this.currentNode === undefined) {
      return {
        done: true,
        value: undefined,
      } as any as IteratorResult<T>;
    }

    // Process this node
    if (this.currentNode.records.length && this.i >= 0) {
      return {
        done: false,
        value: this.currentNode.records[this.i--],
      };
    }

    if (this.currentNode.left !== undefined) {
      // Can we go left?
      this.push(this.currentNode.left);
    } else {
      // Otherwise go up
      // Might pop the last and set this.currentNode = undefined
      this.pop();
    }
    return this.next();
  }

  private push(node: Node<T, N>) {
    this.currentNode = node;
    this.i = (this.currentNode?.records.length ?? 0) - 1;

    while (this.currentNode.right !== undefined) {
      this.stack.push(this.currentNode);
      this.currentNode = this.currentNode.right;
      this.i = (this.currentNode?.records.length ?? 0) - 1;
    }
  }

  private pop() {
    this.currentNode = this.stack.pop();
    this.i = (this.currentNode?.records.length ?? 0) - 1;
  }
}

export class PreOrder<T extends Interval<N>, N extends number | bigint = number>
  implements IterableIterator<T>
{
  private stack: Node<T, N>[] = [];

  private currentNode?: Node<T, N>;
  private i = 0;

  constructor(startNode?: Node<T, N>) {
    this.currentNode = startNode;
  }

  [Symbol.iterator]() {
    return this;
  }

  public next(): IteratorResult<T> {
    // Will only happen if stack is empty and pop is called,
    // which only happens if there is no right node (i.e we are done)
    if (this.currentNode === undefined) {
      return {
        done: true,
        value: undefined,
      } as any as IteratorResult<T>;
    }

    // Process this node
    if (this.i < this.currentNode.records.length) {
      return {
        done: false,
        value: this.currentNode.records[this.i++],
      };
    }

    if (this.currentNode.right !== undefined) {
      this.push(this.currentNode.right);
    }
    if (this.currentNode.left !== undefined) {
      this.push(this.currentNode.left);
    }
    this.pop();
    return this.next();
  }

  private push(node: Node<T, N>) {
    this.stack.push(node);
  }

  private pop() {
    this.currentNode = this.stack.pop();
    this.i = 0;
  }
}
