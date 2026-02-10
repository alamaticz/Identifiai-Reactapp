
import React, { useMemo } from 'react';
import { Box, FunctionSquare, Layers } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface RuleSequenceViewerProps {
    signature: string;
}

interface RuleNode {
    type: string;
    class: string;
    name: string;
}

const RuleSequenceViewer: React.FC<RuleSequenceViewerProps> = ({ signature }) => {

    const rules = useMemo(() => {
        if (!signature || !signature.includes('|')) return [];

        // Parse signature format: 1:Type->Name->Class | 2:Type->Name->Class
        return signature.split('|').map(part => {
            const cleanPart = part.trim();
            // Remove index prefix if exists (e.g. "1:")
            const content = cleanPart.includes(':') ? cleanPart.split(':')[1] : cleanPart;

            const tokens = content.split('->');
            if (tokens.length >= 3) {
                return {
                    type: tokens[0].trim(),
                    name: tokens[1].trim(),
                    class: tokens[2].trim()
                };
            }
            return null;
        }).filter(Boolean) as RuleNode[];
    }, [signature]);

    if (rules.length === 0) {
        // Fallback for non-parsable signatures
        return (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 font-mono text-xs text-gray-500 break-all">
                {signature}
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Execution Path
            </h3>

            <div className="flex flex-col gap-2 relative">
                {/* Vertical line connecting nodes */}
                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>

                {rules.map((rule, idx) => (
                    <div key={idx} className="relative z-10 flex items-start gap-4 group">

                        {/* Node Icon */}
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shadow-sm border border-white shrink-0 transition-all",
                            rule.type === 'Activity' ? "bg-purple-100 text-purple-600" :
                                rule.type === 'Data Transform' ? "bg-blue-100 text-blue-600" :
                                    "bg-white border-slate-200 text-slate-500"
                        )}>
                            <FunctionSquare className="w-5 h-5" />
                        </div>

                        {/* Content Card */}
                        <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <span className={cn(
                                    "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                                    rule.type === 'Activity' ? "bg-purple-50 text-purple-600" : "bg-slate-100 text-slate-500"
                                )}>
                                    {rule.type}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">Step {idx + 1}</span>
                            </div>

                            <div className="font-bold text-slate-800 text-sm mb-0.5">
                                {rule.name}
                            </div>

                            {rule.class !== 'NA' && (
                                <div className="text-xs font-mono text-slate-500 flex items-center gap-1">
                                    <Box className="w-3 h-3" />
                                    {rule.class}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RuleSequenceViewer;
