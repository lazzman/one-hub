/**
 * Responses Trace 类型定义
 */

/**
 * 轨迹状态枚举
 */
export const TraceStatus = Object.freeze({
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  MISSING_RESULT: 'missing_result',
  ORPHAN_RESULT: 'orphan_result',
  IN_PROGRESS: 'in_progress'
});

/**
 * TraceNode 字段清单（用于统一约束）
 */
export const TRACE_NODE_FIELDS = Object.freeze([
  'callId',
  'toolName',
  'status',
  'attempts',
  'eventCount',
  'args',
  'result',
  'startedAt',
  'completedAt',
  'errors',
  'sourceEvents'
]);

/**
 * Diagnostics 字段清单（用于统一约束）
 */
export const DIAGNOSTICS_FIELDS = Object.freeze([
  'rawEvents',
  'rawCalls',
  'uniqueCalls',
  'completedResults',
  'unmatchedCalls',
  'orphanResults'
]);

/**
 * LinearTrace 字段清单（用于统一约束）
 */
export const LINEAR_TRACE_FIELDS = Object.freeze(['kind', 'callId', 'toolName', 'timestamp', 'order', 'payload']);

/**
 * @typedef {Object} TraceNode
 * @property {string} callId
 * @property {string} toolName
 * @property {'completed'|'failed'|'cancelled'|'missing_result'|'orphan_result'|'in_progress'} status
 * @property {number} attempts
 * @property {number} eventCount
 * @property {any} args
 * @property {any} result
 * @property {string|number|null} startedAt
 * @property {string|number|null} completedAt
 * @property {Array<string>} errors
 * @property {Array<any>} sourceEvents
 */

/**
 * @typedef {Object} Diagnostics
 * @property {number} rawEvents
 * @property {number} rawCalls
 * @property {number} uniqueCalls
 * @property {number} completedResults
 * @property {number} unmatchedCalls
 * @property {number} orphanResults
 */

/**
 * @typedef {Object} LinearTraceEntry
 * @property {'tool_call'|'tool_result'|'reasoning'} kind
 * @property {string} callId
 * @property {string} toolName
 * @property {string|number|null} timestamp
 * @property {number} order
 * @property {any} payload
 */
