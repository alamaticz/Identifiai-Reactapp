import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { X, Clock } from 'lucide-react';

interface HistoryItem {
    timestamp: string;
    user: string;
    action: string;
    details: string;
    group_signature: string;
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
            // Prevent background scroll when modal is open
            document.body.style.overflow = 'hidden';
            // Also lock the main content area scroll
            const mainElement = document.querySelector('main');
            if (mainElement) {
                mainElement.style.overflow = 'hidden';
            }
        } else {
            // Restore background scroll when modal is closed
            document.body.style.overflow = 'unset';
            const mainElement = document.querySelector('main');
            if (mainElement) {
                mainElement.style.overflow = 'auto';
            }
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset';
            const mainElement = document.querySelector('main');
            if (mainElement) {
                mainElement.style.overflow = 'auto';
            }
        };
    }, [isOpen]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_ENDPOINTS.AUDIT_HISTORY);
            setHistory(response.data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Clock className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Resolution History</h2>
                            <p className="text-sm text-gray-500">Recent actions and status updates</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                            <p className="text-gray-400 text-sm">Loading audit logs...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-2">
                            <Clock className="w-12 h-12 opacity-20" />
                            <p>No history records found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 border-b border-gray-100">Time</th>
                                    <th className="px-6 py-4 border-b border-gray-100">User</th>
                                    <th className="px-6 py-4 border-b border-gray-100">Action</th>
                                    <th className="px-6 py-4 border-b border-gray-100">Group</th>
                                    <th className="px-6 py-4 border-b border-gray-100">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((item, index) => (
                                    <tr key={index} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap font-mono">
                                            {new Date(item.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                                                    {item.user.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{item.user}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.action === 'STATUS_CHANGE' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                item.action === 'COMMENT_UPDATE' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                    'bg-gray-50 text-gray-600 border-gray-200'
                                                }`}>
                                                {item.action.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={item.group_signature}>
                                            {item.group_signature}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {item.details}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;
