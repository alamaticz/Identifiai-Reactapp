import React, { useEffect, useState, useMemo, memo, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import buildingAnimation from '../assets/building_page.json';
import { API_ENDPOINTS } from '../config/api';
import InspectionModal from '../components/InspectionModal';
import HistoryModal from '../components/HistoryModal';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, BarChart, Bar, CartesianGrid } from 'recharts';
import { Clock, Activity, History, Search, Bell, Settings, ChevronDown, Filter, BarChart as BarChartIcon, User, LogOut, RefreshCcw, Maximize2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const COLORS = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5'];

const LoadingAnimation = () => {
    return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[40px] border border-gray-50 shadow-xl max-w-md mx-auto overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-pulse" />

            <div className="relative mb-8 w-64 h-64 flex items-center justify-center">
                <Lottie
                    animationData={buildingAnimation}
                    loop={true}
                    className="w-full h-full"
                />

                {/* Ambient Glow */}
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute -inset-4 bg-primary/5 rounded-full -z-10 blur-xl"
                />
            </div>

            <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-3">
                    <span className="h-px w-8 bg-gradient-to-r from-transparent to-gray-200" />
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.5em] text-center">Identifying Logs</h3>
                    <span className="h-px w-8 bg-gradient-to-l from-transparent to-gray-200" />
                </div>

                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center max-w-[280px] leading-relaxed">
                    AI engine is reconstructing your dashboard environment
                </p>

                <div className="flex gap-2.5 pt-2">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                scale: [1, 1.6, 1],
                                opacity: [0.3, 1, 0.3],
                                backgroundColor: ['#d1d5db', '#3b82f6', '#d1d5db']
                            }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                delay: i * 0.2
                            }}
                            className="w-1.5 h-1.5 rounded-full"
                        />
                    ))}
                </div>
            </div>

            <div className="mt-10 pt-6 border-t border-gray-50 w-full flex justify-center">
                <div className="flex items-center space-x-2">
                    <div className="w-1 h-1 bg-primary/30 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black text-primary/30 uppercase tracking-[0.4em]">Enterprise AI Reconstruction</span>
                    <div className="w-1 h-1 bg-primary/30 rounded-full animate-pulse" />
                </div>
            </div>
        </div>
    );
};

interface MetricData {
    total_errors: string;
    total_errors_change?: number;
    unique_issues: string;
    unique_issues_change?: number;
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
    { key: 'display_rule', label: 'Rule Name', sortable: true },
    { key: 'message_summary', label: 'Log Message', sortable: true },
    { key: 'logger_name', label: 'Logger', sortable: true },
    { key: 'exception_summary', label: 'Exception Info', sortable: true },
    { key: 'diagnosis.report', label: 'Report', sortable: true },
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'RESOLVED':
        case 'Completed': return 'bg-green-50 text-green-600 border-green-200';
        case 'PENDING':
        case 'Pending': return 'bg-orange-50 text-orange-600 border-orange-200';
        case 'IN PROCESS':
        case 'In Process': return 'bg-blue-50 text-blue-600 border-blue-200';
        default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
};

