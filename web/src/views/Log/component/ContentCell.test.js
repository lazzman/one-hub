/* eslint-env node */
const test = require('node:test');
const assert = require('node:assert/strict');

require('sucrase/register');

const { handleContentCellOpen } = require('./ContentCell.jsx');

test('ContentCell stops propagation and forwards content to the global drawer trigger', () => {
  const calls = [];
  const event = {
    stopped: false,
    stopPropagation() {
      this.stopped = true;
    }
  };

  handleContentCellOpen(
    event,
    (content) => {
      calls.push(content);
    },
    'request payload'
  );

  assert.equal(event.stopped, true);
  assert.deepEqual(calls, ['request payload']);
});

test('ContentCell tolerates missing event and missing callback', () => {
  assert.doesNotThrow(() => handleContentCellOpen(null, null, 'request payload'));
});
