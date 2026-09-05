export interface LiveHealthResponse {
  status: string;
  service: string;
  environment: string;
}

export interface ReadyHealthResponse {
  status: string;
  database: string;
}