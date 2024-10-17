export const resolveProviderName = (source = {}) => {
  if (typeof source.provider === 'string' && source.provider.trim()) {
    return source.provider.trim();
  }
  return 'unknown';
};

export const resolveProtocolName = (source = {}) => {
  if (typeof source.protocol_hint === 'string' && source.protocol_hint.trim()) {
    return source.protocol_hint.trim();
  }
  return 'unknown';
};
