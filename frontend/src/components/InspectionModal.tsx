import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
    Info,
    X,
    Maximize2,
    Minimize2,
    ChevronDown,
    ChevronRight,
    Rocket,
    Bot,
    User,
    FileText,
    Copy,
    AlertTriangle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import RuleSequenceViewer from './RuleSequenceViewer';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InspectionModalProps {
    docId: string;
    onClose: () => void;
}

const DEFAULT_PROMPT = `You are a Senior Pega Lead System Architect (LSA) analyzing an error group from a Pega Application.

Data Provided:
{context_str}

Perform a deep technical diagnosis and output a report in CLEAN PLAIN TEXT format. 
DO NOT USE MARKDOWN (No #, *, or backticks). Use simple upper case for headers.

Sections:

1. EXECUTIVE SUMMARY
(One concise sentence describing the issue)

2. SEVERITY ASSESSMENT
(CRITICAL / MAJOR / MINOR) - Justify your choice based on the error type.

3. ERROR FLOW & POINT OF FAILURE
Execution Path: Analyze the \`group_signature\`. Reconstruct the call stack (e.g., "Activity A calls Activity B").
Point of Failure: Identify the EXACT Rule or Step where the error occurred.

4. ROOT CAUSE ANALYSIS
Explain *why* this error happened. Connect the Exception message to the specific Rule context.

5. IMPACT ANALYSIS
What functional part of the system is likely broken?

6. STEP-BY-STEP RESOLUTION
Provide concrete, Pega-specific steps for a developer to fix this.
Debugging: Mention specific tools (e.g., "Run Tracer on Activity X").
Fix: Suggest code changes (e.g., "Add a null check in Step 2").`;

interface LogGroupData {
    doc_id: string;
    group_type: string;
    group_signature: string;
    count: number;
    "diagnosis.report"?: string;
    diagnosis?: {
        status?: string;
        report?: string;
    };
    representative_log?: {
        message: string;
    };
    comments?: string;
    [key: string]: unknown;
}

interface LogSample {
    log?: {
        message?: string;
    };
    message?: string;
    exception_message?: string;
    [key: string]: any;
}

interface InspectionData {
    group: LogGroupData;
    samples: LogSample[];
    context: any;
}

