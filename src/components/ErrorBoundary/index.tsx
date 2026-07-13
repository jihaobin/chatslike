'use client';

import { Component, lazy, memo, Suspense, useCallback } from 'react';
import type { ComponentType, ErrorInfo, ReactNode } from 'react';

import SilentFallback from './SilentFallback';

export type ErrorBoundaryVariant = 'alert' | 'silent';

interface FallbackRenderProps {
  error: unknown;
  resetErrorBoundary: (...args: unknown[]) => void;
}

interface LocalErrorBoundaryProps {
  children: ReactNode;
  fallbackRender: (props: FallbackRenderProps) => ReactNode;
  onError?: (error: unknown, info: { componentStack?: string | null }) => void;
  resetKeys?: unknown[];
}

interface LocalErrorBoundaryState {
  error: Error | undefined;
  hasError: boolean;
}

interface SafeBoundaryProps {
  alertTitle?: string;
  children: ReactNode;
  minHeight?: number;
  onError?: (error: unknown, info: { componentStack?: string | null }) => void;
  resetKeys?: unknown[];
  variant?: ErrorBoundaryVariant;
}

const hasResetKeysChanged = (previousKeys: unknown[] = [], currentKeys: unknown[] = []) => {
  if (previousKeys.length !== currentKeys.length) return true;

  return previousKeys.some((key, index) => !Object.is(key, currentKeys[index]));
};

const AlertFallback = lazy(() => import('./AlertFallback'));

class LocalErrorBoundary extends Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
  public state: LocalErrorBoundaryState = { error: undefined, hasError: false };

  public static getDerivedStateFromError(error: unknown): LocalErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      hasError: true,
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, { componentStack: info.componentStack ?? null });
  }

  public componentDidUpdate(previousProps: LocalErrorBoundaryProps) {
    if (
      this.state.hasError &&
      hasResetKeysChanged(previousProps.resetKeys, this.props.resetKeys)
    ) {
      this.resetErrorBoundary();
    }
  }

  private resetErrorBoundary = (..._args: unknown[]) => {
    this.setState({ error: undefined, hasError: false });
  };

  public render() {
    if (this.state.hasError) {
      return this.props.fallbackRender({
        error: this.state.error ?? new Error('Unknown error'),
        resetErrorBoundary: this.resetErrorBoundary,
      });
    }

    return this.props.children;
  }
}

const SafeBoundary = memo<SafeBoundaryProps>(
  ({ children, variant = 'silent', alertTitle, minHeight, resetKeys, onError }) => {
    const fallbackRender = useCallback(
      (props: FallbackRenderProps) => {
        const error = props.error instanceof Error ? props.error : new Error(String(props.error));
        if (variant === 'alert') {
          return (
            <Suspense fallback={<SilentFallback minHeight={minHeight} />}>
              <AlertFallback
                error={error}
                resetErrorBoundary={props.resetErrorBoundary}
                title={alertTitle}
              />
            </Suspense>
          );
        }
        return <SilentFallback minHeight={minHeight} />;
      },
      [variant, alertTitle, minHeight],
    );

    return (
      <LocalErrorBoundary fallbackRender={fallbackRender} resetKeys={resetKeys} onError={onError}>
        {children}
      </LocalErrorBoundary>
    );
  },
);

SafeBoundary.displayName = 'SafeBoundary';

export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options?: { alertTitle?: string; minHeight?: number; variant?: ErrorBoundaryVariant },
): ComponentType<P> {
  const Wrapped = (props: P) => (
    <SafeBoundary
      alertTitle={options?.alertTitle}
      minHeight={options?.minHeight}
      variant={options?.variant}
    >
      <Component {...props} />
    </SafeBoundary>
  );

  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}

export { SafeBoundary, SilentFallback };
export default SafeBoundary;
