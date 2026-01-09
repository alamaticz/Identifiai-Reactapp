import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, User, Bot, Loader2 } from 'lucide-react';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ChatAgent: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Welcome to Pega Log Analysis Assistant! I can help you analyze errors, find specific logs, or summarize issues. What would you like to know?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/api/chat`, { message: userMessage });
            setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
        } catch (error: any) {
            console.error("Chat connection error:", {
                message: error.message,
                code: error.code,
                response: error.response?.data
            });
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error connecting to the analysis engine. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center space-x-3">
                <div className="bg-gradient-to-br from-[#ee4a4a] to-[#d63a3a] p-2 rounded-xl shadow-md text-white">
                    <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-[#31333f]">AI Assistant</h2>
                    <p className="text-xs text-gray-400 font-medium flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                        Online & Ready to Analyze
                    </p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f8f9fa]">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "flex items-start space-x-3 max-w-[85%]",
                            msg.role === 'user' ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
                        )}
                    >
                        {/* Avatar */}
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border",
                            msg.role === 'user'
                                ? "bg-white border-gray-100"
                                : "bg-gradient-to-br from-[#ee4a4a] to-[#d63a3a] border-transparent text-white"
                        )}>
                            {msg.role === 'user' ? <User className="w-4 h-4 text-gray-600" /> : <Bot className="w-4 h-4" />}
                        </div>

                        {/* Bubble */}
                        <div className={cn(
                            "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                            msg.role === 'user'
                                ? "bg-[#31333f] text-white rounded-tr-none px-5 py-3"
                                : "bg-white text-gray-700 border border-gray-100 rounded-tl-none"
                        )}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex items-start space-x-3 mr-auto max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ee4a4a] to-[#d63a3a] flex items-center justify-center shrink-0 shadow-sm text-white">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#ee4a4a]" />
                            <span className="text-xs font-bold text-gray-400">Analyzing...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <form onSubmit={handleSend} className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your logs..."
                        className="w-full pl-5 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ee4a4a] transition-all text-sm font-medium text-gray-700 placeholder:text-gray-400"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className={cn(
                            "absolute right-2 p-2.5 rounded-xl transition-all duration-200",
                            input.trim() && !isLoading
                                ? "bg-[#ee4a4a] text-white hover:bg-[#d63a3a] shadow-lg shadow-red-100 hover:scale-105 active:scale-95"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] font-medium text-gray-300">AI can make mistakes. Verify critical information.</p>
                </div>
            </div>
        </div>
    );
};

export default ChatAgent;