const InspectionModal: React.FC<InspectionModalProps> = ({ docId, onClose }) => {
    const { user } = useAuth();
    const [data, setData] = useState<InspectionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [runningDiagnosis, setRunningDiagnosis] = useState(false);
    const [status, setStatus] = useState("PENDING");
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Accordion states
    const [showContext, setShowContext] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    // Comments & Chat
    const [comments, setComments] = useState("");
    const [isSavingComments, setIsSavingComments] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [isChatting, setIsChatting] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: string, content: string }[]>([
        { role: 'assistant', content: 'Hello! I have the context for this error group. You can ask me to explain the error or ask me to **update the analysis result** based on new information.' }
    ]);

    // Sample Logs Tab
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await axios.get(API_ENDPOINTS.LOG_GROUP(docId));
                setData(response.data);
                setStatus(response.data.group?.diagnosis?.status || "PENDING");
                setComments(response.data.group?.comments || "");
            } catch (err) {
                console.error("Failed to fetch log details", err);
            } finally {
                setLoading(false);
            }
        };

        if (docId) fetchDetails();
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, [docId]);

    const handleStatusChange = async (newStatus: string) => {
        setUpdatingStatus(true);
        try {
            const formData = new FormData();
            formData.append('doc_id', docId);
            formData.append('status', newStatus);
            formData.append('user', user?.email || user?.uid || 'Unknown');
            await axios.post(API_ENDPOINTS.UPDATE_STATUS, formData);
            setStatus(newStatus);
        } catch (err) {
            console.error("Failed to update status", err);
            alert("Failed to update status");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const saveComments = async () => {
        setIsSavingComments(true);
        try {
            const formData = new FormData();
            formData.append('doc_id', docId);
            formData.append('comments', comments);
            formData.append('user', user?.email || user?.uid || 'Unknown');
            await axios.post(API_ENDPOINTS.UPDATE_COMMENTS, formData);
        } catch (_e) {
            console.error("Failed to save comments", _e);
            alert("Failed to save comments");
        } finally {
            setIsSavingComments(false);
        }
    };

    const runDiagnosis = async () => {
        setRunningDiagnosis(true);
        try {
            const res = await axios.post(API_ENDPOINTS.DIAGNOSE_SINGLE(docId));
            if (res.data.success) {
                const refresh = await axios.get(API_ENDPOINTS.LOG_GROUP(docId));
                setData(refresh.data);
            } else {
                alert("Diagnosis failed: " + res.data.message);
            }
        } catch {
            alert("Diagnosis failed to trigger.");
        } finally {
            setRunningDiagnosis(false);
        }
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;
        const message = chatInput;
        setChatInput("");
        setIsChatting(true);

        // Optimistic UI
        setChatHistory(prev => [...prev, { role: 'user', content: message }]);

        try {
            // Send context to backend for AI awareness
            const res = await axios.post(API_ENDPOINTS.CHAT, {
                message,
                group_id: docId,
                context: formattedContext
            });
            setChatHistory(prev => [...prev, { role: 'assistant', content: res.data.response }]);
        } catch (_e) {
            console.error("Chat failed", _e);
            setChatHistory(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error connecting to the AI." }]);
        } finally {
            setIsChatting(false);
        }
    };

    if (loading) {
        return ReactDOM.createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    <p className="text-gray-500 font-medium text-sm">Loading details...</p>
                </div>
            </div>,
            document.body
        );
    }

    if (!data) return null;

    const { group, samples, context } = data;
    const diagnosisReport = group['diagnosis.report'] || group.diagnosis?.report;

    // Report Parsing Logic
    const sectionsMapping = [
        { label: 'EXECUTIVE SUMMARY', pattern: /1\.\s*EXECUTIVE\s+SUMMARY/i },
        { label: 'SEVERITY ASSESSMENT', pattern: /2\.\s*SEVERITY\s+ASSESSMENT/i },
        { label: 'ERROR FLOW & POINT OF FAILURE', pattern: /3\.\s*ERROR\s+FLOW\s+&\s+POINT\s+OF\s+FAILURE/i },
        { label: 'ROOT CAUSE ANALYSIS', pattern: /4\.\s*ROOT\s+CAUSE\s+ANALYSIS/i },
        { label: 'IMPACT ANALYSIS', pattern: /5\.\s*IMPACT\s+ANALYSIS/i },
        { label: 'STEP-BY-STEP RESOLUTION', pattern: /6\.\s*STEP-BY-STEP\s+RESOLUTION/i }
    ];

    const parseReport = (text: string) => {
        if (!text) return [];
        const parsed: { label: string, content: string }[] = [];
        const headers = sectionsMapping.map(s => s.pattern);
        const parts = text.split(new RegExp(`(${headers.map(h => h.source).join('|')})`, 'i'));

        if (parts.length > 1) {
            for (let i = 1; i < parts.length; i += 2) {
                const headerText = parts[i];
                const contentText = parts[i + 1]?.trim();
                const mapping = sectionsMapping.find(m => m.pattern.test(headerText));
                if (mapping && contentText) {
                    parsed.push({ label: mapping.label, content: contentText });
                }
            }
        } else {
            parsed.push({ label: 'Analysis Summary', content: text });
        }
        return parsed;
    };

    const parsedReport = parseReport(diagnosisReport || "");

    // Format serialized context for display
    const formattedContext = context ? (typeof context === 'string' ? context : JSON.stringify(context, null, 2)) : "No context available.";

    return ReactDOM.createPortal(
        <div className={cn(
            "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200",
            !isFullScreen && "p-4"
        )} onClick={onClose}>
            <div
                className={cn(
                    "bg-white flex flex-col overflow-hidden transition-all duration-300",
                    isFullScreen
                        ? "fixed inset-0 w-full h-full rounded-none z-[10000]"
                        : "w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                            <span className="text-xl">🔍</span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Detailed Group Inspection</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
                            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-6 lg:p-8 custom-scrollbar">

                    {/* Top Detail Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                        {/* Left: Info */}
                        <div className="lg:col-span-2 space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase mb-1">Rule/Message:</h3>
                                <p className="text-sm font-medium text-gray-600 break-words font-mono bg-gray-50 p-2 rounded border border-gray-200">
                                    {group.representative_log?.message || group.group_signature?.split('->')[1] || 'N/A'}
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase mb-1">Group Type:</h3>
                                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-md">
                                    {group.group_type}
                                </span>
                            </div>




                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase mb-1">Signature:</h3>
                                <div className="bg-white rounded-lg border border-gray-200 text-xs font-mono text-gray-600 relative group">
                                    <RuleSequenceViewer signature={group.group_signature} />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(group.group_signature || '')}
                                        className="absolute top-2 right-2 p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Copy Signature"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>


                        {/* Right: Count & Status */}
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
                                <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Total Count</h3>
                                <p className="text-4xl font-black text-blue-600 tracking-tight">{group.count?.toLocaleString()}</p>
                            </div>

                            <div>
                                <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Status</h3>
                                <select
                                    value={status}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    disabled={updatingStatus}
                                    className="w-full p-3 bg-gray-100 border-none rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500"
                                >
                                    {["PENDING", "IN PROCESS", "RESOLVED", "IGNORE", "DIAGNOSIS COMPLETED"].map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* AI Diagnosis Section */}
                    <div className="space-y-6 mb-8">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🧠</span>
                            <h3 className="text-lg font-bold text-gray-800">AI Diagnosis</h3>
                        </div>

                        {/* Context Accordion */}
                        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                            <button
                                onClick={() => setShowContext(!showContext)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                            >
                                {showContext ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                <div className="bg-blue-600 text-white p-1 rounded">
                                    <Info className="w-3 h-3" />
                                </div>
                                <span className="text-sm font-medium text-blue-600">View Analysis Context (Data sent to AI)</span>
                            </button>
                            {showContext && (
                                <div className="p-4 bg-gray-50 border-t border-gray-100">
                                    <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                                        {formattedContext}
                                    </pre>
                                </div>
                            )}
                        </div>

                        {/* Prompt Accordion */}
                        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                            <button
                                onClick={() => setShowPrompt(!showPrompt)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                            >
                                {showPrompt ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                <div className="bg-white border border-gray-200 text-gray-500 p-1 rounded">
                                    <FileText className="w-3 h-3" />
                                </div>
                                <span className="text-sm font-medium text-gray-600">Edit Diagnosis Prompt</span>
                            </button>
                            {showPrompt && (
                                <div className="p-4 bg-gray-50 border-t border-gray-100">
                                    <textarea
                                        className="w-full p-3 text-xs font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                                        rows={10}
                                        defaultValue={DEFAULT_PROMPT}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Diagnose Button */}
                        <button
                            onClick={runDiagnosis}
                            disabled={runningDiagnosis}
                            className="bg-[#ff4b4b] hover:bg-[#ff3333] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-red-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            {runningDiagnosis ? (
                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Rocket className="w-4 h-4" />
                            )}
                            Analyze & Diagnose
                        </button>
                    </div>

                    {/* Report Content */}
                    {diagnosisReport ? (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-500" />
                                <h3 className="text-sm font-bold text-gray-700">Diagnosis Report</h3>
                            </div>
                            <div className="p-6 md:p-8 space-y-8">
                                {parsedReport.map((section, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{section.label}</h4>
                                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                                            {section.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-8 text-center mb-8">
                            <p className="text-gray-400 font-medium text-sm">No diagnosis report generated yet.</p>
                        </div>
                    )}

                    {/* TWO-COLUMN BOTTOM: User Comments & AI Assistant */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                        {/* User Comments Section */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200/60 shadow-sm h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-lg">💬</span> User Comments
                                </h3>
                                {isSavingComments && <span className="text-xs text-gray-400 animate-pulse">Saving...</span>}
                            </div>
                            <textarea
                                className="w-full flex-1 min-h-[150px] p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none font-medium mb-3"
                                placeholder="Add notes or implementation details..."
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                            />
                            <div className="flex justify-start">
                                <button
                                    onClick={saveComments}
                                    disabled={isSavingComments}
                                    className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <span className="text-lg">💾</span> Save Comments
                                </button>
                            </div>
                        </div>

                        {/* AI Group Assistant (Chat) using Comments as workaround */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[350px]">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                                <Bot className="w-5 h-5 text-green-500" />
                                <h3 className="text-sm font-bold text-gray-700">AI Group Assistant</h3>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} className={cn("flex gap-4", msg.role === 'user' && "flex-row-reverse")}>
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", msg.role === 'assistant' ? "bg-orange-100" : "bg-blue-100")}>
                                            {msg.role === 'assistant' ? <Bot className="w-5 h-5 text-orange-500" /> : <User className="w-5 h-5 text-blue-600" />}
                                        </div>
                                        <div className={cn("space-y-1", msg.role === 'user' && "text-right")}>
                                            <p className="text-xs font-bold text-gray-400">{msg.role === 'assistant' ? 'Assistant' : 'You'}</p>
                                            <div className={cn("p-4 rounded-2xl text-sm leading-relaxed shadow-sm block", msg.role === 'assistant' ? "bg-gray-50 text-gray-700 rounded-tl-none" : "bg-blue-600 text-white rounded-tr-none text-left")}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                        placeholder="Ask the AI Assistant..."
                                        disabled={isChatting}
                                        className="w-full pl-4 pr-14 py-3 rounded-xl border-none shadow-sm bg-gray-100 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-400 disabled:opacity-50"
                                    />
                                    <button
                                        onClick={handleChatSubmit}
                                        disabled={!chatInput.trim() || isChatting}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-lg shadow-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-all"
                                    >
                                        {isChatting ? <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <Rocket className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sample Logs Section */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <h3 className="text-sm font-bold text-gray-700">Sample Logs</h3>
                        </div>

                        {/* Tabs Header */}
                        <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3 flex space-x-2 overflow-x-auto custom-scrollbar">
                            {samples?.map((_sample: LogSample, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveTab(idx)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                        activeTab === idx
                                            ? 'bg-white text-red-500 shadow-sm ring-1 ring-gray-100 border-b-2 border-red-500'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                    )}
                                >
                                    Log {idx + 1}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 bg-[#fcfcfc] min-h-[200px]">
                            {samples && samples[activeTab] ? (
                                <div className="space-y-6 animate-in fade-in duration-300" key={activeTab}>

                                    {/* Message Display */}
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 font-mono text-xs text-gray-600 leading-relaxed overflow-x-auto">
                                        {samples[activeTab].log?.message || samples[activeTab].message || "No message content"}
                                    </div>

                                    {/* Exception - Red Style */}
                                    {samples[activeTab].exception_message && samples[activeTab].exception_message !== 'N/A' && (
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 font-mono text-xs text-red-600 leading-relaxed shadow-sm flex gap-3">
                                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                            <div>
                                                <p className="font-bold mb-1">Exception:</p>
                                                {samples[activeTab].exception_message}
                                            </div>
                                        </div>
                                    )}

                                    {/* Raw Data Accordion */}
                                    <div className="pt-2">
                                        <details className="group">
                                            <summary className="flex items-center cursor-pointer text-xs font-bold text-gray-500 hover:text-gray-700 select-none">
                                                <ChevronRight className="w-4 h-4 mr-1 group-open:rotate-90 transition-transform" />
                                                Full JSON Metadata
                                            </summary>
                                            <div className="mt-4 bg-gray-900 p-6 rounded-xl text-[10px] font-mono text-blue-300 overflow-x-auto shadow-inner">
                                                <pre className="custom-scrollbar">{JSON.stringify(samples[activeTab], null, 2)}</pre>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 py-10">
                                    <p className="text-xs">No samples available.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>,
        document.body
    );
};

export default InspectionModal;
