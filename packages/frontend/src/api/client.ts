// API Client

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Workflows API
export const workflowsApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    request<{ data: any[]; total: number }>(`/workflows?${new URLSearchParams(params as any)}`),

  get: (id: string) => request<any>(`/workflows/${id}`),

  create: (data: { name: string; definition: any; settings?: any }) =>
    request<any>('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; definition?: any; settings?: any; active?: boolean }) =>
    request<any>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/workflows/${id}`, {
      method: 'DELETE',
    }),

  execute: (id: string, triggerData?: any) =>
    request<{ executionId: string; status: string }>(`/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ triggerData }),
    }),
};

// Executions API
export const executionsApi = {
  list: (params?: { workflowId?: string; status?: string; limit?: number; offset?: number }) =>
    request<{ data: any[]; total: number }>(`/executions?${new URLSearchParams(params as any)}`),

  get: (id: string) => request<any>(`/executions/${id}`),

  stop: (id: string) =>
    request<{ id: string; status: string }>(`/executions/${id}/stop`, {
      method: 'POST',
    }),

  delete: (id: string) =>
    request<void>(`/executions/${id}`, {
      method: 'DELETE',
    }),
};

// HITL API
export const hitlApi = {
  list: (params?: { executionId?: string; status?: string }) =>
    request<{ data: any[] }>(`/hitl?${new URLSearchParams(params as any)}`),

  respond: (id: string, response: { action: string; data?: any; reason?: string }) =>
    request<{ id: string; status: string }>(`/hitl/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify(response),
    }),
};

// Credentials API
export const credentialsApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    request<{ data: any[]; total: number }>(`/credentials?${new URLSearchParams(params as any)}`),

  get: (id: string) => request<any>(`/credentials/${id}`),

  create: (data: { name: string; type: string; data: Record<string, unknown> }) =>
    request<any>('/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; type?: string; data?: Record<string, unknown> }) =>
    request<any>(`/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/credentials/${id}`, {
      method: 'DELETE',
    }),
};

// Custom Nodes API
export const customNodesApi = {
  list: () =>
    request<{ data: any[] }>('/custom-nodes'),

  get: (id: string) =>
    request<any>(`/custom-nodes/${id}`),

  create: (data: any) =>
    request<any>('/custom-nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    request<any>(`/custom-nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/custom-nodes/${id}`, {
      method: 'DELETE',
    }),

  toggle: (id: string) =>
    request<{ id: string; enabled: boolean }>(`/custom-nodes/${id}/toggle`, {
      method: 'POST',
    }),

  test: (id: string, data: { input: unknown; config: Record<string, unknown> }) =>
    request<{ result: unknown }>(`/custom-nodes/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
