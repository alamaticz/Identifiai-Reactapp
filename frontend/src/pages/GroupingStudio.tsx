import React, { useState, useEffect, useCallback, memo } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { Loader2, Search, Wand2, Save, Play, Check, X, AlertCircle, RefreshCcw, Maximize2 } from "lucide-react";

// --- Types ---
interface LogGroup {
    doc_id: string;
    display_rule: string;
    exception_summary: string;
    message_summary: string;
    group_type: string;
    "diagnosis.status": string;
    count: number;
    last_seen: string;
    logger_name: string;
    group_signature?: string;
    "diagnosis.report"?: string;
    assigned_user?: string;
}

// --- UI Components (Inline for portability) ---
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="px-6 py-4 border-b border-gray-100">{children}</div>
);

const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>
);

const CardDescription = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm text-gray-500 mt-1">{children}</p>
);

const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={`p-6 ${className}`}>{children}</div>
);

const Button = ({
    children, onClick, disabled, variant = "primary", size = "default", className
}: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: "primary" | "outline" | "ghost" | "secondary";
    size?: "default" | "sm" | "lg";
    className?: string;
}) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        outline: "border border-gray-200 bg-white hover:bg-gray-100 text-gray-900",
        ghost: "hover:bg-gray-100 hover:text-gray-900"
    };

    const sizes = {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        >
            {children}
        </button>
    );
};

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${props.className}`}
    />
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode, variant?: "default" | "outline" }) => {
    const styles = variant === "outline"
        ? "border border-gray-200 text-gray-600"
        : "bg-gray-100 text-gray-900 hover:bg-gray-200/80";
    return (
        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${styles}`}>
            {children}
        </div>
    )
}

const Checkbox = ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`peer h-4 w-4 shrink-0 rounded-sm border border-blue-600 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-blue-600 text-white" : "fill-white"
            }`}
    >
        {checked && <Check className="h-3 w-3 mx-auto" />}
    </button>
);