const Dashboard: React.FC = memo(() => {
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
    const [tableLoading, setTableLoading] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

    // --- UI State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [inspectingId, setInspectingId] = useState<string | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
    const [timezone, setTimezone] = useState<'IST' | 'PST'>('IST');
    const prevMetrics = useRef<MetricData | null>(null);

    // --- Performance Optimization: State for Header ---
    const [showSettings, setShowSettings] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; type: string }[]>([]);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await axios.get(API_ENDPOINTS.RECENT_NOTIFICATIONS);
            setNotifications(res.data);
        } catch (err) {
            console.error("Fetch notifications failed:", err);
        }
    }, []);

    // Column State
    const [hiddenColumns] = useState<string[]>([]);
    const [pinnedColumns] = useState<string[]>(['inspect']);

    // --- 1. Fetch Logs (Search, Sort, Filter, Page) ---
    const fetchLogs = useCallback(async (append = false, offset = 0) => {
        // Only show full-page loading if we have absolutely NO data (initial load)
        const isInitialLoad = !append && (offset === 0) && !tableData.length && !metrics;
        
        if (isInitialLoad) {
            setLoading(true);
        } else if (!append) {
             setTableLoading(true);
        }

        try {
            const params = new URLSearchParams({
                size: '10',
                offset: offset.toString(),
                sort_by: sortBy,
                sort_order: sortOrder
            });

            if (searchTerm) params.append('search', searchTerm);
            if (selectedStatuses.length > 0) params.append('statuses', selectedStatuses.join(','));
            if (selectedTypes.length > 0) params.append('types', selectedTypes.join(','));

            const response = await axios.get(`${API_ENDPOINTS.LOG_DETAILS}?${params.toString()}`);
            const newTableData = response.data;

            if (append) {
                setTableData(prev => [...prev, ...newTableData]);
            } else {
                setTableData(newTableData);
            }
        } catch (err) {
            console.error("Fetch logs failed:", err);
        } finally {
            if (isInitialLoad) setLoading(false);
            setTableLoading(false);
        }
    }, [searchTerm, sortBy, sortOrder, selectedStatuses, selectedTypes]);

    // --- 2. Initial Global Metrics Load (Bulk) ---
    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const bulkRes = await axios.get(API_ENDPOINTS.DASHBOARD_BULK);
                const bulk = bulkRes.data;
                setMetrics(bulk.metrics);
                setLogLevels(bulk.log_levels);
                setDiagnosisStatus(bulk.diagnosis_status);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setTopErrors(bulk.top_errors.map((item: any) => ({
                    ...item,
                    displayName: item['Group Signature']?.length > 40 ? item['Group Signature'].substring(0, 40) + '...' : item['Group Signature']
                })));
                setTrends(bulk.trends);
                setStatusOptions(bulk.status_options.filter((opt: string) => opt !== 'FALSE POSITIVE'));
                setTypeOptions(bulk.type_options);
                prevMetrics.current = bulk.metrics;

                // Also fetch logs and notifications for the first time
                fetchLogs(false, 0);
                fetchNotifications();
            } catch (err) {
                console.error("Initial load failed:", err);
            }
        };
        loadDashboard();
    }, []); // RUN ONCE

    // --- 3. Reactive Table Updates (Search, Sort, Filter) ---
    useEffect(() => {
        // Debounce search, but immediate for Sort/Filter
        const delay = searchTerm ? 500 : 0;
        const timeout = setTimeout(() => {
            fetchLogs(false, 0);
        }, delay);

        return () => clearTimeout(timeout);
    }, [searchTerm, sortBy, sortOrder, selectedStatuses, selectedTypes, fetchLogs]);

    // --- 4. Periodic Notification Polling ---
    useEffect(() => {
        const interval = setInterval(fetchNotifications, 30000); // 30s
        return () => clearInterval(interval);
    }, [fetchNotifications]);


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

    // --- Memoized Handlers ---
    const handleStatusChange = useCallback(async (docId: string, newStatus: string) => {
        setUpdating(docId);
        try {
            const formData = new FormData();
            formData.append('doc_id', docId);
            formData.append('status', newStatus);
            formData.append('user', user?.displayName || user?.email || 'Unknown');

            await axios.post(API_ENDPOINTS.UPDATE_STATUS, formData);
            setTableData(prev => prev.map(row => row.doc_id === docId ? { ...row, 'diagnosis.status': newStatus } : row));
        } catch (error) {
            console.error('Failed to update status:', error);
        } finally {
            setUpdating(null);
        }
    }, [user]);

    const filteredTrends = useMemo(() => {
        let filtered = trends || [];

        // Date filtering (Range)
        if (startDate || endDate) {
            filtered = filtered.filter(t => {
                const trendDateStr = t.Time.includes('T') ? t.Time.split('T')[0] : t.Time;
                const trendTime = new Date(trendDateStr).getTime();

                const start = startDate ? new Date(startDate).getTime() : -Infinity;
                const end = endDate ? new Date(endDate).getTime() : Infinity;

                return trendTime >= start && trendTime <= end;
            });
        }

        return filtered;
    }, [trends, startDate, endDate]);

    // Server handles filtering and sorting now
    const displayedData = tableData;

    const visibleColumns = useMemo(() => {
        return COLUMN_DEFS.filter(col => !hiddenColumns.includes(col.key)).sort((a, b) => {
            const aPinned = pinnedColumns.includes(a.key);
            const bPinned = pinnedColumns.includes(b.key);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0;
        });
    }, [hiddenColumns, pinnedColumns]);

    const runAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            const response = await axios.post(API_ENDPOINTS.TRIGGER_ANALYSIS);
            alert(response.data.message);
            fetchLogs(false, 0); // Refresh data to see new reports
        } catch (error: unknown) {
            console.error("Analysis error:", error);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorMessage = (error as any).response?.data?.detail || (error instanceof Error ? error.message : String(error));
            alert("Analysis failed: " + errorMessage);
        } finally {
            setIsAnalyzing(false);
        }
    }, [fetchLogs]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[70vh] w-full bg-[#fdfdfd]">
                <LoadingAnimation />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <DashboardHeader
                user={user}
                showNotifications={showNotifications}
                setShowNotifications={setShowNotifications}
                showSettings={showSettings}
                setShowSettings={setShowSettings}
                notifications={notifications}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="TOTAL ERRORS" value={metrics?.total_errors || '0'} sub={metrics?.total_errors_change !== undefined ? `${metrics.total_errors_change > 0 ? '↑' : '↓'} ${Math.abs(metrics.total_errors_change)}% vs last week` : 'Calculating...'} iconColor="text-blue-500" chartColor="#3b82f6" index={0} cn={cn} />
                <StatCard label="UNIQUE ISSUES" value={metrics?.unique_issues || '0'} sub={metrics?.unique_issues_change !== undefined ? `${metrics.unique_issues_change > 0 ? '↑' : '↓'} ${Math.abs(metrics.unique_issues_change)}% vs last week` : 'Calculating...'} iconColor="text-emerald-500" chartColor="#10b981" index={1} cn={cn} />
                <StatCard label="PENDING ISSUES" value={metrics?.pending_issues || '0'} sub="ANALYSIS PENDING" iconColor="text-orange-500" chartColor="#f59e0b" index={2} cn={cn} />
                <StatCard label="RESOLVED ISSUES" value={metrics?.resolved_issues || '0'} sub="COMPLETED ISSUES" iconColor="text-purple-500" chartColor="#8b5cf6" index={3} cn={cn} />
            </div>

            <LogTableSection
                displayedData={displayedData}
                visibleColumns={visibleColumns}
                updating={updating}
                handleStatusChange={handleStatusChange}
                setInspectingId={setInspectingId}
                visibleCount={tableData.length}
                totalCount={metrics?.unique_issues ? parseInt(metrics.unique_issues.toString().replace(/,/g, '')) : 0}
                onShowMore={() => fetchLogs(true, tableData.length)}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                // --- Sorting ---
                sortBy={sortBy}
                sortOrder={sortOrder}
                setSortBy={setSortBy}
                setSortOrder={setSortOrder}
                // --- Filters ---
                selectedStatuses={selectedStatuses}
                setSelectedStatuses={setSelectedStatuses}
                statusOptions={statusOptions}
                statusDropdownOpen={statusDropdownOpen}
                setStatusDropdownOpen={setStatusDropdownOpen}
                selectedTypes={selectedTypes}
                setSelectedTypes={setSelectedTypes}
                typeOptions={typeOptions}
                typeDropdownOpen={typeDropdownOpen}
                setTypeDropdownOpen={setTypeDropdownOpen}
                // --- Actions ---
                runAnalysis={runAnalysis}
                isAnalyzing={isAnalyzing}
                onRefresh={() => fetchLogs(false, 0)}
                timezone={timezone}
                setTimezone={setTimezone}
                onHistoryOpen={() => setShowHistoryModal(true)}
                loading={tableLoading}
                cn={cn}
            />

            <div className="pt-12 space-y-10">
                <div className="flex flex-col gap-8">
                    <TemporalTrendsCard
                        data={filteredTrends}
                        startDate={startDate}
                        setStartDate={setStartDate}
                        endDate={endDate}
                        setEndDate={setEndDate}
                    />
                    <DiagnosticAnalyticsCard
                        logLevels={logLevels}
                        diagnosisStatus={diagnosisStatus}
                        COLORS={COLORS}
                    />
                </div>
                <ErrorGroupsBreakdownCard topErrors={topErrors} />
            </div>

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
});
// --- Memoized Components ---

