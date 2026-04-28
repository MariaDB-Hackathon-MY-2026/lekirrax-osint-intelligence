const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

export async function getHistoryScans(params: {
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
    order?: string;
    page?: number;
    pageSize?: number;
}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.sort) qs.set('sort', params.sort);
    if (params.order) qs.set('order', params.order);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    const res = await fetch(`/api/history/scans?${qs.toString()}`, {
        headers: {
            ...getAuthHeaders()
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load history');
    }

    return res.json();
}

export async function getHistoryScanDetails(id: number) {
    const res = await fetch(`/api/history/scans/${id}`, {
        headers: {
            ...getAuthHeaders()
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 404) {
        throw new Error('Not found');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load history detail');
    }
    return res.json();
}

export async function getHistoryOsint(params: {
    q?: string;
    from?: string;
    to?: string;
    module?: string;
    type?: string;
    source?: string;
    risk?: string;
    encrypted?: '1' | '0';
    payloadAvailable?: '1' | '0';
    page?: number;
    pageSize?: number;
}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.module) qs.set('module', params.module);
    if (params.type) qs.set('type', params.type);
    if (params.source) qs.set('source', params.source);
    if (params.risk) qs.set('risk', params.risk);
    if (params.encrypted) qs.set('encrypted', params.encrypted);
    if (params.payloadAvailable) qs.set('payloadAvailable', params.payloadAvailable);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    const res = await fetch(`/api/history/osint?${qs.toString()}`, {
        headers: {
            ...getAuthHeaders()
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load OSINT history');
    }
    return res.json();
}

export async function getHistoryOsintDetails(id: number) {
    const res = await fetch(`/api/history/osint/${id}`, {
        headers: {
            ...getAuthHeaders()
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 404) {
        throw new Error('Not found');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load OSINT history detail');
    }
    return res.json();
}

export async function deleteHistoryScan(id: number) {
    const res = await fetch(`/api/history/scans/${id}`, {
        method: 'DELETE',
        headers: {
            ...getAuthHeaders()
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 404) {
    const raw = await res.text().catch(() => '');
    const msg =
      raw.trim().startsWith('<') || raw.includes('Cannot DELETE')
        ? 'Delete endpoint not available. Restart the backend server.'
        : 'Not found';
    throw new Error(msg);
    }
    if (!res.ok) {
    const raw = await res.text().catch(() => '');
    const parsed = (() => {
      try {
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const msgFromJson =
      parsed && typeof parsed === 'object' ? ((parsed as any).message || (parsed as any).error) : null;
    const msg =
      typeof msgFromJson === 'string' && msgFromJson.trim()
        ? msgFromJson.trim()
        : raw.trim().startsWith('<')
          ? 'Failed to delete scan: API returned HTML. Ensure the backend is running and Vite proxy is configured.'
          : 'Failed to delete scan';
    throw new Error(msg);
    }
    return res.json();
}

export async function deleteHistoryOsint(id: number) {
    const res = await fetch(`/api/history/osint/${id}`, {
        method: 'DELETE',
        headers: {
            ...getAuthHeaders()
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 404) {
    const raw = await res.text().catch(() => '');
    const msg =
      raw.trim().startsWith('<') || raw.includes('Cannot DELETE')
        ? 'Delete endpoint not available. Restart the backend server.'
        : 'Not found';
    throw new Error(msg);
    }
    if (!res.ok) {
    const raw = await res.text().catch(() => '');
    const parsed = (() => {
      try {
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const msgFromJson =
      parsed && typeof parsed === 'object' ? ((parsed as any).message || (parsed as any).error) : null;
    const msg =
      typeof msgFromJson === 'string' && msgFromJson.trim()
        ? msgFromJson.trim()
        : raw.trim().startsWith('<')
          ? 'Failed to delete OSINT record: API returned HTML. Ensure the backend is running and Vite proxy is configured.'
          : 'Failed to delete OSINT record';
    throw new Error(msg);
    }
    return res.json();
}

export async function runRecon(target: string) {
    const res = await fetch(
        `/api/recon?target=${encodeURIComponent(target)}`,
        {
            headers: {
                ...getAuthHeaders()
            }
        }
    );

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }

    if (!res.ok) {
        throw new Error("API error");
    }

    return res.json();
}

export async function getOsintData(module: string, target: string, scanId?: number) {
    let url = `/api/osint/${module}?target=${encodeURIComponent(target)}`;
    if (scanId) {
        url += `&scanId=${scanId}`;
    }

    const res = await fetch(url, {
        headers: {
            ...getAuthHeaders()
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }

    if (!res.ok) {
        throw new Error(`Failed to fetch OSINT data for ${module}`);
    }

    return res.json();
}

export async function login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const raw = await res.text();
    const parsed = (() => {
        try {
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    if (!res.ok) {
        const msgFromJson =
            parsed && typeof parsed === 'object'
                ? ((parsed as any).message || (parsed as any).error)
                : null;
        const msg =
            typeof msgFromJson === 'string' && msgFromJson.trim()
                ? msgFromJson.trim()
                : raw.trim().startsWith('<')
                    ? 'Login failed: API returned HTML. Ensure the backend is running and Vite proxy is configured.'
                    : `Login failed (HTTP ${res.status})`;
        throw new Error(msg);
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Login failed: Invalid JSON response from server');
    }
    const data = parsed as any;
    if (data.token) {
        localStorage.setItem('token', data.token);
    }
    return data;
}
