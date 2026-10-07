'use strict';

// Iterative inspection precedes recursive walkers, including deep-import APIs.
// Only follow `nodes`; upstream ASTs intentionally contain parent/prev links.
module.exports = ast => {
  const stack = [[ast, 0]];
  const seen = new WeakSet();
  let count = 0;
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (!node || typeof node !== 'object') throw new TypeError('Expected a braces AST node');
    if (depth > 64 || ++count > 65536 || seen.has(node)) {
      throw new RangeError('braces safety limit: excessive depth, nodes or cyclic AST');
    }
    seen.add(node);
    if (node.nodes !== undefined) {
      if (!Array.isArray(node.nodes)) throw new TypeError('Expected AST nodes to be an array');
      if (stack.length + node.nodes.length + count > 65536) throw new RangeError('braces safety limit: nodes');
      for (const child of node.nodes) stack.push([child, depth + 1]);
    }
  }
};