interface StatCardProps {
    label: string;
    value: string;
    sub: string;
    iconColor: string;
    chartColor: string;
    index: number;
    cn: (...inputs: any[]) => string;
}

const StatCard = memo(({ label, value, sub, iconColor, chartColor, index, cn }: StatCardProps) => (
    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", index === 0 ? "bg-blue-500" : index === 1 ? "bg-emerald-500" : index === 2 ? "bg-orange-500" : "bg-purple-500")} />
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            </div>
            {index === 2 && <ChevronDown className="w-4 h-4 text-gray-300" />}
        </div>
        <div className="flex items-end justify-between">
            <div>
                <h3 className="text-4xl font-black text-gray-900 tracking-tighter mb-1">{value}</h3>
                <p className={cn("text-[10px] font-bold uppercase tracking-tighter", iconColor)}>{sub}</p>
            </div>
            <div className="h-16 w-24">
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                    <AreaChart data={Array.from({ length: 10 }, () => ({ v: Math.random() * 10 }))}>
                        <Area type="monotone" dataKey="v" stroke={chartColor} fill={chartColor} fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
));

interface DashboardHeaderProps {
    user: any;
    showNotifications: boolean;
    setShowNotifications: (show: boolean) => void;
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
    notifications: { id: string; text: string; time: string; type: string }[];
}

const formatRelativeTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
};

const DashboardHeader = memo(({ user, showNotifications, setShowNotifications, showSettings, setShowSettings, notifications }: DashboardHeaderProps) => {
    return (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-6 px-10">
            <div className="flex items-center gap-4">
                <img src="/AlaLogo.png" alt="Alamaticz" className="h-10 w-10 object-contain" />
                <div className="flex flex-col">
                    <span className="font-extrabold text-[#31333f] text-sm tracking-tight leading-none">ALAMATICZ</span>
                    <span className="text-[10px] font-bold text-gray-400 leading-none">SOLUTIONS</span>
                </div>
            </div>

            <div className="flex-1 max-w-2xl relative group">
                {/* Search Box Moved to Table Section */}
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 pr-6 border-r border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-white shadow-sm">
                        <span className="text-primary font-black text-sm">
                            {(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800 leading-none">{user?.displayName || (user?.email?.split('@')[0])}</span>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">Administrator</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="p-3 bg-gray-50 rounded-xl text-gray-400 hover:text-primary hover:bg-primary/5 transition-all relative"
                        >
                            <Bell className="w-5 h-5" />
                            {notifications.length > 0 && (
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-primary/5">
                                    <h5 className="font-black text-gray-800 flex items-center gap-2">
                                        <Bell className="w-4 h-4" />
                                        Notifications
                                    </h5>
                                    <span className="text-[10px] font-bold text-primary uppercase bg-white px-2 py-1 rounded-full border border-primary/10">{notifications.length} New</span>
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length > 0 ? (
                                        notifications.map((n: any) => (
                                            <div key={n.id} className="p-5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-4 items-start">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                                    n.type === 'error' ? "bg-red-400" : "bg-blue-400"
                                                )} />
                                                <div>
                                                    <p className="text-xs font-bold text-gray-700 leading-relaxed mb-1">{n.text}</p>
                                                    <span className="text-[10px] font-bold text-gray-300 uppercase">{formatRelativeTime(n.time)}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-10 text-center">
                                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
                                                <Activity className="w-6 h-6" />
                                            </div>
                                            <p className="text-xs font-bold text-gray-400">No new notifications</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-gray-50 text-center">
                                    <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Mark all as read</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-3 bg-gray-50 rounded-xl text-gray-400 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                            <Settings className="w-5 h-5" />
                        </button>

                        {showSettings && (
                            <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 p-4">
                                <div className="space-y-1">
                                    <button className="w-full text-left p-3 rounded-2xl hover:bg-gray-50 transition-colors flex items-center gap-3 group">
                                        <div className="p-2 bg-blue-50 rounded-xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-700">Account Settings</span>
                                    </button>
                                    <button className="w-full text-left p-3 rounded-2xl hover:bg-gray-50 transition-colors flex items-center gap-3 group">
                                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-700">Audit Logs</span>
                                    </button>
                                    <div className="h-px bg-gray-100 my-2" />
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="w-full text-left p-3 rounded-2xl hover:bg-red-50 transition-colors flex items-center gap-3 group text-red-500"
                                    >
                                        <div className="p-2 bg-red-50 rounded-xl text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                                            <LogOut className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-bold">Logout Session</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

interface TemporalTrendsCardProps {
    data: Trend[];
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
}

const TemporalTrendsCard = memo(({ data, startDate, setStartDate, endDate, setEndDate }: TemporalTrendsCardProps) => (
    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-8">
            <h4 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                Temporal Analysis: Error Trends
            </h4>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">From</span>
                    <input
                        type="date"
                        className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">To</span>
                    <input
                        type="date"
                        className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                    />
                </div>
            </div>
        </div>
        <div className="h-[300px] w-full" style={{ minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="Time"
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                        tickFormatter={(val) => {
                            if (!val) return '';
                            try {
                                const d = new Date(val);
                                if (isNaN(d.getTime())) return val;
                                const options: Intl.DateTimeFormatOptions = {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                };
                                return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], options)}`;
                            } catch { return val; }
                        }}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => Math.floor(val).toLocaleString()}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', background: '#fff' }}
                        labelStyle={{ fontWeight: 'black', color: '#374151', marginBottom: '4px' }}
                        itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                        labelFormatter={(label) => new Date(label).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    />
                    <Area type="monotone" dataKey="Count" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" animationDuration={1000} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
));

interface DiagnosticAnalyticsCardProps {
    logLevels: LogLevel[];
    diagnosisStatus: DiagnosisStatus[];
    COLORS: string[];
}

const DiagnosticAnalyticsCard = memo(({ logLevels, diagnosisStatus, COLORS }: DiagnosticAnalyticsCardProps) => (
    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
        <h4 className="text-xl font-bold text-gray-800 mb-10 flex items-center gap-3">
            Diagnostic Analytics
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col items-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 text-center">Log level Distribution</p>
                <div className="h-[220px] w-full relative" style={{ minHeight: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={150}>
                        <PieChart>
                            <Pie data={logLevels} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="doc_count" nameKey="key" stroke="none">
                                {logLevels.map((_: any, index: number) => <Cell key={`c-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-red-500">92%</span>
                        <span className="text-[10px] font-bold text-gray-400">ERROR RATE</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 text-center">Diagnosis Status Mapping</p>
                <div className="h-[220px] w-full relative" style={{ minHeight: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={150}>
                        <PieChart>
                            <Pie data={diagnosisStatus} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="doc_count" nameKey="key" stroke="none">
                                {diagnosisStatus.map((_: any, index: number) => <Cell key={`c2-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-emerald-500">85%</span>
                        <span className="text-[10px] font-bold text-gray-400">COMPLETED</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
));

interface ErrorGroupsBreakdownCardProps {
    topErrors: TopError[];
}

const ErrorGroupsBreakdownCard = memo(({ topErrors }: ErrorGroupsBreakdownCardProps) => (
    <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
        <h4 className="text-xl font-bold text-gray-800 mb-10 flex items-center gap-3">
            <BarChartIcon className="w-5 h-5 text-gray-400" />
            Top Error Groups Breakdown
        </h4>
        <div className="h-[400px] w-full" style={{ minHeight: '400px' }}>
            <ResponsiveContainer width="100%" height="100%" debounce={200}>
                <BarChart data={topErrors} layout="vertical" margin={{ left: 150 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="displayName" type="category" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#4b5563' }} width={140} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="Count" fill="#F4C95D" radius={[0, 10, 10, 0]} barSize={40} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
));

interface LogTableSectionProps {
    displayedData: LogEntry[];
    visibleColumns: any[];
    updating: string | null;
    handleStatusChange: (docId: string, newStatus: string) => void;
    setInspectingId: (id: string | null) => void;
    visibleCount: number;
    totalCount: number;
    onShowMore: () => void;
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    sortBy: string;
    sortOrder: "asc" | "desc";
    setSortBy: (val: string) => void;
    setSortOrder: (val: "asc" | "desc") => void;
    selectedStatuses: string[];
    setSelectedStatuses: (status: any) => void;
    statusOptions: string[];
    statusDropdownOpen: boolean;
    setStatusDropdownOpen: (open: boolean) => void;
    selectedTypes: string[];
    setSelectedTypes: (type: any) => void;
    typeOptions: string[];
    typeDropdownOpen: boolean;
    setTypeDropdownOpen: (open: boolean) => void;
    runAnalysis: () => void;
    isAnalyzing: boolean;
    onRefresh: () => void;
    timezone: 'IST' | 'PST';
    setTimezone: (tz: 'IST' | 'PST') => void;
    onHistoryOpen: () => void;
    loading?: boolean;
    cn: (...inputs: any[]) => string;
}

const LogTableSection = memo(({
    displayedData,
    visibleColumns,
    updating,
    handleStatusChange,
    setInspectingId,
    visibleCount,
    totalCount,
    onShowMore,
    searchTerm,
    setSearchTerm,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    selectedStatuses,
    setSelectedStatuses,
    statusOptions,
    statusDropdownOpen,
    setStatusDropdownOpen,
    selectedTypes,
    setSelectedTypes,
    typeOptions,
    typeDropdownOpen,
    setTypeDropdownOpen,
    runAnalysis,
    isAnalyzing,
    onRefresh,
    timezone,
    setTimezone,
    onHistoryOpen,
    loading,
    cn
}: LogTableSectionProps) => {
    const handleSort = (key: string) => {
        if (sortBy === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortOrder('desc');
        }
    };

    const resetSorting = () => {
        setSortBy('last_seen');
        setSortOrder('desc');
        setSelectedStatuses([]);
        setSelectedTypes([]);
        setSearchTerm('');
    };

    return (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden mt-8">
            <div className="p-8 border-b border-gray-50 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <h3 className="text-xl font-extrabold text-[#31333f]">Detailed Group Analysis</h3>
                    <div className="flex-1 max-w-3xl relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search within table..."
                            className="w-full bg-[#f8fbff] border border-gray-100 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/20 transition-all shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex gap-3">
                        <button
                            onClick={(e) => { e.stopPropagation(); setStatusDropdownOpen(!statusDropdownOpen); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-black uppercase text-gray-500 hover:bg-gray-100 transition-all relative shadow-sm"
                        >
                            <Filter className="w-3.5 h-3.5" />
                            <span>{selectedStatuses.length === 1 ? selectedStatuses[0] : `Status (${selectedStatuses.length})`}</span>
                            {statusDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-1 min-w-[200px] z-50 overflow-hidden" onClick={e => e.stopPropagation()}>
                                    <div
                                        onClick={() => { setSelectedStatuses([]); setStatusDropdownOpen(false); }}
                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-[11px] font-bold border-b border-gray-50"
                                    >
                                        <span className={selectedStatuses.length === 0 ? "text-primary" : "text-gray-600"}>ALL STATUSES</span>
                                        {selectedStatuses.length === 0 && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    {statusOptions.map((opt: string) => (
                                        <div key={opt} onClick={() => { setSelectedStatuses([opt]); setStatusDropdownOpen(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-[11px] font-bold border-b border-gray-50 last:border-b-0">
                                            <span className={selectedStatuses.includes(opt) ? "text-primary" : "text-gray-600"}>{opt}</span>
                                            {selectedStatuses.includes(opt) && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setTypeDropdownOpen(!typeDropdownOpen); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 transition-all relative shadow-sm"
                        >
                            <Activity className="w-3.5 h-3.5" />
                            <span>{selectedTypes.length === 1 ? selectedTypes[0] : `Type (${selectedTypes.length})`}</span>
                            {typeDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl py-1 min-w-[200px] z-50 overflow-hidden" onClick={e => e.stopPropagation()}>
                                    <div
                                        onClick={() => { setSelectedTypes([]); setTypeDropdownOpen(false); }}
                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-[11px] font-bold border-b border-gray-50"
                                    >
                                        <span className={selectedTypes.length === 0 ? "text-blue-500" : "text-gray-600"}>ALL TYPES</span>
                                        {selectedTypes.length === 0 && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                    </div>
                                    {typeOptions.map((opt: string) => (
                                        <div key={opt} onClick={() => { setSelectedTypes([opt]); setTypeDropdownOpen(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-[11px] font-bold border-b border-gray-50 last:border-b-0">
                                            <span className={selectedTypes.includes(opt) ? "text-blue-500" : "text-gray-600"}>{opt}</span>
                                            {selectedTypes.includes(opt) && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-gray-50 border border-gray-100 rounded-xl p-1 shadow-sm">
                            <button
                                onClick={() => setTimezone('IST')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                    timezone === 'IST' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                IST
                            </button>
                            <button
                                onClick={() => setTimezone('PST')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                                    timezone === 'PST' ? "bg-white text-blue-500 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                PST
                            </button>
                        </div>
                        <button
                            onClick={onRefresh}
                            className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-100 transition-all hover:rotate-180 duration-500 shadow-sm"
                            title="Refresh Table Data"
                        >
                            <RefreshCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={resetSorting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 transition-all shadow-sm"
                            title="Auto-size / Reset Sorting"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Auto-size</span>
                        </button>
                        <button onClick={onHistoryOpen} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 shadow-sm transition-all hover:scale-105">
                            <History className="w-4 h-4 text-blue-500" />
                            <span>Resolution History</span>
                        </button>
                        <button
                            onClick={runAnalysis}
                            disabled={isAnalyzing}
                            className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isAnalyzing ? "Analyzing..." : "✨ Analyse Top 5"}
                        </button>
                    </div>
                </div>
            </div>


            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-[#fcfdfe]">
                            {visibleColumns.map((col: any) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        "px-8 py-6 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] border-b border-gray-50",
                                        col.sortable && "cursor-pointer hover:text-gray-600 transition-colors",
                                        col.key === 'diagnosis.status' && "min-w-[180px]"
                                    )}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        {col.sortable && sortBy === col.key && (
                                            <span className="text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {displayedData.map((row: any) => (
                            <tr key={row.doc_id} className="hover:bg-[#f8fbff]/50 transition-colors group">
                                {visibleColumns.map((col: any) => (
                                    <td key={col.key} className="px-8 py-6 text-sm">
                                        {col.key === 'inspect' ? (
                                            <button
                                                onClick={() => setInspectingId(row.doc_id)}
                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-primary/10 rounded-lg text-primary transition-all group/btn"
                                            >
                                                <Activity className="w-4 h-4" />
                                                <span className="text-[11px] font-black uppercase tracking-wider group-hover/btn:underline decoration-2 underline-offset-4">Inspect</span>
                                            </button>
                                        ) : col.key === 'diagnosis.status' ? (
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={row['diagnosis.status']}
                                                    onChange={(e) => handleStatusChange(row.doc_id, e.target.value.toUpperCase())}
                                                    disabled={updating === row.doc_id}
                                                    className={cn(
                                                        "text-[10px] font-bold uppercase py-1 px-3 rounded-full border transition-all outline-none appearance-none cursor-pointer",
                                                        getStatusColor(row['diagnosis.status'])
                                                    )}
                                                >
                                                    {statusOptions.map((opt: string) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                                {updating === row.doc_id && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                                            </div>
                                        ) : col.key === 'last_seen' ? (
                                            <div className="whitespace-nowrap font-bold text-[11px] text-gray-900 border border-gray-100 bg-gray-50/30 px-3 py-1.5 rounded-lg shadow-sm">
                                                {(() => {
                                                    const date = new Date(row[col.key]);
                                                    const options: Intl.DateTimeFormatOptions = {
                                                        timeZone: timezone === 'IST' ? 'Asia/Kolkata' : 'America/Los_Angeles',
                                                        day: '2-digit', month: 'short',
                                                        hour: '2-digit', minute: '2-digit', hour12: true
                                                    };
                                                    return `${timezone}: ${date.toLocaleString(timezone === 'IST' ? 'en-IN' : 'en-US', options)}`;
                                                })()}
                                            </div>
                                        ) : col.key === 'count' ? (
                                            <span className="font-black text-gray-900">{row[col.key]?.toLocaleString()}</span>
                                        ) : (
                                            <span className="font-bold text-gray-700 truncate max-w-[200px] block">{row[col.key] || 'N/A'}</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* Table Loading Overlay */}
                {loading && (
                     <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 h-full min-h-[200px]">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Updating Results...</span>
                        </div>
                    </div>
                )}
            </div>

            {
                totalCount > visibleCount && (
                    <div className="p-8 border-t border-gray-50 bg-[#fcfdfe] text-center">
                        <button
                            onClick={onShowMore}
                            className="px-8 py-3 bg-white border border-gray-100 rounded-2xl text-[11px] font-black text-gray-500 uppercase tracking-widest hover:border-primary/20 hover:text-primary hover:shadow-lg transition-all active:scale-95 flex items-center gap-3 mx-auto"
                        >
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>Show More Groups ({totalCount > visibleCount ? totalCount - visibleCount : 0} remaining)</span>
                        </button>
                    </div>
                )
            }
        </div >
    );
});

export default Dashboard;