'use client';

import ThemeProvider from '@lobehub/ui/es/ThemeProvider/index';

import ErrorCapture from '.';

import type { ErrorType } from '.';

interface RouteErrorBoundaryProps {
  error: ErrorType;
  resetPath: string;
}

const RouteErrorBoundary = ({ error, resetPath }: RouteErrorBoundaryProps) => (
  <ThemeProvider theme={{ cssVar: { key: 'lobe-vars' } }}>
    <ErrorCapture error={error} resetPath={resetPath} />
  </ThemeProvider>
);

export default RouteErrorBoundary;
