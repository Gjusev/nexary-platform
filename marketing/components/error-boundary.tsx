"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw, Home } from "lucide-react"

interface Props {
    children: React.ReactNode
    fallback?: React.ComponentType<ErrorFallbackProps>
}

interface State {
    hasError: boolean
    error?: Error
}

interface ErrorFallbackProps {
    error?: Error
    resetError: () => void
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-destructive" />
                        </div>
                        <div>
                            <CardTitle>Something went wrong</CardTitle>
                            <CardDescription>
                                An unexpected error occurred
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <details className="mt-4 p-4 bg-muted rounded-lg">
                            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                                Error details
                            </summary>
                            <pre className="mt-3 text-xs overflow-auto text-muted-foreground">
                                {error.message}
                            </pre>
                        </details>
                    )}
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button onClick={resetError} variant="default" className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Try again
                    </Button>
                    <Button
                        onClick={() => window.location.href = "/"}
                        variant="outline"
                        className="gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Go home
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to error reporting service
        console.error("Error caught by ErrorBoundary:", error, errorInfo)

        // You can integrate with error reporting services here:
        // - Sentry
        // - LogRocket
        // - Custom error tracking
    }

    resetError = () => {
        this.setState({ hasError: false, error: undefined })
    }

    render() {
        if (this.state.hasError) {
            const FallbackComponent = this.props.fallback || DefaultErrorFallback
            return <FallbackComponent error={this.state.error} resetError={this.resetError} />
        }

        return this.props.children
    }
}

/**
 * Hook-based error boundary for functional components
 */
export function useErrorHandler() {
    return (error: Error) => {
        throw error
    }
}
