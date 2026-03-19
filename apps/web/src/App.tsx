import { CssBaseline, ThemeProvider } from '@mui/material';
import AppRouter from './router';
import theme from './theme';

function App(): JSX.Element {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;
