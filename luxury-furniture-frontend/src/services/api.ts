import { supabase } from "../lib/supabase";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not configured.");
}

export interface ValidationIssue {
  loc?: Array<string | number>;
  msg: string;
  type?: string;
}

interface ErrorResponseBody {
  detail?: string | ValidationIssue[];
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  data?: unknown;
}

function parseErrorMessage(
  responseBody: ErrorResponseBody | null,
  status: number,
): string {
  if (!responseBody) {
    return `Request failed with status ${status}.`;
  }

  if (typeof responseBody.detail === "string") {
    return responseBody.detail;
  }

  if (Array.isArray(responseBody.detail)) {
    return responseBody.detail
      .map((issue) => {
        const location = issue.loc?.join(".");
        return location ? `${location}: ${issue.msg}` : issue.msg;
      })
      .join(", ");
  }

  if (typeof responseBody.message === "string") {
    return responseBody.message;
  }

  return `Request failed with status ${status}.`;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { data, headers: customHeaders, ...requestOptions } = options;
  const { data: sessionData } = await supabase.auth.getSession();

  const headers = new Headers(customHeaders);

  if (sessionData.session?.access_token) {
    headers.set(
      "Authorization",
      `Bearer ${sessionData.session.access_token}`,
    );
  }

  if (data !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${normalizedEndpoint}`, {
      ...requestOptions,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      0,
      "Unable to reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");

  let responseBody: unknown = null;

  if (isJson) {
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }
  }

  if (response.ok) {
    return responseBody as T;
  }

  throw new ApiError(
    response.status,
    parseErrorMessage(responseBody as ErrorResponseBody | null, response.status),
    responseBody,
  );
}
