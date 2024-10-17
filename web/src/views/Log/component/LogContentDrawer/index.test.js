/* eslint-env node */
const test = require('node:test');
const assert = require('node:assert/strict');

require('sucrase/register');

const {
  getInitialActiveSectionId,
  updateIntersectingSections,
  getTopVisibleSectionId,
  shouldResetDrawerPositionOnOpen,
  resolveActiveSectionOnIntersect
} = require('./index.jsx');

test('LogContentDrawer picks the first section as the initial active target', () => {
  const sectionId = getInitialActiveSectionId([{ id: 'overview' }, { id: 'request' }, { id: 'response' }]);

  assert.equal(sectionId, 'overview');
});

test('LogContentDrawer keeps the top-most visible section active when multiple entries intersect', () => {
  const visibleSections = updateIntersectingSections(new Map(), [
    {
      target: { id: 'request-raw' },
      isIntersecting: true,
      boundingClientRect: { top: 240 }
    },
    {
      target: { id: 'overview' },
      isIntersecting: true,
      boundingClientRect: { top: 0 }
    }
  ]);

  assert.equal(getTopVisibleSectionId(visibleSections, 'overview'), 'overview');
});

test('LogContentDrawer drops sections that are no longer intersecting', () => {
  const visibleSections = updateIntersectingSections(
    new Map([
      ['overview', 0],
      ['request-raw', 240]
    ]),
    [
      {
        target: { id: 'overview' },
        isIntersecting: false,
        boundingClientRect: { top: -40 }
      }
    ]
  );

  assert.equal(getTopVisibleSectionId(visibleSections, 'overview'), 'request-raw');
});

test('LogContentDrawer resets the initial position only when the drawer transitions from closed to open', () => {
  assert.equal(shouldResetDrawerPositionOnOpen(true, false), true);
  assert.equal(shouldResetDrawerPositionOnOpen(true, true), false);
  assert.equal(shouldResetDrawerPositionOnOpen(false, true), false);
});

test('LogContentDrawer ignores request-raw during the opening reset window', () => {
  const visibleSections = new Map([
    ['overview', 0],
    ['request-raw', -24]
  ]);

  assert.equal(resolveActiveSectionOnIntersect(visibleSections, 'overview', true), 'overview');
  assert.equal(resolveActiveSectionOnIntersect(visibleSections, 'overview', false), 'request-raw');
});
