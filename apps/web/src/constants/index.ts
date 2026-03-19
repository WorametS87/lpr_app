export const API_ENDPOINTS = {
  INFER_IMAGE: '/v1/infer/image'
} as const;

export const OCR_STRATEGY_LABEL: Record<string, string> = {
  top70: 'top 70% - strict valid (fastest)',
  full: 'full plate - strict valid',
  top70_retry: 'top 70% rotation retry - strict valid',
  full_retry: 'full plate rotation retry - strict valid',
  top70_fallback: 'top 70% - soft fallback',
  full_fallback: 'full plate - soft fallback',
  top70_retry_fallback: 'top 70% rotation retry - soft fallback',
  full_retry_fallback: 'full plate rotation retry - soft fallback',
  none: 'no valid text found'
};
