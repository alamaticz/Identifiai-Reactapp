import React, { useState, memo } from 'react';
import { Upload, X, FileText, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface UploadingFile {
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    timeLeft?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
}

const UploadLogs: React.FC = memo(() => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files));
        }
    };

    const addFiles = (files: File[]) => {
        const newFiles = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            progress: 0,
            status: 'pending' as const,
        }));
        setUploadingFiles(prev => [...prev, ...newFiles]);
    };

    const removeFile = (id: string) => {
        setUploadingFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleUploadAll = async () => {
        setIsGlobalLoading(true);
        const filesToUpload = uploadingFiles.filter(f => f.status === 'pending');

        for (const f of filesToUpload) {
            setUploadingFiles(prev => prev.map(item =>
                item.id === f.id ? { ...item, status: 'uploading' as const, progress: 10 } : item
            ));

            const formData = new FormData();
            formData.append('file', f.file);

            try {
                const response = await axios.post(API_ENDPOINTS.UPLOAD_LOGS, formData, {
                    onUploadProgress: (progressEvent) => {
                        const progress = Math.round((progressEvent.loaded * 90) / (progressEvent.total || 1));
                        setUploadingFiles(prev => prev.map(item =>
                            item.id === f.id ? { ...item, progress: 10 + progress } : item
                        ));
                    }
                });

                setUploadingFiles(prev => prev.map(item =>
                    item.id === f.id ? { ...item, status: 'completed' as const, progress: 100, result: response.data } : item
                ));
            } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                console.error("Upload failed for", f.file.name, err);
                setUploadingFiles(prev => prev.map(item =>
                    item.id === f.id ? { ...item, status: 'error' as const, progress: 0 } : item
                ));
            }
        }
        setIsGlobalLoading(false);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const s = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
    };

    return (
        <div className="max-w-3xl mx-auto py-10 animate-in fade-in duration-500">
            {/* Main Upload Card */}
            <div className="bg-white rounded-[32px] shadow-2xl border border-gray-100 p-10 relative">
                {/* Close button (mock) */}
                <button className="absolute top-8 right-8 text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-10">
                    <h2 className="text-3xl font-black text-[#31333f] mb-2 tracking-tight">Upload and attach files</h2>
                    <p className="text-gray-400 font-medium text-sm">Attachments will be ingested into the analysis engine.</p>
                </div>

                {/* Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
                    className={cn(
                        "relative border-2 border-dashed rounded-[24px] p-16 flex flex-col items-center justify-center transition-all duration-300",
                        isDragging ? "border-[#ee4a4a] bg-red-50/30" : "border-gray-200 bg-gray-50/20 hover:border-gray-300"
                    )}
                >
                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-50 mb-6 scale-110">
                        <Upload className="w-10 h-10 text-[#ee4a4a]" strokeWidth={2.5} />
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-lg font-bold text-gray-800">
                            <label className="text-[#ee4a4a] hover:underline cursor-pointer">Click to Upload</label>
                            <span className="text-gray-400 font-medium"> or drag and drop</span>
                        </p>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">(Max. File size: 100 MB)</p>
                        <input type="file" multiple className="hidden" id="fileInput" onChange={handleFileSelect} />
                        <label htmlFor="fileInput" className="absolute inset-0 cursor-pointer opacity-0" />
                    </div>
                </div>

                {/* File List */}
                {uploadingFiles.length > 0 && (
                    <div className="mt-12 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">
                                {uploadingFiles.filter(f => f.status !== 'completed').length} files processing...
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {uploadingFiles.map((f) => (
                                <div key={f.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center space-x-4">
                                            <div className={cn(
                                                "p-3 rounded-xl",
                                                f.status === 'completed' ? "bg-green-50 text-green-500" :
                                                    f.status === 'error' ? "bg-red-50 text-red-500" : "bg-red-50 text-[#ee4a4a]"
                                            )}>
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-800 truncate max-w-[200px]">{f.file.name}</p>
                                                <p className="text-[11px] font-bold text-gray-400 mt-1">
                                                    {formatSize(f.file.size)} • {
                                                        f.status === 'pending' ? 'Ready' :
                                                            f.status === 'uploading' ? 'Ingesting...' :
                                                                f.status === 'completed' ? 'Completed' : 'Error'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFile(f.id)}
                                            className="text-gray-300 hover:text-red-500 transition-colors bg-gray-50 p-1.5 rounded-lg group-hover:bg-red-50"
                                            disabled={isGlobalLoading}
                                        >
                                            {f.status === 'completed' ? <Trash2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {(f.status === 'uploading' || f.progress > 0) && (
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full transition-all duration-300 ease-out",
                                                        f.status === 'error' ? "bg-red-500" : "bg-gradient-to-r from-[#ee4a4a] to-[#d63a3a]"
                                                    )}
                                                    style={{ width: `${f.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-black text-gray-400 w-8">{f.progress}%</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="mt-12 flex items-center justify-end space-x-4">
                    <button
                        onClick={() => setUploadingFiles([])}
                        className="px-10 py-4 rounded-2xl text-sm font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest border border-gray-100 hover:bg-gray-50"
                        disabled={isGlobalLoading}
                    >
                        Clear
                    </button>
                    <button
                        onClick={handleUploadAll}
                        disabled={isGlobalLoading || uploadingFiles.filter(f => f.status === 'pending').length === 0}
                        className="px-10 py-4 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-[#ee4a4a] to-[#d63a3a] shadow-xl shadow-red-100 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50 disabled:scale-100"
                    >
                        {isGlobalLoading ? (
                            <div className="flex items-center space-x-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Processing...</span>
                            </div>
                        ) : 'Attach files'}
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-start space-x-4">
                <AlertCircle className="w-6 h-6 text-emerald-600 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-emerald-900 mb-1">Production Ingestion Active</h4>
                    <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                        Files uploaded here are processed in real-time by the Pega analysis engine.
                        Successful ingestions will immediately update the main Dashboard analytics.
                    </p>
                </div>
            </div>
        </div>
    );
});

export default UploadLogs;
