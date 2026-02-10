/**
 * Log Normalizer Utility
 * Normalizes error messages by replacing variable parts with placeholders.
 * Mirrors the Python implementation in log_normalizer.py
 */

export function normalizeErrorPattern(message: string | null | undefined): string {
    if (!message || typeof message !== 'string') {
        return message || '';
    }

    let normalized = message;

    // Pattern 1: Array/list indices like .agreement(9), .agreement(10) -> .agreement(*)
    normalized = normalized.replace(/\((\d+)\)/g, '(*)');  // (9) -> (*)
    normalized = normalized.replace(/\[(\d+)\]/g, '[*]');  // [9] -> [*]

    // Pattern 2: Dates and timestamps
    // HTTP date format: Thu, 04 Dec 2025 11:34:44 GMT
    normalized = normalized.replace(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UTC|EST|EDT|PST|PDT|[A-Z]{2,4})\b/g, '[DATE]');
    // ISO 8601 dates: 2025-04-18T14:23:09
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g, '[DATE]');
    // Date formats: 2025-04-18, 04/18/2025
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}/g, '[DATE]');
    normalized = normalized.replace(/\d{2}\/\d{2}\/\d{4}/g, '[DATE]');

    // Pattern 3: UUIDs and GUIDs
    normalized = normalized.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[UUID]');

    // Pattern 3.5: JSON ID values
    normalized = normalized.replace(/"id"\s*:\s*"[A-Za-z0-9]{10,}"/g, '"id":"[JSON_ID]"');

    // Pattern 4: Case IDs (e.g., CO-19577, T-12345)
    normalized = normalized.replace(/[A-Z]+-\d+/g, '[CASE_ID]');

    // Pattern 5: Long numeric IDs (6+ digits)
    normalized = normalized.replace(/\b\d{6,}\b/g, '[ID]');

    // Pattern 6: Email addresses
    normalized = normalized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

    // Pattern 7: IP addresses
    normalized = normalized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');

    // Pattern 8: File paths
    // Windows paths: C:\path\to\file
    normalized = normalized.replace(/[A-Za-z]:\\[^\s<>"|?*]+/g, '[FILE_PATH]');
    // Unix paths: /path/to/file
    normalized = normalized.replace(/\/[^\s<>"|?*]{2,}/g, '[FILE_PATH]');

    // Pattern 9: URL normalization
    // Session IDs in URLs
    normalized = normalized.replace(/\/[A-Za-z0-9_-]{15,}\*\//g, '/[SESSION_ID]*/');
    // Hex IDs in query params
    normalized = normalized.replace(/([?&])([a-zA-Z_]+)=[A-Fa-f0-9]{20,}/g, '$1$2=[HEX_ID]');
    // Long alphanumeric IDs in query params
    normalized = normalized.replace(/([?&])([a-zA-Z_]+)=[A-Za-z0-9]{15,}/g, '$1$2=[LONG_ID]');
    // Numeric params
    normalized = normalized.replace(/([?&])([a-zA-Z_]+)=\d{5,}/g, '$1$2=[NUM_PARAM]');
    // Encoded params
    normalized = normalized.replace(/([?&])([a-zA-Z_]+)=%[0-9A-Fa-f]{2,}[^\s&]*/g, '$1$2=[ENCODED_PARAM]');
    // Query values (preserving true, false, 1, 0, yes, no)
    normalized = normalized.replace(/([?&])([a-zA-Z_]+)=(?!(?:true|false|1|0|yes|no)(?=[&\s]|$))([A-Za-z0-9_-]+)(?=[&\s]|$)/g, '$1$2=[QUERY_VALUE]');
    // Entire query strings in URLs
    normalized = normalized.replace(/(https?:\/\/[^\s?]+)\?[^\s]+/g, '$1?[QUERY_PARAMS]');

    // Pattern 10: Java object references (memory addresses)
    normalized = normalized.replace(/[A-Za-z0-9_$\[\];.]+@[0-9a-fA-F]{4,}\b/g, '[OBJECT_REF]');

    // Pattern 11: Hex values
    normalized = normalized.replace(/\b0x[0-9a-fA-F]+\b/g, '[HEX]');

    return normalized;
}
