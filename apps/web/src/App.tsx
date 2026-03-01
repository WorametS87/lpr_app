import { useMemo, useState, type SyntheticEvent } from 'react';
import axios from 'axios';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { DebugInfo, DetectionResult, InferenceResponse } from '@lpr/shared-types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type ResultDialogState = {
  open: boolean;
  title: string;
  detections: DetectionResult[];
  message: string;
  debugInfo: DebugInfo | null;
};

// ---------------------------------------------------------------------------
// OCR strategy path label
// ---------------------------------------------------------------------------
const OCR_STRATEGY_LABEL: Record<string, string> = {
  top70:                '✓ top 70% — strict valid (fastest)',
  full:                 '✓ full plate — strict valid',
  top70_retry:          '↻ top 70% rotation retry — strict valid',
  full_retry:           '↻ full plate rotation retry — strict valid',
  top70_fallback:       '~ top 70% — soft fallback',
  full_fallback:        '~ full plate — soft fallback',
  top70_retry_fallback: '~ top 70% rotation retry — soft fallback',
  full_retry_fallback:  '~ full plate rotation retry — soft fallback',
  none:                 '✗ no valid text found',
};

function DebugImage({
  src,
  alt
}: {
  src: string;
  alt: string;
}): JSX.Element {
  const [resolution, setResolution] = useState<string | null>(null);

  return (
    <>
      <Box
        component="img"
        src={src}
        alt={alt}
        onLoad={(event: SyntheticEvent<HTMLImageElement>) => {
          const image = event.currentTarget;
          setResolution(`${image.naturalWidth} x ${image.naturalHeight}`);
        }}
        sx={{ width: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
      />
      {resolution ? (
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {resolution}
        </Typography>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Debug panel shown inside the result dialog
// ---------------------------------------------------------------------------
function DebugPanel({
  debugInfo,
  detections
}: {
  debugInfo: DebugInfo;
  detections: DetectionResult[];
}) {
  const { timings, annotatedImage, plates } = debugInfo;
  const plateByDetectionIndex = new Map(
    plates.map((plate, index) => [plate.detectionIndex ?? index, plate] as const)
  );
  const hasDebugCrops = Boolean(annotatedImage) || plates.length > 0;

  return (
    <Box mt={2}>
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight={600}>
            Debug Info
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>

            {/* Timings */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                TIMINGS
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={`Resize: ${timings.resize_ms} ms`} />
                <Chip size="small" label={`Inference: ${timings.inference_ms} ms`} color="primary" />
                <Chip size="small" label={`Total: ${timings.total_ms} ms`} color="secondary" />
              </Stack>
            </Box>

            <Divider />

            {/* Annotated full frame */}
            {hasDebugCrops ? (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                  ANNOTATED FRAME
                </Typography>
                {annotatedImage ? (
                  <DebugImage src={annotatedImage} alt="annotated" />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No annotated frame returned.
                  </Typography>
                )}
              </Box>
            ) : (
              <Alert severity="info">
                Detailed debug images are disabled on model server.
                Start model with <strong>LPR_DEBUG_MODE=1</strong>.
              </Alert>
            )}

            {/* Per-detection debug (anchored by detection index) */}
            {detections.map((detection, detectionIndex) => {
              const plate = plateByDetectionIndex.get(detectionIndex);
              if (!plate) return null;

              return (
                <Box key={`det-${detectionIndex}`}>
                  <Divider />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={1} mb={1}>
                    DETECTION {detectionIndex + 1} — FINAL OUTPUT
                  </Typography>
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', width: 180 }}>Plate number</TableCell>
                        <TableCell>{detection.plateNumber ?? '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Province</TableCell>
                        <TableCell>{detection.province ?? '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Plate source</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={plate.ocrRegionUsed}
                            variant="outlined"
                            color={plate.ocrRegionUsed === 'none' ? 'error' : plate.ocrRegionUsed.includes('fallback') ? 'warning' : 'success'}
                          />
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
                            {OCR_STRATEGY_LABEL[plate.ocrRegionUsed] ?? plate.ocrRegionUsed}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Province source</TableCell>
                        <TableCell>
                          {plate.provinceSource === 'bottom_ocr'
                            ? 'Bottom OCR override'
                            : plate.provinceSource === 'classifier'
                              ? 'ResNet18 classifier'
                              : 'None (hidden by confidence rules)'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>OCR confidence</TableCell>
                        <TableCell>{(detection.ocrConf * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Province confidence</TableCell>
                        <TableCell>{(detection.provinceConf * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <Divider />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={1} mb={1}>
                    DETECTION {detectionIndex + 1} — FULL PROCESS
                  </Typography>

                  {/* --- Step 1: Detection --- */}
                  <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                    Step 1 · YOLOX Detection
                  </Typography>
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', width: 180 }}>Detection confidence</TableCell>
                        <TableCell>{(plate.detectionConf * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary' }}>Red plate</TableCell>
                        <TableCell>{plate.isRedPlate ? 'Yes — province classification skipped' : 'No'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {/* --- Step 2: Pipeline stage images --- */}
                  <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                    Step 2 · Preprocessing Pipeline (5 stages)
                  </Typography>
                  <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
                    {([
                      { key: 'plateCrop',             label: '① Raw crop' },
                      { key: 'plateCropDewarped',     label: '② Dewarped' },
                      { key: 'plateCropTop70',        label: '③ Top 70% (number)' },
                      { key: 'plateCropPreprocessed', label: '④ CLAHE + sharpen' },
                      { key: 'plateCropBottom',       label: '⑤ Bottom 30% (province)' },
                    ] as { key: keyof typeof plate; label: string }[]).map(({ key, label }) =>
                      plate[key] ? (
                        <Box key={key} flex="1 1 40%" minWidth={0}>
                          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                            {label}
                          </Typography>
                          <DebugImage src={plate[key] as string} alt={label} />
                        </Box>
                      ) : null
                    )}
                  </Stack>

                  {/* --- Step 3: OCR --- */}
                  <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                    Step 3 · OCR (Plate Number)
                  </Typography>
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', width: 180 }}>Strategy used</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={plate.ocrRegionUsed}
                            variant="outlined"
                            color={plate.ocrRegionUsed === 'none' ? 'error' : plate.ocrRegionUsed.includes('fallback') ? 'warning' : 'success'}
                          />
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
                            {OCR_STRATEGY_LABEL[plate.ocrRegionUsed] ?? plate.ocrRegionUsed}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  {plate.ocrRawTokens.length > 0 && (
                    <Box mb={1}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        Raw OCR tokens from top 70%:
                      </Typography>
                      <Table size="small">
                        <TableBody>
                          {plate.ocrRawTokens.map((tok, j) => (
                            <TableRow key={j}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{tok.text}</TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>{(tok.conf * 100).toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}

                  {/* --- Step 4: Province --- */}
                  {!plate.isRedPlate && (
                    <>
                      <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>
                        Step 4 · Province Detection
                      </Typography>
                      <Table size="small" sx={{ mb: 1 }}>
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ color: 'text.secondary', width: 180 }}>Source</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={plate.provinceSource === 'bottom_ocr' ? 'Bottom OCR (overrode classifier)' : 'ResNet18 classifier'}
                                color={plate.provinceSource === 'bottom_ocr' ? 'warning' : 'default'}
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                          {plate.bottomOcrProvince && (
                            <TableRow>
                              <TableCell sx={{ color: 'text.secondary' }}>Bottom OCR read</TableCell>
                              <TableCell>
                                {plate.bottomOcrProvince}
                                <Typography variant="caption" color="text.secondary" ml={1}>
                                  ({(plate.bottomOcrScore * 100).toFixed(1)}% match)
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </Box>
              );
            })}

          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<ResultDialogState>({
    open: false,
    title: 'Detection Result',
    detections: [],
    message: '',
    debugInfo: null
  });

  const selectedFileLabel = useMemo(
    () => selectedFile?.name ?? 'No file selected',
    [selectedFile]
  );

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile]
  );

  const onDropFile = (file: File): void => {
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const onAnalyze = async (): Promise<void> => {
    if (!selectedFile) {
      setErrorMessage('Please choose an image file before analyzing.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await axios.post<InferenceResponse>(
        `${apiBaseUrl}/v1/infer/image`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const hasDetection = response.data.detections.length > 0;
      setDialogState({
        open: true,
        title: hasDetection ? 'Detection Result' : 'No plate detected',
        detections: response.data.detections,
        message: response.data.message,
        debugInfo: response.data.debugInfo ?? null
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string | string[] })?.message;
        setErrorMessage(
          Array.isArray(message) ? message.join(', ') : (message ?? 'Failed to analyze image.')
        );
      } else {
        setErrorMessage('Failed to analyze image.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Thai License Plate Detection
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload a CCTV-captured image and run synchronous inference.
          </Typography>
        </Box>

        <Paper
          elevation={0}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) onDropFile(file);
          }}
          sx={{
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 5,
            textAlign: 'center',
            backgroundColor: isDragging ? 'rgba(30, 58, 138, 0.05)' : 'white'
          }}
        >
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6">Drag and drop image here</Typography>
            <Typography variant="body2" color="text.secondary">
              JPG, JPEG, PNG, WEBP (max 5MB)
            </Typography>
            <Button variant="outlined" component="label">
              Browse file
              <input
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onDropFile(file);
                }}
              />
            </Button>
            {previewUrl ? (
              <Box sx={{ width: '100%', maxWidth: 480 }}>
                <Box
                  component="img"
                  src={previewUrl}
                  alt="preview"
                  sx={{
                    width: '100%',
                    maxHeight: 280,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                />
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  {selectedFileLabel}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {selectedFileLabel}
              </Typography>
            )}
          </Stack>
        </Paper>

        <Box display="flex" gap={2} alignItems="center">
          <Button
            variant="contained"
            onClick={() => void onAnalyze()}
            disabled={isAnalyzing}
          >
            Analyze
          </Button>
          {isAnalyzing ? <CircularProgress size={24} /> : null}
        </Box>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      </Stack>

      {/* Result dialog */}
      <Dialog
        open={dialogState.open}
        onClose={() => setDialogState((s) => ({ ...s, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{dialogState.title}</DialogTitle>
        <DialogContent dividers>
          {dialogState.detections.length > 0 ? (
            <Stack spacing={1.5}>
              {(() => {
                const recognizedCount = dialogState.detections.filter(
                  (detection) => detection.plateNumber !== null
                ).length;
                return (
                  <Typography variant="subtitle2">
                    Candidates: {dialogState.detections.length} | Recognized plates: {recognizedCount}
                  </Typography>
                );
              })()}
              {dialogState.detections.map((detection, index) => (
                <Box key={index}>
                  {index > 0 ? <Divider sx={{ mb: 1.5 }} /> : null}
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Detection {index + 1}
                  </Typography>
                  <Typography><strong>Plate:</strong> {detection.plateNumber ?? '-'}</Typography>
                  <Typography><strong>Province:</strong> {detection.province ?? '-'}</Typography>
                  <Typography><strong>OCR Confidence:</strong> {detection.ocrConf.toFixed(2)}</Typography>
                  <Typography><strong>Province Confidence:</strong> {detection.provinceConf.toFixed(2)}</Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Alert severity="warning">No plate detected</Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {dialogState.message}
          </Typography>

          {dialogState.debugInfo && (
            <DebugPanel
              debugInfo={dialogState.debugInfo}
              detections={dialogState.detections}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogState((s) => ({ ...s, open: false }))}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default App;
