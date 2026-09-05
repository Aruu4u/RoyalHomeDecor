import { Component, type ErrorInfo, type ReactNode } from "react";

import ServiceNotice from "./ServiceNotice";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time crashes anywhere below it and shows the customer
 * notice instead of a blank white screen.
 *
 * The real error is logged to the console for developers; none of it is
 * put on screen. Error boundaries have to be class components: there is
 * no hook equivalent of componentDidCatch.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    /* Developer-facing only. Never surfaced to the shopper. */
    console.error("Unhandled UI error:", error, errorInfo.componentStack);
  }

  private handleRetry = (): void => {
    /*
     * Clearing the flag re-mounts the subtree. If the fault was
     * transient the shopper carries on without a full page load; if it
     * throws again the boundary simply catches it again.
     */
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ServiceNotice onRetry={this.handleRetry} variant="surveillance" />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
