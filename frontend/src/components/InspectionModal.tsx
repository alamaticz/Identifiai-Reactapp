import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { Activity, Info, AlertTriangle, FileText, CheckCircle, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../pages/Dashboard'; // Basic utility, acceptable reuse check

interface InspectionModalProps {
    docId: string;
    onClose: () => void;
}

const InspectionModal: React.FC<InspectionModalProps> = ({ docId, onClose }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await axios.get(API_ENDPOINTS.LOG_GROUP(docId));
                setData(response.data);
            } catch (err) {
                console.error("Failed to fetch log details, using mock fallback", err);
                // Mock fallback for UI testing
                setData({
                    group: {
                        'diagnosis.report': "This error is likely caused by a timeout in the downstream activity 'ProcessInvoice'. The logs show repeated connection attempts failing with 504 Gateway Timeout. Fix: Increase the timeout value in the worker configuration or check the ProcessInvoice service health.",
                        representative_log: { logger_name: 'com.alamaticz.billing.Worker' }
                    },
                    samples: [
                        {
                            timestamp: '2024-03-12 10:45:22',
                            level: 'ERROR',
                            logger_name: 'com.alamaticz.billing.Worker',
                            message: 'FAILED to process invoice INV-9902: TimeoutException after 30000ms',
                            exception_type: 'TimeoutException',
                            exception_message: 'java.util.concurrent.TimeoutException: Remote service did not respond within 30s',
                            stack_trace: ['at com.alamaticz.billing.Worker.process(Worker.java:45)', 'at com.alamaticz.billing.Main.loop(Main.java:12)'],
                            log: { message: 'FAILED to process invoice INV-9902: TimeoutException after 30000ms' }
                        }
                    ]
                });
            } finally {
                setLoading(false);
            }
        };

        if (docId) fetchDetails();

        // Disable body scroll when modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [docId]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center space-y-4">
                    <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
                    <p className="text-gray-500 font-medium">Loading inspection details...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { group, samples } = data;

    // Helper to extract safe rule name
    const getDisplayRule = (g: any) => {
        if (g.group_type === 'RuleSequence' && g.group_signature) {
            const parts = g.group_signature.split('->');
            if (parts.length >= 2) return parts[1];
        }
        return g.representative_log?.logger_name || 'N/A';
    };

    const displayRule = getDisplayRule(group);

    return (
        <div
            className={cn(
                "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200",
                isFullScreen ? "p-0" : "p-4 sm:p-6"
            )}
            onClick={onClose}
        >
            <div
                className={cn(
                    "bg-[#f8f9fa] shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
                    isFullScreen ? "w-full h-full rounded-none" : "w-full max-w-5xl max-h-[90vh] rounded-3xl border border-gray-200"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-white px-4 sm:px-8 py-4 sm:py-5 border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center space-x-3 sm:space-x-4 overflow-hidden">
                        <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
                            <Info className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-black text-[#0f172a] truncate">Inspection: {displayRule}</h2>
                            <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest truncate">ID: {docId}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
                        {/* AI Diagnosis Report Section */}
                        {(() => {
                            const report = group['diagnosis.report'] || group.diagnosis?.report || "No AI diagnosis report available.";

                            // Try to parse the report into Summary and Fix sections
                            const sections = report.split(/Fix:|Resolution Step:|Steps to Resolution:/i);
                            const summary = sections[0].trim();
                            const fix = sections.length > 1 ? sections[1].trim() : null;

                            return (
                                <div className="bg-white p-8 rounded-2xl border border-gray-200/60 shadow-sm relative overflow-hidden">
                                    <div className="absolute -right-6 -top-6 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl"></div>

                                    <div className="relative z-10 space-y-6">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-50 p-1.5 rounded-lg">
                                                <Activity className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-wider">AI Diagnosis Report</h3>
                                        </div>

                                        <div className="prose prose-sm max-w-none text-gray-700">
                                            <div className="mb-6">
                                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Analysis Summary</h4>
                                                <p className="text-sm leading-relaxed font-medium bg-gray-50/50 p-4 rounded-xl border border-gray-100 italic">
                                                    {summary}
                                                </p>
                                            </div>

                                            {fix && (
                                                <div>
                                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        Recommended Action Plan
                                                    </h4>
                                                    <div className="bg-blue-50/30 p-4 sm:p-6 rounded-2xl border border-blue-100/50 space-y-4">
                                                        {fix.split('\n').filter((line: string) => line.trim()).map((line: string, i: number) => (
                                                            <div key={i} className="flex gap-4">
                                                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">
                                                                    {i + 1}
                                                                </span>
                                                                <p className="text-sm font-bold text-[#0f172a] pt-0.5">{line.replace(/^\d+\.\s*/, '')}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Logs Detail Section */}
                        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden flex flex-col">
                            {/* Tabs Header */}
                            <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3 flex space-x-2 overflow-x-auto custom-scrollbar">
                                {samples?.map((_: any, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveTab(idx)}
                                        className={cn(
                                            "px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap border shadow-sm",
                                            activeTab === idx
                                                ? 'bg-white border-primary/20 text-primary scale-105 z-10'
                                                : 'bg-gray-100/50 border-transparent text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'
                                        )}
                                    >
                                        LOG SAMPLE {idx + 1}
                                    </button>
                                ))}
                            </div>

                            <div className="p-4 sm:p-8 bg-[#fcfcfc] min-h-[400px]">
                                {samples && samples[activeTab] ? (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400" key={activeTab}>
                                        {/* Log Entry Context */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Timestamp</p>
                                                <p className="text-sm font-bold text-[#0f172a]">{samples[activeTab].timestamp || 'N/A'}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Level</p>
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                                    samples[activeTab].level === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                                )}>
                                                    {samples[activeTab].level || 'ERROR'}
                                                </span>
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Logger</p>
                                                <p className="text-sm font-bold text-blue-600 truncate">{samples[activeTab].logger_name || 'N/A'}</p>
                                            </div>
                                        </div>

                                        {/* Main Message Block */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <FileText className="w-4 h-4 text-gray-400" />
                                                <h4 className="text-xs font-black text-[#0f172a] uppercase tracking-wider">Log Message Preview</h4>
                                            </div>
                                            <div className="bg-[#f1f5f9] p-6 rounded-2xl border border-gray-200 text-xs font-mono text-gray-700 shadow-inner overflow-x-auto leading-relaxed border-l-4 border-l-gray-400">
                                                {samples[activeTab].log?.message || samples[activeTab].message || "No message content"}
                                            </div>
                                        </div>

                                        {/* Exception - Red Style */}
                                        {samples[activeTab].exception_message && samples[activeTab].exception_message !== 'N/A' && (
                                            <div className="animate-in slide-in-from-left-4 duration-500">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                                    <h4 className="text-xs font-black text-red-600 uppercase tracking-wider">Critical Exception Trace</h4>
                                                </div>
                                                <div className="bg-[#fff5f5] p-4 sm:p-6 rounded-2xl border border-[#feb2b2] text-xs font-mono text-[#c53030] shadow-sm leading-relaxed border-l-4 border-l-red-600">
                                                    <p className="font-black mb-2">{samples[activeTab].exception_type || 'Exception'}</p>
                                                    {samples[activeTab].exception_message}
                                                </div>
                                            </div>
                                        )}

                                        {/* Stack Trace Expander */}
                                        {samples[activeTab].stack_trace && samples[activeTab].stack_trace.length > 0 && (
                                            <div className="pt-2">
                                                <details className="group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-all">
                                                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-gray-800 p-1.5 rounded-lg">
                                                                <Maximize2 className="w-3.5 h-3.5 text-white" />
                                                            </div>
                                                            <span className="text-[11px] font-black text-[#0f172a] uppercase tracking-widest">View Detailed Stack Trace</span>
                                                        </div>
                                                        <div className="text-gray-400 group-open:rotate-180 transition-transform">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </summary>
                                                    <div className="p-6 bg-[#1e1e1e] border-t border-gray-800">
                                                        <div className="text-[10px] font-mono text-gray-300 overflow-y-auto max-h-[400px] custom-scrollbar leading-loose whitespace-pre-wrap">
                                                            {Array.isArray(samples[activeTab].stack_trace)
                                                                ? samples[activeTab].stack_trace.join('\n')
                                                                : String(samples[activeTab].stack_trace)}
                                                        </div>
                                                    </div>
                                                </details>
                                            </div>
                                        )}

                                        {/* Raw Data Accordion */}
                                        <div className="pt-4 mt-8 border-t border-gray-100">
                                            <details className="group">
                                                <summary className="flex items-center cursor-pointer text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors select-none">
                                                    <div className="w-5 h-5 bg-gray-100 rounded-lg flex items-center justify-center mr-3 text-gray-400 group-open:bg-primary/10 group-open:text-primary transition-all">
                                                        <Maximize2 className="w-2.5 h-2.5" />
                                                    </div>
                                                    Full Payload Metadata
                                                </summary>
                                                <div className="mt-6 bg-gray-50 p-4 sm:p-6 rounded-2xl text-[10px] font-mono text-gray-500 overflow-x-auto shadow-inner border border-gray-100">
                                                    <pre className="custom-scrollbar">{JSON.stringify(samples[activeTab], null, 2)}</pre>
                                                </div>
                                            </details>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-300 py-32">
                                        <Info className="w-16 h-16 mb-4 opacity-10" />
                                        <p className="text-sm font-black uppercase tracking-widest">Select a log sample to begin deep dive</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InspectionModal;
