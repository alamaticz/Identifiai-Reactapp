import React from 'react';
import { LayoutGrid, MessageSquare, Upload, LogOut, User, Settings, ChevronUp, Palette, Menu, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface LayoutProps {
    children: React.ReactNode;
    activePage: string;
    onPageChange: (page: string) => void;
    onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, onPageChange, onLogout }) => {
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024); // Responsive default
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    // Close mobile menu when page changes
    const handlePageChange = (page: string) => {
        onPageChange(page);
        setIsMobileMenuOpen(false);
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
        { id: 'chat', label: 'Chat Agent', icon: MessageSquare },
        { id: 'grouping', label: 'Grouping Studio', icon: Palette },
        { id: 'upload', label: 'Upload Logs', icon: Upload },
    ];

    return (
        <div className="flex h-screen bg-[#f0f2f6] overflow-hidden relative">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
                <div className="flex items-center space-x-2">
                    <img src="/logo.png" alt="Logo" className="h-8 w-auto rounded" />
                    <span className="font-bold text-gray-800 text-sm">IdentifAI</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </header >

            {/* Sidebar Toggle Button (Visible when sidebar is closed on Desktop) */}
            {
                !isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="hidden lg:flex absolute top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-all"
                        title="Open Sidebar"
                    >
                        <LayoutGrid className="w-6 h-6 text-primary" />
                    </button>
                )
            }

            {/* Backdrop for mobile */}
            {
                isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )
            }

            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-sidebar border-r border-sidebar-muted flex flex-col shadow-2xl transition-all duration-300 ease-in-out overflow-hidden z-50",
                    "fixed inset-y-0 left-0 lg:relative", // Positioning
                    isMobileMenuOpen ? "translate-x-0 w-80" : "-translate-x-full lg:translate-x-0", // Mobile visibility
                    isSidebarOpen ? "lg:w-80" : "lg:w-0 lg:opacity-0" // Desktop visibility
                )}
            >
                <div className="absolute right-4 top-4 z-50 lg:block hidden">
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Close Sidebar"
                    >
                        <ChevronUp className="w-5 h-5 -rotate-90" />
                    </button>
                </div>

                <div className="absolute right-4 top-4 z-50 lg:hidden text-white">
                    <button onClick={() => setIsMobileMenuOpen(false)}>
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 pb-4 flex items-center justify-between">
                    <img src="/logo.png" alt="Alamaticz Solutions" className="w-[85%] h-auto rounded-lg" />
                </div>
                <div className="px-8 mb-2">
                    <hr className="border-white/10" />
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handlePageChange(item.id)}
                            className={cn(
                                "w-full flex items-center space-x-4 px-6 py-4 rounded-xl text-lg font-medium transition-all duration-200",
                                activePage === item.id
                                    ? "bg-transparent text-primary-light border-l-4 border-primary-light"
                                    : "text-sidebar-foreground hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("w-6 h-6", activePage === item.id ? "text-primary-light" : "text-sidebar-foreground group-hover:text-white")} />
                            <span className="whitespace-nowrap">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto p-4 relative">
                    <hr className="border-gray-100 mb-6 mx-2" />

                    {/* Profile Dropdown Menu */}
                    {isProfileOpen && (
                        <div className="absolute bottom-28 left-4 right-4 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in slide-in-from-bottom-2 duration-200 z-50">
                            <button className="w-full flex items-center space-x-3 px-6 py-3 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-semibold">
                                <User className="w-4 h-4 text-gray-400" />
                                <span>Profile</span>
                            </button>
                            <button className="w-full flex items-center space-x-3 px-6 py-3 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-semibold border-t border-gray-50">
                                <Settings className="w-4 h-4 text-gray-400" />
                                <span>Settings</span>
                            </button>
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center space-x-3 px-6 py-3 hover:bg-red-50 text-red-600 transition-colors text-sm font-bold border-t border-gray-50"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}

                    {/* Profile Trigger Card */}
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className={cn(
                            "w-full flex items-center p-3 rounded-2xl transition-all duration-300 group",
                            isProfileOpen ? "bg-white/10 ring-1 ring-white/10 shadow-inner" : "hover:bg-white/5"
                        )}
                    >
                        <div className="relative">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                                <span className="text-xl font-black">AP</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-accent border-2 border-primary rounded-full"></div>
                        </div>
                        <div className="ml-4 flex-1 text-left min-w-0">
                            <p className="text-sm font-bold text-white truncate tracking-tight">Alamaticz User</p>
                            <p className="text-[11px] font-medium text-sidebar-foreground truncate tracking-tight lowercase">alamaticz@identifai.com</p>
                        </div>
                        <ChevronUp className={cn(
                            "w-5 h-5 text-gray-400 transition-transform duration-300",
                            isProfileOpen ? "rotate-180" : ""
                        )} />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative bg-[#f8f9fa] transition-all duration-300 pt-16 lg:pt-0">
                <div className="p-4 sm:p-6 lg:p-10 max-w-[1600px] mx-auto min-h-screen">
                    <header className="mb-6 lg:mb-10 text-center">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text-primary mb-2 tracking-tight">Alamaticz IdentifAI 2.0</h1>
                    </header>
                    {children}
                </div>
            </main>
        </div >
    );
};

export default Layout;
