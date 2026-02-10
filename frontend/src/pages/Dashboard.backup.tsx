import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import InspectionModal from '../components/InspectionModal';
import HistoryModal from '../components/HistoryModal';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { FileText, Clock, Activity, RotateCcw, History } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const COLORS = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5'];

interface MetricData {
    total_errors: string;
    unique_issues: string;
    pending_issues?: string;
    resolved_issues?: string;
    most_frequent?: string;
    last_incident?: string;
}

interface LogLevel {
    key: string;
    doc_count: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface DiagnosisStatus {
    key: string;
    doc_count: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface LogEntry {
    doc_id: string;
    last_seen: string;
    group_signature: string;
    group_type: string;
    count: number;
    'diagnosis.status': string;
    display_rule?: string;
    message_summary?: string;
    logger_name?: string;
    exception_summary?: string;
    'diagnosis.report'?: string;
    assigned_user?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface TopError {
    'Group Signature': string;
    Count: number;
    displayName: string;
}

interface Trend {
    Time: string;
    Count: number;
}

const COLUMN_DEFS = [
    { key: 'inspect', label: 'Inspect', sortable: false },
    { key: 'last_seen', label: 'Last Seen', sortable: true },
    { key: 'group_signature', label: 'Full Signature', sortable: true },
    { key: 'group_type', label: 'Type', sortable: true },
    { key: 'count', label: 'Count', sortable: true },
    { key: 'assigned_user', label: 'Assigned To', sortable: true },
    { key: 'diagnosis.status', label: 'Status', sortable: true },
    { key: 'display_rule', label: 'Rule Name', sortable: false },
    { key: 'message_summary', label: 'Log Message', sortable: false },
    { key: 'logger_name', label: 'Logger', sortable: false },
    { key: 'exception_summary', label: 'Exception Info', sortable: false },
    { key: 'diagnosis.report', label: 'Report', sortable: false },
];

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [metrics, setMetrics] = useState<MetricData | null>(null);
    const [logLevels, setLogLevels] = useState<LogLevel[]>([]);
    const [diagnosisStatus, setDiagnosisStatus] = useState<DiagnosisStatus[]>([]);
    const [tableData, setTableData] = useState<LogEntry[]>([]);
    const [topErrors, setTopErrors] = useState<TopError[]>([]);
    const [trends, setTrends] = useState<Trend[]>([]);
    const [statusOptions, setStatusOptions] = useState<string[]>(["PENDING", "IN PROCESS", "RESOLVED", "IGNORE", "DIAGNOSIS COMPLETED"]);
    const [typeOptions, setTypeOptions] = useState<string[]>(["Exception", "RuleSequence", "CSP Violation", "Logger", "Pega Engine Errors"]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<string>("last_seen");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
    const [inspectingId, setInspectingId] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(20);
    const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
    const [openFormatSubMenu, setOpenFormatSubMenu] = useState<boolean>(false);
    const [dateFormat, setDateFormat] = useState<'auto' | 'localized' | 'distance' | 'calendar'>('auto');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Column State
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
    const [pinnedColumns, setPinnedColumns] = useState<string[]>(['inspect']);
    const [autosizedColumns, setAutosizedColumns] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDate, setSelectedDate] = useState<string>("");


    const fetchData = async () => {
        try {
            const [mRes, levelRes, statusRes, tableRes, topRes, trendRes, optionsRes, typeRes] = await Promise.all([
                axios.get(API_ENDPOINTS.METRICS),
                axios.get(API_ENDPOINTS.LOG_LEVELS),
                axios.get(API_ENDPOINTS.DIAGNOSIS_STATUS),
                axios.get(API_ENDPOINTS.LOG_DETAILS),
                axios.get(API_ENDPOINTS.TOP_ERRORS),
                axios.get(API_ENDPOINTS.TRENDS),
                axios.get(API_ENDPOINTS.STATUS_OPTIONS),
                axios.get(API_ENDPOINTS.TYPE_OPTIONS)
            ]);

            setMetrics(mRes.data);
            setLogLevels(levelRes.data);
            setDiagnosisStatus(statusRes.data);
            setTableData(tableRes.data);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setTopErrors(topRes.data.map((item: any) => ({
                ...item,
                displayName: item['Group Signature']?.length > 40 ? item['Group Signature'].substring(0, 40) + '...' : item['Group Signature']
            })));
            setTrends(trendRes.data);
            setStatusOptions(optionsRes.data.filter((opt: string) => opt !== 'FALSE POSITIVE'));
            setTypeOptions(typeRes.data);
        } catch (err: unknown) {
            console.error("Backend connection failed at:", API_ENDPOINTS.METRICS);
            console.error("Error details:", err instanceof Error ? err.message : String(err));

            // Show a more informative warning in development/debug
            if (import.meta.env.DEV) {
                console.warn("Using mock data as fallback.");
            }

            // Mock Data Fallbacks
            setMetrics({
                total_errors: "12,842",
                unique_issues: "156",
                most_frequent: "Rule-Obj-Activity:Work-.Perform",
                last_incident: "2 mins ago"
            });

            setLogLevels([
                { key: 'ERROR', doc_count: 8500 },
                { key: 'WARN', doc_count: 3200 },
                { key: 'FATAL', doc_count: 450 },
                { key: 'DEBUG', doc_count: 692 }
            ]);

            setDiagnosisStatus([
                { key: 'PENDING', doc_count: 42 },
                { key: 'IN PROCESS', doc_count: 18 },
                { key: 'RESOLVED', doc_count: 125 },
                { key: 'IGNORE', doc_count: 30 }
            ]);

            setTableData([
                { doc_id: '1', last_seen: new Date().toISOString(), group_signature: 'com.pega.pegarules.pub.PRRuntimeException: Section execution terminated', group_type: 'Exception', count: 142, 'diagnosis.status': 'PENDING', display_rule: 'Data-Admin-Operator-ID', message_summary: 'Section execution failed', logger_name: 'com.pega.PRRuntime', exception_summary: 'Stack trace content here...', 'diagnosis.report': 'Executive Summary: Issue identified...' },
                { doc_id: '2', last_seen: new Date(Date.now() - 3600000).toISOString(), group_signature: 'Database-Lock-Failure-Timeout: Unable to acquire lock on CASE-1234', group_type: 'LogMessage', count: 89, 'diagnosis.status': 'IN PROCESS', display_rule: 'Work-Case-Review', message_summary: 'Lock failure on DB', logger_name: 'com.pega.DB', exception_summary: 'DB lock timeout...', 'diagnosis.report': 'Root Cause: Connection pool exhaustion...' },
                { doc_id: '3', last_seen: new Date(Date.now() - 7200000).toISOString(), group_signature: 'Step status fail: Service REST invocation failed with 500 Internal Server Error', group_type: 'RuleSequence', count: 67, 'diagnosis.status': 'PENDING', display_rule: 'Pega-Int-Connector', message_summary: 'REST integration error', logger_name: 'com.pega.Integration', exception_summary: 'HTTP 500 received...', 'diagnosis.report': 'Resolution: Check service provider...' },
            ]);

            setTopErrors([
                { 'Group Signature': 'PRRuntimeException', Count: 450, displayName: 'PRRuntimeException' },
                { 'Group Signature': 'DatabaseLockFailure', Count: 320, displayName: 'DatabaseLockFailure' },
                { 'Group Signature': 'ServiceInvokeError', Count: 280, displayName: 'ServiceInvokeError' },
                { 'Group Signature': 'ThreadTermination', Count: 150, displayName: 'ThreadTermination' },
                { 'Group Signature': 'UncaughtException', Count: 120, displayName: 'UncaughtException' }
            ]);

            setTrends([
                { Time: '08:00', Count: 45 },
                { Time: '10:00', Count: 89 },
                { Time: '12:00', Count: 120 },
                { Time: '14:00', Count: 75 },
                { Time: '16:00', Count: 110 },
                { Time: '18:00', Count: 145 },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Click outside handler to close column menu
    useEffect(() => {
        const handleClickOutside = () => {
            if (openColumnMenu) {
                setOpenColumnMenu(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openColumnMenu]);

    const handleStatusChange = async (docId: string, newStatus: string) => {
        setUpdating(docId);
        try {
            const formData = new FormData();
            formData.append('doc_id', docId);
            formData.append('status', newStatus);
            formData.append('user', user?.email || user?.uid || 'Unknown');

            await axios.post(API_ENDPOINTS.UPDATE_STATUS, formData);
            await fetchData();
        } catch (err) {
            console.error("Failed to update status", err);
            alert("Failed to update status. Please try again.");
        } finally {
            setUpdating(null);
        }
    };

    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;

            switch (dateFormat) {
                case 'localized':
                    return date.toLocaleString();
                case 'distance':
                    return timeAgo(date);
                case 'calendar':
                    return date.toLocaleDateString();
                case 'auto':
                default:
                    // Original format: DD MMM YYYY, HH:mm am/pm
                    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
        } catch {
            return dateStr;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RESOLVED': return 'bg-green-50 text-green-600 border-green-200';
            case 'PENDING': return 'bg-orange-50 text-orange-600 border-orange-200';
            case 'IN PROCESS': return 'bg-blue-50 text-blue-600 border-blue-200';
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
    };

    const filteredTableData = useMemo(() => {
        return tableData
            .filter(row => {
                const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(row['diagnosis.status']);
                const matchesType = selectedTypes.length === 0 || selectedTypes.includes(row['group_type']);

                // Search Logic (Replicating dashboard.py line 863)
                const searchLower = searchTerm.toLowerCase();
                const matchesSearch = !searchTerm || (
                    (row['display_rule'] || "").toString().toLowerCase().includes(searchLower) ||
                    (row['exception_summary'] || "").toString().toLowerCase().includes(searchLower) ||
                    (row['message_summary'] || "").toString().toLowerCase().includes(searchLower) ||
                    (row['group_type'] || "").toString().toLowerCase().includes(searchLower)
                );

                return matchesStatus && matchesType && matchesSearch;
            })
            .sort((a, b) => {
                let valA = a[sortBy];
                let valB = b[sortBy];

                if (sortBy === 'status') {
                    valA = a['diagnosis.status'];
                    valB = b['diagnosis.status'];
                } else if (sortBy === 'last_seen') {
                    valA = new Date(a[sortBy]).getTime();
                    valB = new Date(b[sortBy]).getTime();
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
    }, [tableData, selectedStatuses, selectedTypes, sortBy, sortOrder, searchTerm]);

    const filteredTrends = useMemo(() => {
        let filtered = trends;

        // Date filtering
        if (selectedDate) {
            filtered = filtered.filter(t => {
                // Try to extract date from t.Time (ISO format expected for the data)
                const trendDateStr = t.Time.includes('T') ? t.Time.split('T')[0] : t.Time;
                return trendDateStr === selectedDate;
            });
        }

        return filtered;
    }, [trends, selectedDate]);

    const displayedData = useMemo(() => {
        return filteredTableData.slice(0, visibleCount);
    }, [filteredTableData, visibleCount]);

    const visibleColumns = useMemo(() => {
        return COLUMN_DEFS.filter(col => !hiddenColumns.includes(col.key)).sort((a, b) => {
            const aPinned = pinnedColumns.includes(a.key);
            const bPinned = pinnedColumns.includes(b.key);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0;
        });
    }, [hiddenColumns, pinnedColumns]);

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const response = await axios.post(API_ENDPOINTS.TRIGGER_ANALYSIS);
            alert(response.data.message);
            fetchData(); // Refresh data to see new reports
        } catch (error: unknown) {
            console.error("Analysis error:", error);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorMessage = (error as any).response?.data?.detail || (error instanceof Error ? error.message : String(error));
            alert("Analysis failed: " + errorMessage);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- Column Menu Handlers ---
    const toggleHideColumn = (colKey: string) => {
        setHiddenColumns(prev => prev.includes(colKey) ? prev.filter(k => k !== colKey) : [...prev, colKey]);
        setOpenColumnMenu(null);
    };

    const togglePinColumn = (colKey: string) => {
        setPinnedColumns(prev => prev.includes(colKey) ? prev.filter(k => k !== colKey) : [...prev, colKey]);
        setOpenColumnMenu(null);
    };

    const toggleAutosizeColumn = (colKey: string) => {
        setAutosizedColumns(prev => prev.includes(colKey) ? prev.filter(k => k !== colKey) : [...prev, colKey]);
        setOpenColumnMenu(null);
    };

    const resetColumns = () => {
        setHiddenColumns([]);
        setPinnedColumns(['inspect']);
        setAutosizedColumns([]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin h-12 w-12 border-4 border-[#ee4a4a] border-t-transparent rounded-full shadow-lg" />
                    <p className="text-gray-500 font-medium animate-pulse">Loading dashboard insights...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <h2 className="text-2xl sm:text-3xl font-black text-text-primary flex items-center space-x-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-border">
                        <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                    <span>Pega Log Analysis Dashboard</span>
                </h2>
                <button
                    onClick={() => setShowHistoryModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
                >
                    <History className="w-5 h-5 text-blue-600" />
                    <span>View Resolution History</span>
                </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'TOTAL ERRORS', value: metrics?.total_errors || '0', color: 'bg-white border-l-4 border-l-blue-500' },
                    { label: 'UNIQUE ISSUES', value: metrics?.unique_issues || '0', color: 'bg-white border-l-4 border-l-emerald-500' },
                    { label: 'PENDING ANALYSIS', value: metrics?.pending_issues || '0', color: 'bg-white border-l-4 border-l-orange-500' },
                    { label: 'RESOLVED ISSUES', value: metrics?.resolved_issues || '0', color: 'bg-white border-l-4 border-l-purple-500' },
                ].map((m, i) => (
                    <div key={i} className={`${m.color} p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden transition-all hover:shadow-md`}>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                {m.label}
                            </p>
                        </div>
                        <p className="font-bold text-gray-900 truncate text-3xl mt-1 tracking-tight">
                            {m.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Main Data Table */}
            <div className="space-y-6">
                {/* Search & Filter Controls */}
                <div className="flex flex-col lg:flex-row gap-6 lg:items-end">
                    {/* Search Bar */}
                    <div className="flex-1 space-y-3">
                        <label className="text-sm font-bold text-[#31333f] ml-1">Search Logs</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                className="w-full h-[58px] pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm font-medium placeholder:text-gray-400"
                                placeholder="Type to search by Rule Name, Exception, or Message..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-3 lg:w-1/5">
                        <label className="text-sm font-bold text-[#31333f] ml-1">Filter by Status</label>
                        <div className="relative">
                            <button
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className="w-full h-[58px] px-4 bg-[#f0f2f6] border border-gray-200 rounded-xl text-sm text-left text-gray-500 outline-none focus:ring-2 focus:ring-red-100 transition-all flex items-center justify-between"
                            >
                                <span>{selectedStatuses.length === 0 ? 'Choose options' : `${selectedStatuses.length} selected`}</span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={statusDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                </svg>
                            </button>
                            {statusDropdownOpen && (
                                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                                    {statusOptions.map(opt => (
                                        <div
                                            key={opt}
                                            onClick={() => {
                                                setSelectedStatuses(prev =>
                                                    prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev, opt]
                                                );
                                            }}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-sm border-b border-gray-100 last:border-b-0"
                                        >
                                            <span className="text-gray-700">{opt}</span>
                                            {selectedStatuses.includes(opt) && (
                                                <svg className="w-4 h-4 text-[#ee4a4a]" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedStatuses.map(s => (
                                <span key={s} className="px-3 py-1 bg-red-50 text-[#ee4a4a] text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center">
                                    {s}
                                    <button onClick={() => setSelectedStatuses(prev => prev.filter(v => v !== s))} className="ml-2 hover:text-red-700">×</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-[#31333f] ml-1">Filter by Type</label>
                        <div className="relative">
                            <button
                                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                                className="w-full h-[58px] px-4 bg-[#f0f2f6] border border-gray-200 rounded-xl text-sm text-left text-gray-500 outline-none focus:ring-2 focus:ring-blue-100 transition-all flex items-center justify-between"
                            >
                                <span>{selectedTypes.length === 0 ? 'Choose options' : `${selectedTypes.length} selected`}</span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={typeDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                </svg>
                            </button>
                            {typeDropdownOpen && (
                                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                                    {typeOptions.map(opt => (
                                        <div
                                            key={opt}
                                            onClick={() => {
                                                setSelectedTypes(prev =>
                                                    prev.includes(opt) ? prev.filter(t => t !== opt) : [...prev, opt]
                                                );
                                            }}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-sm border-b border-gray-100 last:border-b-0"
                                        >
                                            <span className="text-gray-700">{opt}</span>
                                            {selectedTypes.includes(opt) && (
                                                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedTypes.map(t => (
                                <span key={t} className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center">
                                    {t}
                                    <button onClick={() => setSelectedTypes(prev => prev.filter(v => v !== t))} className="ml-2 hover:text-blue-700">×</button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                    <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between bg-white/50 sm:backdrop-blur-md gap-6">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xl font-extrabold text-[#31333f] flex items-center space-x-3">
                                <FileText className="w-8 h-8 text-primary bg-[#f8f9fa] p-1.5 rounded-lg" />
                                <span>Detailed Group Analysis</span>
                            </h3>
                            {hiddenColumns.length > 0 && (
                                <button onClick={resetColumns} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-primary flex items-center gap-1 transition-colors">
                                    <RotateCcw className="w-3 h-3" /> Reset Columns
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-6">
                            <button
                                onClick={runAnalysis}
                                disabled={isAnalyzing}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center gap-3 group active:scale-95 disabled:opacity-50"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span className="uppercase tracking-widest text-[11px]">Analyzing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-lg group-hover:animate-bounce">✨</span>
                                        <span className="font-bold text-white transition-colors">Analyse Top 5 Errors</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm border-b border-gray-100">
                                <tr>
                                    {visibleColumns.map((col) => (
                                        <th key={col.key} className={cn("px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] group relative", autosizedColumns.includes(col.key) ? "whitespace-nowrap" : "w-auto")}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span>{col.label} {pinnedColumns.includes(col.key) && <span className="text-[8px] align-top text-red-400 ml-1">📍</span>}</span>
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenColumnMenu(openColumnMenu === col.key ? null : col.key);
                                                        }}
                                                        className={cn("p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100", openColumnMenu === col.key && "opacity-100")}
                                                    >
                                                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 16 16">
                                                            <circle cx="2" cy="8" r="1.5" />
                                                            <circle cx="8" cy="8" r="1.5" />
                                                            <circle cx="14" cy="8" r="1.5" />
                                                        </svg>
                                                    </button>

                                                    {openColumnMenu === col.key && (
                                                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl py-1 min-w-[200px] z-[9999]" onClick={(e) => e.stopPropagation()}>
                                                            {col.sortable && (
                                                                <>
                                                                    <button onClick={() => { setSortBy(col.key); setSortOrder('asc'); setOpenColumnMenu(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700 border-b border-gray-100">
                                                                        <span className="text-gray-400">Sort A-Z</span>
                                                                    </button>
                                                                    <button onClick={() => { setSortBy(col.key); setSortOrder('desc'); setOpenColumnMenu(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700 border-b border-gray-100">
                                                                        <span className="text-gray-400">Sort Z-A</span>
                                                                    </button>
                                                                </>
                                                            )}

                                                            {/* Format Submenu (Only for date) */}
                                                            {col.key === 'last_seen' && (
                                                                <div className="relative group/format">
                                                                    <button
                                                                        onClick={() => setOpenFormatSubMenu(!openFormatSubMenu)}
                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700 justify-between"
                                                                    >
                                                                        <span>Format</span>
                                                                        <span>›</span>
                                                                    </button>
                                                                    {openFormatSubMenu && (
                                                                        <div className="absolute right-full top-0 mr-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[150px] z-[10000]">
                                                                            {[
                                                                                { id: 'auto', label: 'Automatic' },
                                                                                { id: 'localized', label: 'Localized' },
                                                                                { id: 'distance', label: 'Distance' },
                                                                                { id: 'calendar', label: 'Calendar' }
                                                                            ].map(opt => (
                                                                                <button key={opt.id} onClick={() => { setDateFormat(opt.id as 'auto' | 'localized' | 'distance' | 'calendar'); setOpenFormatSubMenu(false); setOpenColumnMenu(null); }} className={cn("w-full px-4 py-2 text-left text-sm hover:bg-gray-50", dateFormat === opt.id && "bg-blue-50 text-blue-600 font-bold")}>
                                                                                    {opt.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <button onClick={() => toggleAutosizeColumn(col.key)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                                                {autosizedColumns.includes(col.key) ? "Normal Width" : "Autosize to Fit"}
                                                            </button>
                                                            <button onClick={() => togglePinColumn(col.key)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700">
                                                                {pinnedColumns.includes(col.key) ? "Unpin Column" : "Pin to Left"}
                                                            </button>
                                                            <button onClick={() => toggleHideColumn(col.key)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700 text-red-500 hover:text-red-600">
                                                                Hide Column
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {displayedData.map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-gray-50/50 transition-colors border-l-4 border-l-transparent hover:border-l-[#ee4a4a]">
                                        {visibleColumns.map((col) => {
                                            const cellClass = cn("px-8 py-5", autosizedColumns.includes(col.key) && "whitespace-nowrap");

                                            // 1. Inspect Button
                                            if (col.key === 'inspect') {
                                                return (
                                                    <td key={col.key} className={cn(cellClass, "text-center")}>
                                                        <button
                                                            onClick={() => setInspectingId(row['doc_id'])}
                                                            className={cn(
                                                                "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all",
                                                                inspectingId === row['doc_id'] ? "bg-[#ee4a4a] text-white shadow-lg shadow-red-200 scale-105" : "text-[#ee4a4a] hover:bg-red-50"
                                                            )}
                                                        >
                                                            Inspect
                                                        </button>
                                                    </td>
                                                );
                                            }

                                            // 2. Last Seen (Date)
                                            if (col.key === 'last_seen') {
                                                const dateParts = formatDate(row['last_seen']).split(',');
                                                return (
                                                    <td key={col.key} className={cellClass}>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-800">{dateParts[0]}</span>
                                                            {dateParts[1] && <span className="text-[11px] font-bold text-gray-400 tracking-tight">{dateParts[1]}</span>}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // 3. Count (Progress)
                                            if (col.key === 'count') {
                                                return (
                                                    <td key={col.key} className={cellClass}>
                                                        <div className="flex items-center space-x-3 min-w-[120px]">
                                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                                <div
                                                                    className="h-full bg-[#FF4B4B] rounded-full"
                                                                    style={{ width: `${Math.min((row['count'] / (Math.max(...tableData.map(r => r.count)) || 1)) * 100, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-sm font-black text-gray-800">{row['count']}</span>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // 4. Status (Dropdown)
                                            if (col.key === 'diagnosis.status') {
                                                return (
                                                    <td key={col.key} className={cellClass}>
                                                        <div className="relative inline-block w-full min-w-[140px]">
                                                            <select
                                                                value={row['diagnosis.status']}
                                                                disabled={updating === row['doc_id']}
                                                                onChange={(e) => handleStatusChange(row['doc_id'], e.target.value)}
                                                                className={cn(
                                                                    "w-full appearance-none border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-red-50 transition-all cursor-pointer shadow-sm",
                                                                    getStatusColor(row['diagnosis.status']),
                                                                    updating === row['doc_id'] && "opacity-50 cursor-not-allowed"
                                                                )}
                                                            >
                                                                {statusOptions.map(opt => (
                                                                    <option key={opt} value={opt} className="bg-white text-gray-900">{opt}</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                                                {updating === row['doc_id'] ? (
                                                                    <div className="animate-spin h-3 w-3 border-[3px] border-current border-t-transparent rounded-full" />
                                                                ) : (
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // 5. Default Text Cells
                                            let content = row[col.key] || 'N/A';
                                            if (col.key === 'display_rule' && content === 'N/A') content = row['logger_name'];

                                            // Specific Styling for certain columns
                                            if (col.key === 'group_type') {
                                                return <td key={col.key} className={cellClass}>
                                                    <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-100">{content}</span>
                                                </td>;
                                            }
                                            if (col.key === 'logger_name') {
                                                return <td key={col.key} className={cellClass}><div className="max-w-[180px]"><p className="text-xs font-mono font-semibold text-gray-700 truncate" title={content}>{content}</p></div></td>;
                                            }

                                            return (
                                                <td key={col.key} className={cellClass}>
                                                    <div className={cn(
                                                        (col.key === 'group_signature' || col.key === 'diagnosis.report' || col.key === 'message_summary' || col.key === 'exception_summary')
                                                            ? "max-w-[450px]"
                                                            : "max-w-[250px]",
                                                        autosizedColumns.includes(col.key) && "max-w-none"
                                                    )}>
                                                        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-relaxed" title={content}>
                                                            {content}
                                                        </p>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Show More Pagination */}
                    {filteredTableData.length > visibleCount && (
                        <div className="p-6 border-t border-gray-50 bg-gray-50/30 flex justify-center">
                            <button
                                onClick={() => setVisibleCount(prev => prev + 20)}
                                className="px-8 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                            >
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span>Show More Groups ({filteredTableData.length - visibleCount} remaining)</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Analytics Section */}
            <div className="pt-6 space-y-8">
                <div className="flex items-center space-x-3">
                    <span className="h-px bg-gray-200 flex-1"></span>
                    <h3 className="text-xl font-bold text-gray-800 uppercase tracking-tight">Diagnostic Analytics</h3>
                    <span className="h-px bg-gray-200 flex-1"></span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm relative">
                        <h4 className="text-sm font-bold text-gray-700 mb-6 flex items-center space-x-2">
                            <div className="w-1.5 h-4 bg-gray-800 rounded-full"></div>
                            <span>Log Level Distribution</span>
                        </h4>
                        <div className="h-[300px] min-h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={logLevels} innerRadius={90} outerRadius={120} paddingAngle={8} dataKey="doc_count" nameKey="key" stroke="none">
                                        {logLevels.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[40px] border border-border shadow-xl overflow-hidden relative">
                        <div className="hidden sm:block absolute top-0 right-0 w-32 h-32 bg-warning/20 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                        <h4 className="text-lg font-black text-text-primary mb-10 flex items-center space-x-2">
                            <div className="w-2 h-6 bg-warning rounded-full"></div>
                            <span>Diagnosis Status Mapping</span>
                        </h4>
                        <div className="h-[300px] min-h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={diagnosisStatus} innerRadius={90} outerRadius={120} paddingAngle={8} dataKey="doc_count" nameKey="key" stroke="none">
                                        {diagnosisStatus.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Top Error Groups Section */}
                <div className="bg-white p-10 rounded-[40px] border border-border shadow-xl relative overflow-hidden">
                    <div className="hidden sm:block absolute top-0 right-0 w-32 h-32 bg-warning/20 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                    <h4 className="text-xl font-black text-text-primary mb-12 flex items-center space-x-3">
                        <div className="w-2 h-8 bg-warning rounded-full"></div>
                        <span>Top Error Groups Breakdown</span>
                    </h4>
                    <div className="h-[400px] min-h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topErrors} layout="vertical" margin={{ left: 150 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#4b5563' }} width={140} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f9fafb' }} />
                                <Bar dataKey="Count" fill="#F4C95D" radius={[0, 10, 10, 0]} barSize={40} animationDuration={500} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Growth/Trend Card */}
                <div className="bg-white p-10 rounded-[40px] border border-border shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-accent"></div>
                    <div className="flex items-center justify-between mb-12">
                        <h4 className="text-xl font-black text-text-primary flex items-center space-x-3">
                            <Clock className="w-6 h-6 text-primary" />
                            <span>Temporal Analysis: Error Trends</span>
                        </h4>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="relative">
                                <input
                                    type="date"
                                    className="pl-4 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                            {selectedDate && (
                                <button
                                    onClick={() => setSelectedDate("")}
                                    className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-primary"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="h-[400px] min-h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredTrends}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0F3D2E" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#0F3D2E" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="Time" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 11, fontWeight: 'bold', fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey="Count" stroke="#0F3D2E" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" animationDuration={500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Inspection Modal Overlay */}
            {inspectingId && (
                <InspectionModal
                    docId={inspectingId}
                    onClose={() => setInspectingId(null)}
                />
            )}
            <HistoryModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
            />
        </div>
    );
};

export default Dashboard;
