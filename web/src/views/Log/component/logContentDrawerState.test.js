/* eslint-env node */
const test = require('node:test');
const assert = require('node:assert/strict');

require('sucrase/register');

const {
  createInitialLogDrawerState,
  openLogDrawerState,
  closeLogDrawerState,
  unmountLogDrawerState
} = require('./logContentDrawerState.js');

test('log drawer state starts unmounted and closed', () => {
  assert.deepEqual(createInitialLogDrawerState(), {
    mounted: false,
    open: false,
    content: null,
    version: 0
  });
});

test('opening the log drawer mounts it, normalizes empty content, and bumps the version', () => {
  const initialState = createInitialLogDrawerState();
  const firstOpenState = openLogDrawerState(initialState, 'request payload');
  const secondOpenState = openLogDrawerState(firstOpenState, null);

  assert.deepEqual(firstOpenState, {
    mounted: true,
    open: true,
    content: 'request payload',
    version: 1
  });
  assert.deepEqual(secondOpenState, {
    mounted: true,
    open: true,
    content: '',
    version: 2
  });
});

test('closing keeps the drawer mounted for the exit transition and unmount clears retained content', () => {
  const openedState = openLogDrawerState(createInitialLogDrawerState(), 'request payload');
  const closingState = closeLogDrawerState(openedState);
  const unmountedState = unmountLogDrawerState(closingState);

  assert.deepEqual(closingState, {
    mounted: true,
    open: false,
    content: 'request payload',
    version: 1
  });
  assert.deepEqual(unmountedState, {
    mounted: false,
    open: false,
    content: null,
    version: 1
  });
});
