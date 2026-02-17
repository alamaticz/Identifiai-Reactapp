// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper function to build API URLs
export const buildApiUrl = (path: string): string => {
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${API_URL}/${cleanPath}`;
};

// Export commonly used endpoints
export const API_ENDPOINTS = {
    // Auth
    LOGIN: buildApiUrl('/api/login'),

    // Metrics & Analytics
    METRICS: buildApiUrl('/api/metrics'),
    LOG_LEVELS: buildApiUrl('/api/analytics/log-levels'),
    DIAGNOSIS_STATUS: buildApiUrl('/api/analytics/diagnosis-status'),
    TOP_ERRORS: buildApiUrl('/api/analytics/top-errors'),
    TRENDS: buildApiUrl('/api/analytics/trends'),
    DASHBOARD_BULK: buildApiUrl('/api/dashboard/bulk-stats'),

    // Logs
    LOG_DETAILS: buildApiUrl('/api/logs/details'),
    UPDATE_STATUS: buildApiUrl('/api/logs/update-status'),
    UPDATE_COMMENTS: buildApiUrl('/api/logs/update-comments'),
    AUDIT_HISTORY: buildApiUrl('/api/history'),
    LOG_GROUP: (docId: string) => buildApiUrl(`/api/logs/group/${docId}`),
    UPLOAD_LOGS: buildApiUrl('/api/logs/upload'),

    // Analysis
    TRIGGER_ANALYSIS: buildApiUrl('/api/analysis/trigger'),
    DIAGNOSE_SINGLE: (docId: string) => buildApiUrl(`/api/analysis/diagnose/${docId}`),

    // Grouping
    GENERATE_PATTERN: buildApiUrl('/api/grouping/generate-pattern'),
    SAVE_RULE: buildApiUrl('/api/grouping/save-rule'),
    APPLY_GROUPING: buildApiUrl('/api/grouping/apply'),

    // Chat
    CHAT: buildApiUrl('/api/chat'),

    // Options
    STATUS_OPTIONS: buildApiUrl('/api/status-options'),
    TYPE_OPTIONS: buildApiUrl('/api/type-options'),
    RECENT_NOTIFICATIONS: buildApiUrl('/api/notifications/recent'),
    PEGA_SEND: buildApiUrl('/api/pega/send'),
};
