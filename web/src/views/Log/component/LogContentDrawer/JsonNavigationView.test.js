/* eslint-env node */
const test = require('node:test');
const assert = require('node:assert/strict');

require('sucrase/register');

const { buildSearchModel, buildDeferredSearchState, buildTreeNode, filterTreeNode } = require('./JsonNavigationView.jsx');

test('JsonNavigationView keeps the input value intact while normalizing the deferred filter query', () => {
  const searchModel = buildSearchModel('  Metadata.Attempts[1]  ');

  assert.equal(searchModel.inputValue, '  Metadata.Attempts[1]  ');
  assert.equal(searchModel.filterQuery, 'metadata.attempts[1]');
});

test('JsonNavigationView keeps matching descendants after deferred filtering', () => {
  const tree = buildTreeNode({
    metadata: {
      attempts: [1, 2]
    }
  });
  const filteredTree = filterTreeNode(tree, buildSearchModel('  attempts[1] ').filterQuery);

  assert.ok(filteredTree);
  assert.equal(filteredTree.children.length, 1);
  assert.equal(filteredTree.children[0].path, '$.metadata');
  assert.equal(filteredTree.children[0].children[0].path, '$.metadata.attempts');
  assert.equal(filteredTree.children[0].children[0].children[0].path, '$.metadata.attempts[1]');
});

test('JsonNavigationView clears the deferred filter query when the input is cleared', () => {
  const searchModel = buildSearchModel('');

  assert.equal(searchModel.inputValue, '');
  assert.equal(searchModel.filterQuery, '');
});

test('JsonNavigationView keeps input updates synchronous while filtering can stay deferred', () => {
  const deferredState = buildDeferredSearchState('metadata.attempts', 'metadata');

  assert.equal(deferredState.inputValue, 'metadata.attempts');
  assert.equal(deferredState.filterQuery, 'metadata');
});
