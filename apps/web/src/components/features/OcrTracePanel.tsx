import { Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import type { OcrToken, OcrTraceStep, PlateDebug, TraceRecord } from '@lpr/shared-types';
import DebugImage from '../common/DebugImage';

type OcrTracePanelProps = {
  plate: PlateDebug;
};

function pickTextField(record: TraceRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function pickNumberField(record: TraceRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function formatPickResult(pickResult: TraceRecord | null): string | null {
  if (!pickResult) {
    return null;
  }

  const text = pickTextField(pickResult, ['text', 'plate', 'candidate', 'value', 'result']);
  const confidence = pickNumberField(pickResult, ['conf', 'confidence', 'score']);

  if (text && confidence !== null) {
    return `${text} (${(confidence * 100).toFixed(1)}%)`;
  }

  if (text) {
    return text;
  }

  const compact = JSON.stringify(pickResult);
  if (!compact) {
    return null;
  }

  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function readTokens(step: OcrTraceStep): OcrToken[] {
  return step.ocrTokens ?? step.ocr_tokens ?? [];
}

function readPickResult(step: OcrTraceStep): TraceRecord | null {
  return step.pickResult ?? step.pick_result ?? null;
}

function readIsSoft(step: OcrTraceStep): boolean {
  return step.isSoft ?? step.is_soft ?? false;
}

function readEarlyExit(step: OcrTraceStep): boolean {
  return step.earlyExit ?? step.early_exit ?? false;
}

function readImage(step: OcrTraceStep): string | null {
  return step.imageB64 ?? step.image_b64 ?? null;
}

function readTraceSteps(plate: PlateDebug): OcrTraceStep[] {
  return plate.ocrTrace ?? plate.ocr_trace ?? [];
}

function formatTraceValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, '') : String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    const compact = JSON.stringify(value);
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  }

  if (typeof value === 'object') {
    const compact = JSON.stringify(value);
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  }

  return String(value);
}

function renderRecordTable(records: TraceRecord[], label: string): JSX.Element | null {
  if (records.length === 0) {
    return null;
  }

  const keySet = new Set<string>();
  records.forEach((record) => {
    Object.keys(record).forEach((key) => keySet.add(key));
  });

  const preferredOrder = ['text', 'normalized', 'candidate', 'plate', 'raw', 'conf', 'confidence', 'score'];
  const allKeys = Array.from(keySet);
  const orderedKeys = [
    ...preferredOrder.filter((key) => keySet.has(key)),
    ...allKeys.filter((key) => !preferredOrder.includes(key)).sort()
  ];

  return (
    <Box mt={0.75}>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
        {label}
      </Typography>
      <Table size="small">
        <TableBody>
          <TableRow>
            <TableCell sx={{ color: 'text.secondary', width: 40 }}>#</TableCell>
            {orderedKeys.map((key) => (
              <TableCell key={key} sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {key}
              </TableCell>
            ))}
          </TableRow>
          {records.map((record, rowIndex) => (
            <TableRow key={rowIndex}>
              <TableCell sx={{ color: 'text.secondary' }}>{rowIndex + 1}</TableCell>
              {orderedKeys.map((key) => (
                <TableCell key={`${rowIndex}-${key}`} sx={{ fontFamily: key.includes('text') ? 'monospace' : undefined }}>
                  {formatTraceValue(record[key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function OcrTracePanel({ plate }: OcrTracePanelProps): JSX.Element {
  const traceSteps = readTraceSteps(plate);

  return (
    <Box mt={1}>
      <Typography variant="caption" fontWeight={600} display="block" mb={0.5}>
        Step 3.5 - OCR Trace (per-stage)
      </Typography>

      {traceSteps.length === 0 ? (
        <Alert severity="info">No OCR trace returned by model for this detection.</Alert>
      ) : (
        <Stack spacing={1}>
          {traceSteps.map((step, stepIndex) => {
            const tokens = readTokens(step);
            const pickResult = readPickResult(step);
            const pickSummary = formatPickResult(pickResult);
            const isSoft = readIsSoft(step);
            const earlyExit = readEarlyExit(step);
            const image = readImage(step);
            const candidates = step.candidates ?? [];
            const expanded = step.expanded ?? [];

            return (
              <Box
                key={`${step.stage}-${stepIndex}`}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`Stage: ${step.stage}`} />
                  <Chip size="small" label={`OCR tokens: ${tokens.length}`} />
                  <Chip size="small" label={`Candidates: ${candidates.length}`} />
                  <Chip size="small" label={`Expanded: ${expanded.length}`} />
                  <Chip
                    size="small"
                    label={isSoft ? 'Soft fallback' : 'Strict path'}
                    color={isSoft ? 'warning' : 'default'}
                    variant="outlined"
                  />
                  {earlyExit ? <Chip size="small" label="Early exit" color="success" /> : null}
                </Stack>

                {step.note ? (
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
                    Note: {step.note}
                  </Typography>
                ) : null}

                {pickSummary ? (
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
                    Pick result: {pickSummary}
                  </Typography>
                ) : null}

                {tokens.length > 0 ? (
                  <Table size="small" sx={{ mt: 0.75 }}>
                    <TableBody>
                      {tokens.map((token, tokenIndex) => (
                        <TableRow key={tokenIndex}>
                          <TableCell sx={{ color: 'text.secondary', width: 40 }}>{tokenIndex + 1}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{token.text}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {(token.conf * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
                {renderRecordTable(candidates, 'Candidates detail')}
                {renderRecordTable(expanded, 'Expanded detail')}

                {image ? (
                  <Box mt={0.75}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      Trace image
                    </Typography>
                    <DebugImage src={image} alt={`ocr-trace-${step.stage}`} />
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

export default OcrTracePanel;
