import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from '@mui/material';
import type { ResultDialogState } from '../../types/inference';
import DebugPanel from './DebugPanel';

type ResultDialogProps = {
  state: ResultDialogState;
  onClose: () => void;
};

function ResultDialog({ state, onClose }: ResultDialogProps): JSX.Element {
  return (
    <Dialog open={state.open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{state.title}</DialogTitle>
      <DialogContent dividers>
        {state.detections.length > 0 ? (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">
              Candidates: {state.detections.length} | Recognized plates:{' '}
              {state.detections.filter((detection) => detection.plateNumber !== null).length}
            </Typography>
            {state.detections.map((detection, index) => (
              <Box key={index}>
                {index > 0 ? <Divider sx={{ mb: 1.5 }} /> : null}
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Detection {index + 1}
                </Typography>
                <Typography>
                  <strong>Plate:</strong> {detection.plateNumber ?? '-'}
                </Typography>
                <Typography>
                  <strong>Province:</strong> {detection.province ?? '-'}
                </Typography>
                <Typography>
                  <strong>OCR Confidence:</strong> {detection.ocrConf.toFixed(2)}
                </Typography>
                <Typography>
                  <strong>Province Confidence:</strong> {detection.provinceConf.toFixed(2)}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Alert severity="warning">No plate detected</Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {state.message}
        </Typography>

        {state.debugInfo ? (
          <DebugPanel debugInfo={state.debugInfo} detections={state.detections} />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ResultDialog;
