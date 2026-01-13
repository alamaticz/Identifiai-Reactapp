import React from 'react';
import { LayoutGrid, MessageSquare, Upload, LogOut, User, Settings, ChevronUp, Palette } from 'lucide-react';
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
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
        { id: 'chat', label: 'Chat Agent', icon: MessageSquare },
        { id: 'grouping', label: 'Grouping Studio', icon: Palette },
        { id: 'upload', label: 'Upload Logs', icon: Upload },
    ];

    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="flex h-screen bg-[#f0f2f6] overflow-hidden relative">
            {/* Mobile Header Toggle */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-muted flex items-center justify-between px-6 z-[60] shadow-lg">
                <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <LayoutGrid className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] animate-in fade-in duration-300"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed lg:static inset-y-0 left-0 w-80 bg-sidebar border-r border-sidebar-muted flex flex-col shadow-2xl z-[80] transition-transform duration-300 lg:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-8 pb-4 flex items-center justify-between">
                    <img src="/logo.png" alt="Alamaticz Solutions" className="w-[85%] h-auto rounded-lg" />
                    <button className="lg:hidden text-white/50 hover:text-white" onClick={closeSidebar}>
                        <ChevronUp className="-rotate-90 w-6 h-6" />
                    </button>
                </div>
                <div className="px-8 mb-2">
                    <hr className="border-white/10" />
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                onPageChange(item.id);
                                closeSidebar();
                            }}
                            className={cn(
                                "w-full flex items-center space-x-4 px-6 py-4 rounded-xl text-lg font-medium transition-all duration-200",
                                activePage === item.id
                                    ? "bg-transparent text-primary-light border-l-4 border-primary-light"
                                    : "text-sidebar-foreground hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("w-6 h-6", activePage === item.id ? "text-primary-light" : "text-sidebar-foreground group-hover:text-white")} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto p-4 relative">
                    <hr className="border-gray-100 mb-6 mx-2" />

                    {/* Profile Dropdown Menu */}
                    {isProfileOpen && (
                        <div className="absolute bottom-28 left-4 right-4 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in slide-in-from-bottom-2 duration-200 z-[90]">
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
            <main className="flex-1 overflow-y-auto relative bg-[#f8f9fa] pt-16 lg:pt-0">
                <div className="p-6 sm:p-10 max-w-[1600px] mx-auto min-h-screen">
                    <header className="mb-10 text-center">
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary mb-2 tracking-tight">Alamaticz IdentifAI 2.0</h1>
                    </header>
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
