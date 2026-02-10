import React, { useState, memo, useRef, useEffect } from 'react';
import { Paperclip, Send, MessageSquare, BrainCircuit, Search, User, Bot, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const SuggestionCard = ({ title, description, icon: Icon, onClick }: { title: string, description: string, icon: any, onClick: () => void }) => (
    <motion.button
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="flex flex-col items-start p-5 bg-white border border-gray-100 rounded-[24px] shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-left w-full group"
    >
        <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-primary/5 mb-3 transition-colors">
            <Icon className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
        </div>
        <h4 className="text-sm font-bold text-gray-800 mb-1">{title}</h4>
        <p className="text-xs text-gray-400 font-medium leading-relaxed">{description}</p>
    </motion.button>
);

const ChatAgent: React.FC = memo(() => {
    const { user } = useAuth();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Member';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (messages.length > 0) scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async (textOverride?: string) => {
        const textToSend = textOverride || input;
        if (!textToSend.trim() || isLoading) return;

        const userMessage = textToSend.trim();
        if (!textOverride) setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await axios.post(API_ENDPOINTS.CHAT, { message: userMessage });
            setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
        } catch (error: any) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setInput(prev => prev + ` [Attached: ${file.name}] `);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const suggestions = [
        {
            title: "Search Database",
            description: "Query the log database for specific patterns.",
            icon: Search,
            action: () => setInput("Search the database for: ")
        },
        {
            title: "Root Cause Analysis",
            description: "Deep dive into the latest cause analysis.",
            icon: BrainCircuit,
            action: () => handleSend("Perform a root cause analysis on the latest errors.")
        }
    ];

    return (
        <div className="min-h-[calc(100vh-140px)] w-full flex flex-col bg-white rounded-[40px] border border-gray-50 shadow-sm relative overflow-hidden">

            {/* Background Accent (Only in welcome state) */}
            {messages.length === 0 && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary/5 to-transparent blur-3xl rounded-full -z-10 opacity-50" />
            )}

            <AnimatePresence mode="wait">
                {messages.length === 0 ? (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 flex flex-col items-center justify-center px-6 py-12"
                    >
                        {/* AI Orb Icon */}
                        <div className="relative mb-10">
                            <motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                    rotate: [0, 90, 180, 270, 360]
                                }}
                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-orange-400 p-0.5 shadow-[0_0_40px_rgba(238,74,74,0.3)]"
                            >
                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-orange-400/10" />
                                    <MessageSquare className="w-8 h-8 text-primary relative z-10" />
                                </div>
                            </motion.div>
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute inset-x-[-15px] inset-y-[-15px] rounded-full border border-primary/20 -z-10"
                            />
                        </div>

                        {/* Header / Greeting */}
                        <div className="text-center mb-12 space-y-3">
                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-4xl md:text-5xl font-black text-gray-800 tracking-tight"
                            >
                                {getGreeting()}, <span className="text-primary">{displayName}</span>
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="text-xl text-gray-400 font-bold"
                            >
                                What’s on your mind?
                            </motion.p>
                        </div>

                        {/* Suggestions Cards */}
                        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 overflow-hidden mb-12">
                            {suggestions.map((s, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 + idx * 0.1 }}
                                >
                                    <SuggestionCard
                                        {...s}
                                        onClick={s.action}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="chat"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex-1 flex flex-col h-full overflow-hidden"
                    >
                        {/* Chat Header */}
                        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-20">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setMessages([])}
                                    className="p-2 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-600"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">Active Analysis</h2>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        Streaming Mode
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#fdfdfd]">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "flex items-start gap-4 max-w-[85%]",
                                        msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}
                                >
                                    <div className={cn(
                                        "w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border",
                                        msg.role === 'user'
                                            ? "bg-white border-gray-100"
                                            : "bg-primary border-transparent text-white"
                                    )}>
                                        {msg.role === 'user' ? <User className="w-5 h-5 text-gray-600" /> : <Bot className="w-5 h-5" />}
                                    </div>
                                    <div className={cn(
                                        "p-5 rounded-3xl text-sm leading-relaxed shadow-sm",
                                        msg.role === 'user'
                                            ? "bg-[#31333f] text-white rounded-tr-none px-6"
                                            : "bg-white text-gray-700 border border-gray-100 rounded-tl-none"
                                    )}>
                                        <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-start gap-4 mr-auto">
                                    <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center text-white shadow-sm">
                                        <Bot className="w-5 h-5" />
                                    </div>
                                    <div className="bg-white p-5 rounded-3xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Processing</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Box Area (Fixed at bottom) */}
            <div className={cn(
                "w-full px-6 pb-8 pt-0",
                messages.length > 0 ? "bg-white border-t border-gray-50 pt-6" : ""
            )}>
                <div className="relative max-w-2xl mx-auto group">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask a question or make a request..."
                        className={cn(
                            "w-full p-6 pr-24 bg-white border-2 border-gray-100 rounded-[32px] shadow-sm group-hover:shadow-md focus:shadow-xl focus:border-primary/20 outline-none transition-all resize-none text-gray-700 font-medium placeholder:text-gray-300 scrollbar-hide",
                            messages.length > 0 ? "min-h-[80px]" : "min-h-[140px]"
                        )}
                    />

                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all"
                            title="Attach file"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isLoading}
                            className={cn(
                                "p-4 rounded-[22px] transition-all duration-300 shadow-lg",
                                input.trim() && !isLoading
                                    ? "bg-primary text-white shadow-primary/20"
                                    : "bg-gray-100 text-gray-300 pointer-events-none"
                            )}
                        >
                            <Send className="w-6 h-6" />
                        </motion.button>
                    </div>
                </div>

                {messages.length === 0 && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ delay: 1.5 }}
                        className="text-center mt-8 text-[10px] uppercase tracking-widest font-black text-gray-400"
                    >
                        Enterprise AI Engine • Standard Mode
                    </motion.p>
                )}
            </div>
        </div>
    );
});

export default ChatAgent;
