/**
 * AI Configuration Check Component
 *
 * Displays AI provider configuration status and helps diagnose issues.
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Loader2, Server, Sparkles } from "lucide-react";

interface ProviderStatus {
  provider: string;
  configured: boolean;
  available: boolean | null;
  message: string;
  models?: string[];
}

interface ConfigStatus {
  envVars: {
    AZURE_OPENAI_API_KEY: boolean;
    AZURE_OPENAI_ENDPOINT: boolean;
    AZURE_OPENAI_DEPLOYMENT_NAME: boolean;
    AZURE_OPENAI_API_VERSION: boolean;
  };
  providers: ProviderStatus[];
}

export function AIConfigCheck() {
  const [status, setStatus] = React.useState<ConfigStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const checkConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/ai/models");
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check configuration");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    checkConfig();
  }, []);

  const allConfigured = status ? 
    Object.values(status.envVars).every(Boolean) : 
    false;

  const anyAvailable = status?.providers.some(p => p.available) ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI Configuration Status</CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkConfig}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
        <CardDescription>
          Check AI provider configuration and availability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="p-4 bg-destructive/10 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Configuration Check Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : status ? (
          <>
            {/* Environment Variables */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Environment Variables</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(status.envVars).map(([key, configured]) => (
                  <div 
                    key={key}
                    className="flex items-center justify-between p-2 rounded bg-muted/50"
                  >
                    <span className="text-xs font-mono">{key}</span>
                    {configured ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Status */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="font-medium">
                  {anyAvailable ? "AI Ready" : allConfigured ? "AI Configured (Not Tested)" : "AI Not Configured"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {anyAvailable 
                    ? "At least one provider is available" 
                    : allConfigured
                      ? "Environment variables set but providers may not be reachable"
                      : "Missing required environment variables"
                  }
                </p>
              </div>
              <Badge variant={anyAvailable ? "default" : allConfigured ? "secondary" : "destructive"}>
                {anyAvailable ? "Ready" : allConfigured ? "Unknown" : "Not Configured"}
              </Badge>
            </div>

            {/* Provider Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Provider Status</h4>
              {status.providers.map((provider) => (
                <div 
                  key={provider.provider}
                  className="p-3 rounded-lg border space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium capitalize">
                        {provider.provider.replace("-", " ")}
                      </span>
                    </div>
                    <Badge 
                      variant={
                        provider.available === null 
                          ? "secondary" 
                          : provider.available 
                            ? "default" 
                            : "destructive"
                      }
                    >
                      {provider.available === null 
                        ? "Unknown" 
                        : provider.available 
                          ? "Available" 
                          : "Unavailable"
                      }
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {provider.message}
                  </p>
                  {provider.models && provider.models.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {provider.models.map((model) => (
                        <span 
                          key={model}
                          className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Required Variables */}
            {!allConfigured && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Required Environment Variables
                </h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                  <li>AZURE_OPENAI_API_KEY - Your Azure OpenAI API key</li>
                  <li>AZURE_OPENAI_ENDPOINT - Azure OpenAI endpoint URL</li>
                  <li>AZURE_OPENAI_DEPLOYMENT_NAME - Model deployment name</li>
                  <li>AZURE_OPENAI_API_VERSION - API version (optional, defaults to 2024-02-15-preview)</li>
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
