import React, { useEffect, useState } from 'react';
import axios from 'axios';
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
                const response = await axios.get(`http://localhost:8000/api/logs/group/${docId}`);
                setData(response.data);
            } catch (err) {
                console.error("Failed to fetch log details", err);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className={cn(
                    "bg-[#f8f9fa] rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300",
                    isFullScreen ? "w-full h-full rounded-none" : "w-full max-w-5xl max-h-[90vh]"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-white px-8 py-5 border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center space-x-4">
                        <div className="bg-primary/10 p-2 rounded-xl text-primary">
                            <Info className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[#0f172a]">Detailed Inspection</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">ID: {docId}</p>
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
                <div className="overflow-y-auto p-8 space-y-8 custom-scrollbar">

                    {/* Unified Analysis Card */}
                    {(() => {
                        const status = group['diagnosis.status'] || group.diagnosis?.status || 'PENDING';
                        const report = group['diagnosis.report'] || group.diagnosis?.report || "No AI diagnosis report available.";

                        return (
                            <div className="bg-white p-8 rounded-2xl border border-gray-200/60 shadow-sm relative overflow-hidden">
                                {/* Decorative Background */}
                                <div className="absolute -right-6 -top-6 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl"></div>
                                <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>

                                <div className="relative z-10 space-y-8">
                                    {/* Primary Metadata */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Row Rule / Source</p>
                                                <p className="text-xl font-bold text-[#0f172a] leading-tight">{displayRule || group.display_rule || 'N/A'}</p>
                                            </div>
                                            <div className="flex gap-10">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Group Type</p>
                                                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-black uppercase tracking-wide">
                                                        {group.group_type || group['group_type'] || 'LOG'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Logs in Group</p>
                                                    <span className="text-xl font-black text-[#0f172a]">{group.count || group['count'] || '0'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Signature</p>
                                            <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-100/80 shadow-inner">
                                                <code className="text-[11px] text-gray-600 break-all font-mono leading-relaxed">
                                                    {group.group_signature || group['group_signature'] || 'No signature available'}
                                                </code>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Diagnosis Status Section */}
                                    <div className="pt-6 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Diagnosis Status</p>
                                                <div className="flex items-center space-x-4">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-full flex items-center justify-center shadow-md",
                                                        status === 'RESOLVED' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                                                    )}>
                                                        {status === 'RESOLVED' ? <CheckCircle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                                                    </div>
                                                    <div>
                                                        <span className="text-xl font-black text-[#0f172a] block">{status}</span>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Current Resolution State</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Insight Section - Now under Status */}
                                    <div className="pt-6 border-t border-gray-100">
                                        <div className="flex items-center gap-2 mb-4">
                                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Insight Report</p>
                                        </div>

                                        <div className="bg-yellow-50/30 p-6 rounded-2xl border border-yellow-100/50 shadow-sm">
                                            <p className="text-[13px] text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
                                                {report}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Logs Viewer */}
                <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg overflow-hidden flex flex-col min-h-[400px]">
                    <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3 flex space-x-2 overflow-x-auto">
                        {samples?.map((_: any, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap border",
                                    activeTab === idx
                                        ? 'bg-white border-gray-200 text-primary shadow-sm'
                                        : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                )}
                            >
                                Log Sample {idx + 1}
                            </button>
                        ))}
                        {(!samples || samples.length === 0) && (
                            <div className="px-4 py-2 text-xs text-gray-400 italic font-medium">No sample logs available</div>
                        )}
                    </div>

                    <div className="p-6 bg-[#fcfcfc] flex-1">
                        {samples && samples[activeTab] ? (
                            <div className="space-y-6 animate-in slide-in-from-right-2 duration-300" key={activeTab}>
                                {/* Message */}
                                <div>
                                    <h4 className="text-xs font-black text-[#0f172a] mb-2 flex items-center gap-2 uppercase tracking-wide">
                                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                                        Log Message
                                    </h4>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 text-xs font-mono text-gray-600 shadow-sm overflow-x-auto leading-relaxed">
                                        {samples[activeTab].log?.message || samples[activeTab].message || "No message content"}
                                    </div>
                                </div>

                                {/* Exception */}
                                {samples[activeTab].exception_message && samples[activeTab].exception_message !== 'N/A' && (
                                    <div>
                                        <h4 className="text-xs font-black text-red-600 mb-2 flex items-center gap-2 uppercase tracking-wide">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Exception
                                        </h4>
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-xs font-mono text-red-700 shadow-sm leading-relaxed">
                                            {samples[activeTab].exception_message}
                                        </div>
                                    </div>
                                )}

                                {/* Stack Trace */}
                                {samples[activeTab].stack_trace && samples[activeTab].stack_trace.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-black text-[#0f172a] mb-2 uppercase tracking-wide">Stack Trace</h4>
                                        <div className="bg-[#1e1e1e] p-4 rounded-xl border border-gray-800 text-[10px] font-mono text-gray-300 shadow-inner max-h-[300px] overflow-y-auto custom-scrollbar leading-loose">
                                            {Array.isArray(samples[activeTab].stack_trace)
                                                ? samples[activeTab].stack_trace.join('\n')
                                                : JSON.stringify(samples[activeTab].stack_trace, null, 2)}
                                        </div>
                                    </div>
                                )}

                                {/* Raw JSON */}
                                <div className="pt-2">
                                    <details className="group">
                                        <summary className="flex items-center cursor-pointer text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors select-none">
                                            <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center mr-2 text-gray-500 group-open:bg-primary group-open:text-white transition-all">
                                                <Maximize2 className="w-2.5 h-2.5" />
                                            </div>
                                            Show Full Raw JSON
                                        </summary>
                                        <div className="mt-4 bg-gray-100 p-4 rounded-xl text-[10px] font-mono text-gray-600 overflow-x-auto shadow-inner border border-gray-200">
                                            <pre>{JSON.stringify(samples[activeTab], null, 2)}</pre>
                                        </div>
                                    </details>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 py-20">
                                <Info className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold">Select a log sample to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InspectionModal;
