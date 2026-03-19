import type { DebugInfo, DetectionResult } from '@lpr/shared-types';

export type ResultDialogState = {
  open: boolean;
  title: string;
  detections: DetectionResult[];
  message: string;
  debugInfo: DebugInfo | null;
};

export const initialResultDialogState: ResultDialogState = {
  open: false,
  title: 'Detection Result',
  detections: [],
  message: '',
  debugInfo: null
};