const GroupingStudio = memo(() => {
    const [data, setData] = useState<LogGroup[]>([]);
    const [filteredData, setFilteredData] = useState<LogGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [timezone, setTimezone] = useState<'IST' | 'PST'>('IST');
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPattern, setGeneratedPattern] = useState<{
        action: string;
        rule_name: string;
        group_type: string;
        regex_pattern: string;
    } | null>(null);

    // Save Form
    const [ruleName, setRuleName] = useState("");
    const [rulePattern, setRulePattern] = useState("");
    const [ruleType, setRuleType] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [notification, setNotification] = useState<{ title: string, message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const showNotification = useCallback((title: string, message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ title, message, type });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_ENDPOINTS.LOG_DETAILS);
            setData(response.data);
            setFilteredData(response.data);
        } catch (error) {
            console.error("Error fetching data, using mock fallback:", error);
            // Mock fallback data for development
            const mockData: LogGroup[] = Array.from({ length: 5 }, (_, i) => ({
                doc_id: `mock-${i + 1}`,
                display_rule: i % 2 === 0 ? "Timeout Exception in Billing" : "Null Pointer in Auth",
                exception_summary: i % 2 === 0 ? "java.util.concurrent.TimeoutException" : "java.lang.NullPointerException",
                message_summary: i % 2 === 0 ? "Failed to process invoice due to timeout" : "Authentication failed for user null",
                group_type: i % 2 === 0 ? "Timeout" : "NullPtr",
                count: Math.floor(Math.random() * 100) + 1,
                last_seen: "2024-03-12 11:20:00",
                "diagnosis.status": "PENDING",
                logger_name: i % 2 === 0 ? "com.pega.BillingService" : "com.pega.AuthService"
            }));
            setData(mockData);
            setFilteredData(mockData);
            showNotification("Preview Mode", "Backend not detected, using mock data.", "success");
        } finally {
            setLoading(false);
        }
    }, [setData, setFilteredData, setLoading, showNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            const filtered = data.filter(item =>
                (item.display_rule && item.display_rule.toLowerCase().includes(lower)) ||
                (item.exception_summary && item.exception_summary.toLowerCase().includes(lower)) ||
                (item.message_summary && item.message_summary.toLowerCase().includes(lower)) ||
                (item.group_type && item.group_type.toLowerCase().includes(lower))
            );
            setFilteredData(filtered);
        } else {
            setFilteredData(data);
        }
    }, [searchQuery, data]);







    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredData.map(item => item.doc_id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };

    const generatePattern = async () => {
        if (selectedIds.length === 0) return;

        setIsGenerating(true);
        try {
            // Collect examples
            const selectedItems = data.filter(item => selectedIds.includes(item.doc_id));
            const examples = selectedItems.map(item => {
                if (item.exception_summary && item.exception_summary !== "N/A") return item.exception_summary;
                if (item.message_summary && item.message_summary !== "N/A") return item.message_summary;
                return item.display_rule; // fallback
            });

            const response = await axios.post(API_ENDPOINTS.GENERATE_PATTERN, {
                examples,
                search_query: searchQuery
            });

            const result = response.data;
            setGeneratedPattern(result);

            // Pre-fill form
            setRuleName(result.rule_name || "");
            setRulePattern(result.regex_pattern || "");
            setRuleType(result.group_type || "Custom");

            showNotification("Pattern Generated", result.action === "UPDATE" ? "Suggested update to existing rule." : "New pattern generated.");

        } catch (error) {
            console.error("Generation error:", error);
            showNotification("Generation Failed", "Could not generate regex pattern.", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const saveRule = async () => {
        if (!ruleName || !rulePattern) {
            showNotification("Validation Error", "Name and pattern are required.", "error");
            return;
        }

        setIsSaving(true);
        try {
            await axios.post(API_ENDPOINTS.SAVE_RULE, {
                name: ruleName,
                pattern: rulePattern,
                group_type: ruleType
            });

            showNotification("Rule Saved", "Custom grouping rule has been saved to the library.");

            // Reset process
            setGeneratedPattern(null);
            setSelectedIds([]);

        } catch (error) {
            console.error("Save error:", error);
            showNotification("Save Failed", "Could not save the rule.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const applyChanges = async () => {
        if (!window.confirm("This will reset the analysis index and re-process all logs with the new rules. This may take a moment. Continue?")) {
            return;
        }

        setIsApplying(true);
        try {
            const response = await axios.post(API_ENDPOINTS.APPLY_GROUPING);
            showNotification("Grouping Applied", `Successfully re-grouped logs. Restored ${response.data.restored_count} manual status labels.`);
            // Refresh table
            fetchData();
        } catch (error) {
            console.error("Apply error:", error);
            showNotification("Apply Failed", "Failed to apply new grouping rules.", "error");
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 md:space-y-8 animate-in fade-in duration-500 relative">

            {/* Notifications */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border w-80 animate-in slide-in-from-right duration-300 ${notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-900'
                    }`}>
                    <div className="flex items-start gap-3">
                        {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600" /> : <Check className="w-5 h-5 text-green-600" />}
                        <div>
                            <h4 className="font-semibold text-sm">{notification.title}</h4>
                            <p className="text-xs mt-1 opacity-90">{notification.message}</p>
                        </div>
                        <button onClick={() => setNotification(null)} className="ml-auto hover:bg-black/5 rounded-full p-1">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">🎨 Grouping Studio</h1>
                <p className="text-gray-500">Define custom grouping patterns based on examples.</p>
            </div>

            {/* 1. Filter Section */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">1. Find Similar Groups</CardTitle>
                            <CardDescription>Select groups that represent the same issue but are split incorrectly.</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
                            <div className="flex bg-gray-50 border border-gray-100 rounded-xl p-1 shadow-sm">
                                <button
                                    onClick={() => setTimezone('IST')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${timezone === 'IST' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                        }`}
                                >
                                    IST
                                </button>
                                <button
                                    onClick={() => setTimezone('PST')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${timezone === 'PST' ? "bg-white text-blue-500 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                        }`}
                                >
                                    PST
                                </button>
                            </div>
                            <button
                                onClick={fetchData}
                                className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-100 transition-all hover:rotate-180 duration-500"
                                title="Refresh Logs"
                            >
                                <RefreshCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => { setSearchQuery(""); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 transition-all"
                                title="Reset Filters"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>Auto-size</span>
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Filter by Message, Exception, or Rule..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="border border-gray-200 rounded-md max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="h-10 px-4 w-[50px] sticky left-0 bg-gray-50 z-20">
                                        <Checkbox
                                            checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                                            onCheckedChange={(checked) => handleSelectAll(checked)}
                                        />
                                    </th>
                                    <th className="h-10 px-4 whitespace-nowrap">Last Seen</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Full Signature</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Type</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Count</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Assigned To</th>
                                    <th className="h-10 px-4 whitespace-nowrap w-[180px]">Status</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Rule Name</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Log Message</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Logger</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Exception Info</th>
                                    <th className="h-10 px-4 whitespace-nowrap">Report</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-8 text-gray-400">
                                            No logs found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item) => (
                                        <tr key={item.doc_id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(item.doc_id) ? "bg-blue-50/50" : ""}`}>
                                            <td className="p-4 align-top sticky left-0 bg-inherit z-20">
                                                <Checkbox
                                                    checked={selectedIds.includes(item.doc_id)}
                                                    onCheckedChange={(checked) => handleSelectOne(item.doc_id, checked)}
                                                />
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-gray-500 align-top">
                                                {(() => {
                                                    const date = new Date(item.last_seen);
                                                    const options: Intl.DateTimeFormatOptions = {
                                                        timeZone: timezone === 'IST' ? 'Asia/Kolkata' : 'America/Los_Angeles',
                                                        day: '2-digit', month: 'short',
                                                        hour: '2-digit', minute: '2-digit', hour12: true
                                                    };
                                                    const formatted = date.toLocaleString(timezone === 'IST' ? 'en-IN' : 'en-US', options);
                                                    return (
                                                        <div className={timezone === 'IST' ? "bg-gray-50 px-2 py-1 rounded border border-gray-100 text-gray-700 text-[11px] font-bold" : "bg-blue-50/50 px-2 py-1 rounded border border-blue-100 text-blue-700 text-[11px] font-bold"}>
                                                            {timezone}: {formatted}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-4 text-gray-500 text-xs font-mono align-top max-w-[200px] truncate" title={item.group_signature || item.doc_id}>
                                                {item.group_signature || item.doc_id}
                                            </td>
                                            <td className="p-4 align-top"><Badge variant="outline">{item.group_type}</Badge></td>
                                            <td className="p-4 align-top">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500"
                                                            style={{ width: `${Math.min((item.count / 1000) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-gray-600 font-medium">{item.count}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-top text-gray-500 text-sm">
                                                {item.assigned_user || "Unassigned"}
                                            </td>
                                            <td className="p-4 align-top w-[180px]">
                                                <select
                                                    value={item["diagnosis.status"] || "PENDING"}
                                                    onChange={async (e) => {
                                                        const newStatus = e.target.value;
                                                        const updatedData = data.map(d => d.doc_id === item.doc_id ? { ...d, "diagnosis.status": newStatus } : d);
                                                        setData(updatedData);
                                                        setFilteredData(updatedData);
                                                        try {
                                                            const formData = new FormData();
                                                            formData.append('doc_id', item.doc_id);
                                                            formData.append('status', newStatus);
                                                            await axios.post(API_ENDPOINTS.UPDATE_STATUS, formData);
                                                            showNotification("Status Updated", `Updated status to ${newStatus}`);
                                                        } catch {
                                                            showNotification("Update Failed", "Failed to persist status update", "error");
                                                            fetchData();
                                                        }
                                                    }}
                                                    className="bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                                >
                                                    {["PENDING", "IN PROCESS", "RESOLVED", "FALSE POSITIVE", "IGNORE", "COMPLETED"].map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-4 font-medium text-gray-900 align-top max-w-[200px] truncate" title={item.display_rule}>
                                                {item.display_rule}
                                            </td>
                                            <td className="p-4 max-w-[300px] truncate text-gray-600 align-top" title={item.message_summary}>
                                                {item.message_summary}
                                            </td>
                                            <td className="p-4 text-gray-500 align-top max-w-[150px] truncate" title={item.logger_name || "N/A"}>
                                                {item.logger_name || "N/A"}
                                            </td>
                                            <td className="p-4 text-red-600 text-xs font-mono align-top max-w-[200px] truncate" title={item.exception_summary}>
                                                {item.exception_summary || "N/A"}
                                            </td>
                                            <td className="p-4 text-gray-600 text-xs align-top max-w-[200px] truncate" title={item["diagnosis.report"]}>
                                                {item["diagnosis.report"] || "N/A"}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm text-gray-500 gap-4">
                        <span>{selectedIds.length} items selected</span>
                        <Button onClick={generatePattern} disabled={selectedIds.length === 0 || isGenerating} className="gap-2 w-full md:w-auto">
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            Generate Regex Pattern
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Analyze & Save Section */}
            {generatedPattern && (
                <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader>
                        <CardTitle className="text-lg">2. Pattern Analysis & Save</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Rule Name</label>
                                <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Activity Timeouts" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Category</label>
                                <Input value={ruleType} onChange={(e) => setRuleType(e.target.value)} placeholder="e.g. Infrastructure" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Regex Pattern</label>
                            <div className="flex gap-2">
                                <Input value={rulePattern} onChange={(e) => setRulePattern(e.target.value)} className="font-mono text-sm bg-white" />
                            </div>
                            {generatedPattern.action === "UPDATE" && (
                                <p className="text-xs text-amber-600 font-medium">⚠️ This updates an existing rule: "{generatedPattern.rule_name}"</p>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={saveRule} disabled={isSaving} className="gap-2">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Rule to Library
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 3. Apply Section */}
            <div className="pt-4 border-t border-gray-200">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">Apply Changes</h3>
                        <p className="text-sm text-gray-500">Reprocess all logs with the updated rule library. This mimics the "Run Grouping" action.</p>
                    </div>
                    <Button size="lg" onClick={applyChanges} disabled={isApplying} className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full md:w-auto">
                        {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Apply Rules Now
                    </Button>
                </div>
            </div>

        </div>
    );
});

export default GroupingStudio;
