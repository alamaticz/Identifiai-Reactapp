import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { auth } from '../config/firebase';
import { Eye, EyeOff, Mail, CheckCircle2 } from 'lucide-react';

interface LoginProps {
    onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setInfo('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            onLoginSuccess();
            navigate('/');
        } catch (err: any) {
            console.error("Login Error:", err);
            let msg = "Login failed. Please check your credentials.";
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                msg = "Invalid email or password.";
            } else if (err.code === 'auth/too-many-requests') {
                msg = "Too many failed attempts. Please try again later.";
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Please enter your email address first.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            await sendPasswordResetEmail(auth, email);
            setInfo("Password reset email sent! Please check your inbox.");
        } catch (err: any) {
            setError("Failed to send reset email. " + (err.message || ""));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-6 font-sans">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl overflow-hidden flex min-h-[600px]">
                {/* Left Panel: Welcome Branding */}
                <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#1a1f33] via-[#1e293b] to-[#3b82f6] p-12 flex-col justify-center relative overflow-hidden">
                    {/* Decorative Shapes */}
                    <div className="absolute top-10 left-10 w-4 h-4 rounded-full border-2 border-white/10"></div>
                    <div className="absolute top-20 right-20 w-3 h-3 rounded-full bg-blue-400 opacity-60"></div>
                    <div className="absolute bottom-20 left-1/4 w-32 h-8 bg-white/5 rounded-full rotate-45"></div>
                    <div className="absolute top-1/4 right-10 w-16 h-16 border-4 border-white/5 rounded-3xl -rotate-12"></div>

                    <div className="relative z-10 text-white">
                        <h1 className="text-6xl font-black mb-6 tracking-tight">Welcome back!</h1>
                        <p className="text-xl text-white/70 leading-relaxed font-medium max-w-md">
                            Analyze, Diagnose and Resolve Pega application errors with AI-powered insights.
                        </p>
                    </div>

                    {/* Wave patterns similar to image */}
                    <svg className="absolute bottom-0 right-0 w-full opacity-10" viewBox="0 0 1440 320">
                        <path fill="#ffffff" d="M0,192L48,197.3C96,203,192,213,288,192C384,171,480,117,576,112C672,107,768,149,864,181.3C960,213,1056,235,1152,213.3C1248,192,1344,128,1392,96L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                    </svg>
                </div>

                {/* Right Panel: Login Form */}
                <div className="w-full lg:w-1/2 p-12 lg:p-20 flex flex-col justify-center bg-white">
                    <div className="text-center mb-12">
                        <div className="flex justify-center items-center gap-4 mb-8">
                            <img src="/AlaLogo.png" alt="Alamaticz" className="h-12 w-12 object-contain" />
                            <div className="text-left">
                                <h2 className="text-xl font-black text-[#1a1f33] leading-none">ALAMATICZ</h2>
                                <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] mt-1">SOLUTIONS</p>
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-gray-800">IdentifAI login</h3>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6 max-w-sm mx-auto w-full">
                        <div className="relative group">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-400 peer"
                                placeholder="Username or Email"
                                required
                            />
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors">
                                <Mail className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="relative group">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-400"
                                placeholder="Password me"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between px-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer" />
                                <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors" onClick={handleForgotPassword}>Forgot password?</span>
                            </label>
                        </div>

                        {error && (
                            <div className="text-red-500 text-xs font-bold bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                {error}
                            </div>
                        )}

                        {info && (
                            <div className="text-emerald-600 text-xs font-bold bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                                <CheckCircle2 className="w-4 h-4" />
                                {info}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-[#2fb38f] to-[#45e3b8] text-white py-5 rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                        >
                            {loading ? (
                                <span className="animate-spin h-6 w-6 border-[3px] border-white/30 border-t-white rounded-full" />
                            ) : (
                                'Login'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
