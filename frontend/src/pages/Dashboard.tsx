import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import InspectionModal from '../components/InspectionModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { FileText, Clock, Activity } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const COLORS = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5'];

const Dashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<any>(null);
    const [logLevels, setLogLevels] = useState<any[]>([]);
    const [diagnosisStatus, setDiagnosisStatus] = useState<any[]>([]);
    const [tableData, setTableData] = useState<any[]>([]);
    const [topErrors, setTopErrors] = useState<any[]>([]);
    const [trends, setTrends] = useState<any[]>([]);
    const [statusOptions, setStatusOptions] = useState<string[]>(["PENDING", "IN PROCESS", "RESOLVED", "FALSE POSITIVE", "IGNORE", "COMPLETED"]);
    const [typeOptions, setTypeOptions] = useState<string[]>(["Exception", "RuleSequence", "CSP Violation", "Logger", "Pega Engine Errors"]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
    const [inspectingId, setInspectingId] = useState<string | null>(null);

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
            setTopErrors(topRes.data.map((item: any) => ({
                ...item,
                displayName: item['Group Signature']?.length > 40 ? item['Group Signature'].substring(0, 40) + '...' : item['Group Signature']
            })));
            setTrends(trendRes.data);
            setStatusOptions(optionsRes.data);
            setTypeOptions(typeRes.data);
        } catch (err) {
            console.warn("Backend not detected, using high-fidelity mock data for UI preview.");

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
                { doc_id: '1', last_seen: new Date().toISOString(), group_signature: 'com.pega.pegarules.pub.PRRuntimeException: Section execution terminated', group_type: 'Exception', count: 142, 'diagnosis.status': 'PENDING', display_rule: 'Data-Admin-Operator-ID' },
                { doc_id: '2', last_seen: new Date(Date.now() - 3600000).toISOString(), group_signature: 'Database-Lock-Failure-Timeout: Unable to acquire lock on CASE-1234', group_type: 'LogMessage', count: 89, 'diagnosis.status': 'IN PROCESS', display_rule: 'Work-Case-Review' },
                { doc_id: '3', last_seen: new Date(Date.now() - 7200000).toISOString(), group_signature: 'Step status fail: Service REST invocation failed with 500 Internal Server Error', group_type: 'RuleSequence', count: 67, 'diagnosis.status': 'PENDING', display_rule: 'Pega-Int-Connector' },
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

    const handleStatusChange = async (docId: string, newStatus: string) => {
        setUpdating(docId);
        try {
            const formData = new FormData();
            formData.append('doc_id', docId);
            formData.append('status', newStatus);

            await axios.post(API_ENDPOINTS.UPDATE_STATUS, formData);
            await fetchData();
        } catch (err) {
            console.error("Failed to update status", err);
            alert("Failed to update status. Please try again.");
        } finally {
            setUpdating(null);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

    const handleColumnMenuClick = (column: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenColumnMenu(openColumnMenu === column ? null : column);
    };

    const filteredTableData = tableData.filter(row => {
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(row['diagnosis.status']);
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(row['group_type']);
        return matchesStatus && matchesType;
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const response = await axios.post(API_ENDPOINTS.TRIGGER_ANALYSIS);
            alert(response.data.message);
            fetchData(); // Refresh data to see new reports
        } catch (error: any) {
            console.error("Analysis error:", error);
            alert("Analysis failed: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsAnalyzing(false);
        }
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
            <div className="flex items-center justify-between pb-2">
                <h2 className="text-3xl font-black text-text-primary flex items-center space-x-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-border">
                        <Activity className="w-8 h-8 text-primary" />
                    </div>
                    <span>Pega Log Analysis Dashboard</span>
                </h2>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-4 gap-6">
                {[
                    { label: 'Total Errors', value: metrics?.total_errors, color: 'bg-metrics-errors' },
                    { label: 'Unique Issues', value: metrics?.unique_issues, color: 'bg-metrics-unique' },
                    { label: 'Top Rule Failure', value: metrics?.most_frequent, sub: true, color: 'bg-metrics-failure' },
                    { label: 'Recent Ingestion', value: metrics?.last_incident, color: 'bg-metrics-ingestion' },
                ].map((m, i) => (
                    <div key={i} className={`${m.color} p-6 rounded-2xl shadow-md hover:shadow-lg transition-all border border-primary-light/10 group relative overflow-hidden`}>
                        {/* Subtle pattern or gradient overlay for professional look */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-6 -mt-6 transition-all group-hover:bg-white/10"></div>

                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <p className="text-sm font-bold text-primary-light uppercase tracking-tight">{m.label}</p>
                        </div>
                        <p className={cn("font-black text-white truncate relative z-10", m.sub ? "text-sm mt-3 text-gray-200" : "text-4xl mt-1")}>
                            {m.value || '0'}
                        </p>
                    </div>
                ))}
            </div>

            {/* Main Data Table */}
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-8 px-2">
                    <div className="space-y-3">
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

                <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                    <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xl font-extrabold text-[#31333f] flex items-center space-x-3">
                                <FileText className="w-8 h-8 text-primary bg-[#f8f9fa] p-1.5 rounded-lg" />
                                <span>Detailed Group Analysis</span>
                            </h3>
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

                            <div className="text-[11px] text-gray-400 font-black uppercase tracking-[0.2em] hidden sm:block">
                                {filteredTableData.length} GROUPS
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm border-b border-gray-100">
                                <tr>
                                    {['Inspect', 'Last Seen', 'Full Signature', 'Type', 'Count', 'Status', 'Rule Name', 'Log Message', 'Logger', 'Exception Info', 'Report'].map((header, idx) => (
                                        <th key={header} className="px-8 py-5 text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] group cursor-pointer relative">
                                            <div className="flex items-center justify-between">
                                                <span>{header}</span>
                                                <div className="relative">
                                                    <svg
                                                        className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer text-gray-800"
                                                        fill="currentColor"
                                                        viewBox="0 0 16 16"
                                                        onClick={(e) => handleColumnMenuClick(header, e)}
                                                    >
                                                        <circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" />
                                                    </svg>
                                                    {openColumnMenu === header && (
                                                        <div className={cn(
                                                            "absolute top-8 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50",
                                                            idx <= 2 ? "left-0" : "right-0"
                                                        )}>
                                                            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                                                                <span className="text-sm font-bold text-gray-800">{header}</span>
                                                                <div className="flex items-center space-x-1">
                                                                    <button className="p-1 hover:bg-gray-50 rounded">
                                                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                                                        </svg>
                                                                    </button>
                                                                    <button className="p-1 hover:bg-gray-50 rounded">
                                                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                                                </svg>
                                                                <span>Sort ascending</span>
                                                            </button>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                                                                </svg>
                                                                <span>Sort descending</span>
                                                            </button>
                                                            <div className="border-t border-gray-50 my-1"></div>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                                                </svg>
                                                                <span>Format</span>
                                                                <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </button>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                                                </svg>
                                                                <span>Autosize</span>
                                                            </button>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                                                </svg>
                                                                <span>Pin column</span>
                                                            </button>
                                                            <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                </svg>
                                                                <span>Hide column</span>
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
                                {filteredTableData.map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-gray-50/50 transition-colors border-l-4 border-l-transparent hover:border-l-[#ee4a4a]">
                                        <td className="px-8 py-5 text-center">
                                            <button
                                                onClick={() => setInspectingId(row['doc_id'])}
                                                className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all",
                                                    inspectingId === row['doc_id']
                                                        ? "bg-[#ee4a4a] text-white shadow-lg shadow-red-200 scale-105"
                                                        : "text-[#ee4a4a] hover:bg-red-50"
                                                )}
                                            >
                                                Inspect
                                            </button>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800">{formatDate(row['last_seen']).split(',')[0]}</span>
                                                <span className="text-[11px] font-bold text-gray-400 tracking-tight">{formatDate(row['last_seen']).split(',')[1]}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="max-w-[200px]">
                                                <p className="text-sm font-semibold text-gray-800 truncate" title={row['group_signature']}>
                                                    {row['group_signature']}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-100">
                                                {row['group_type']}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
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
                                        <td className="px-8 py-5">
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
                                        {/* Rule Name */}
                                        <td className="px-8 py-5">
                                            <div className="max-w-[150px]">
                                                <p className="text-sm font-semibold text-gray-800 truncate" title={row['display_rule'] !== 'N/A' ? row['display_rule'] : row['logger_name']}>
                                                    {row['display_rule'] !== 'N/A' ? row['display_rule'] : row['logger_name']}
                                                </p>
                                            </div>
                                        </td>
                                        {/* Log Message */}
                                        <td className="px-8 py-5">
                                            <div className="max-w-[200px]">
                                                <p className="text-sm font-medium text-gray-500 line-clamp-2" title={row['message_summary']}>
                                                    {row['message_summary']}
                                                </p>
                                            </div>
                                        </td>
                                        {/* Logger */}
                                        <td className="px-8 py-5">
                                            <div className="max-w-[150px]">
                                                <p className="text-sm font-medium text-gray-500 truncate" title={row['logger_name']}>
                                                    {row['logger_name']}
                                                </p>
                                            </div>
                                        </td>
                                        {/* Exception Info */}
                                        <td className="px-8 py-5">
                                            <div className="max-w-[300px]">
                                                <p className="text-sm font-medium text-gray-500 line-clamp-2" title={row['exception_summary']}>
                                                    {row['exception_summary']}
                                                </p>
                                            </div>
                                        </td>
                                        {/* Report */}
                                        <td className="px-8 py-5">
                                            <div className="max-w-[200px]">
                                                <p className="text-sm font-medium text-gray-500 line-clamp-2" title={row['diagnosis.report']}>
                                                    {row['diagnosis.report']}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Analytics Section */}
            <div className="pt-6 space-y-8">
                <div className="flex items-center space-x-3">
                    <span className="h-px bg-border flex-1"></span>
                    <h3 className="text-2xl font-black text-text-primary uppercase tracking-tighter">Diagnostic Analytics</h3>
                    <span className="h-px bg-border flex-1"></span>
                </div>

                <div className="grid grid-cols-2 gap-10">
                    <div className="bg-white p-10 rounded-[40px] border border-border shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-light/20 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                        <h4 className="text-lg font-black text-text-primary mb-10 flex items-center space-x-2">
                            <div className="w-2 h-6 bg-primary rounded-full"></div>
                            <span>Log Level Distribution</span>
                        </h4>
                        <div className="h-[300px] min-h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={logLevels}
                                        innerRadius={90}
                                        outerRadius={120}
                                        paddingAngle={8}
                                        dataKey="doc_count"
                                        nameKey="key"
                                        stroke="none"
                                    >
                                        {logLevels.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[40px] border border-border shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-warning/20 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                        <h4 className="text-lg font-black text-text-primary mb-10 flex items-center space-x-2">
                            <div className="w-2 h-6 bg-warning rounded-full"></div>
                            <span>Diagnosis Status Mapping</span>
                        </h4>
                        <div className="h-[300px] min-h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={diagnosisStatus}
                                        innerRadius={90}
                                        outerRadius={120}
                                        paddingAngle={8}
                                        dataKey="doc_count"
                                        nameKey="key"
                                        stroke="none"
                                    >
                                        {diagnosisStatus.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Top Error Groups Section */}
                <div className="bg-white p-10 rounded-[40px] border border-border shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-warning/20 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                    <h4 className="text-xl font-black text-text-primary mb-12 flex items-center space-x-3">
                        <div className="w-2 h-8 bg-warning rounded-full"></div>
                        <span>Top Error Groups Breakdown</span>
                    </h4>
                    <div className="h-[400px] min-h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topErrors} layout="vertical" margin={{ left: 150 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="displayName"
                                    type="category"
                                    tick={{ fontSize: 11, fontWeight: 'bold', fill: '#4b5563' }}
                                    width={140}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f9fafb' }}
                                />
                                <Bar
                                    dataKey="Count"
                                    fill="#F4C95D"
                                    radius={[0, 10, 10, 0]}
                                    barSize={40}
                                />
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
                    </div>
                    <div className="h-[400px] min-h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trends}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0F3D2E" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#0F3D2E" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="Time"
                                    tick={{ fontSize: 11, fontWeight: 'bold', fill: '#9ca3af' }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fontWeight: 'bold', fill: '#9ca3af' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Count"
                                    stroke="#0F3D2E"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                />
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
        </div>
    );
};

export default Dashboard;
