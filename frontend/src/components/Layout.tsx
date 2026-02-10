import React from 'react';
import { LayoutGrid, MessageSquare, Upload, LogOut, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const HamburgerIcon = ({ isOpen }: { isOpen: boolean }) => (
    <div className="flex flex-col gap-1 w-4 h-3 items-center justify-center overflow-visible">
        <motion.span
            animate={isOpen ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
            className="w-4 h-0.5 bg-current block origin-center rounded-full"
            transition={{ duration: 0.2 }}
        />
        <motion.span
            animate={isOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
            className="w-4 h-0.5 bg-current block rounded-full"
            transition={{ duration: 0.2 }}
        />
        <motion.span
            animate={isOpen ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
            className="w-4 h-0.5 bg-current block origin-center rounded-full"
            transition={{ duration: 0.2 }}
        />
    </div>
);

interface LayoutProps {
    children: React.ReactNode;
    activePage: string;
    onPageChange: (page: string) => void;
    onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, onPageChange, onLogout }) => {
    // Default closed on mobile, open on desktop
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const { user } = useAuth();

    // Helper to get initials
    const getInitials = (name?: string | null) => {
        if (!name) return 'U';
        return name.charAt(0).toUpperCase();
    };

    const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || 'No Email';

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
        { id: 'chat', label: 'Chat Agent', icon: MessageSquare },
        { id: 'upload', label: 'Upload Logs', icon: Upload },
        { id: 'grouping', label: 'Grouping Studio', icon: Palette },
    ];

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => {
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

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
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 bg-sidebar border-r border-sidebar-muted flex flex-col shadow-2xl z-[80] transition-[width,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width,transform] [transform:translate3d(0,0,0)]",
                isSidebarOpen ? "w-[280px] translate-x-0" : "w-[80px] -translate-x-full lg:translate-x-0"
            )}>
                {/* Logo Section */}
                {/* Logo Section */}
                <div className={cn(
                    "h-24 flex items-center relative shrink-0 transition-all duration-200",
                    isSidebarOpen ? "px-6 justify-start" : "px-0 justify-center"
                )}>
                    <div className="relative flex items-center justify-center w-full h-24">
                        {/* Full Logo - Fade In/Out - Width Driven */}
                        <img
                            src="/logo.png"
                            alt="Alamaticz"
                            className={cn(
                                "absolute left-6 w-[80%] h-auto object-contain transition-all duration-200 origin-left",
                                isSidebarOpen ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
                            )}
                        />
                        {/* Icon Logo - Fade In/Out - CENTERED */}
                        <img
                            src="/AlaLogo.png"
                            alt="Alamaticz"
                            className={cn(
                                "absolute h-10 w-10 object-contain transition-all duration-200",
                                isSidebarOpen ? "opacity-0 scale-90 pointer-events-none left-0" : "opacity-100 scale-100 relative"
                            )}
                        />
                    </div>

                    {/* Toggle Button - Circular Bubble Style */}
                    <button
                        onClick={toggleSidebar}
                        className={cn(
                            "absolute -right-4 top-9 w-8 h-8 flex items-center justify-center bg-sidebar-muted border border-sidebar-muted/50 rounded-full shadow-md text-sidebar-foreground hover:text-white transition-all duration-200 hidden lg:flex z-50 hover:scale-110 active:scale-95",
                        )}
                        title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
                    >
                        <HamburgerIcon isOpen={isSidebarOpen} />
                    </button>
                </div>

                <div className="px-6 mb-2">
                    <hr className="border-white/5" />
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                onPageChange(item.id);
                                closeSidebar();
                            }}
                            title={!isSidebarOpen ? item.label : undefined}
                            className={cn(
                                "w-full flex items-center transition-[background-color,color,padding,border-radius,box-shadow] duration-200 group relative whitespace-nowrap",
                                isSidebarOpen ? "px-4 py-4 space-x-3" : "justify-center py-4 px-2",
                                activePage === item.id
                                    ? "bg-primary text-white shadow-lg shadow-primary/20 rounded-2xl font-bold"
                                    : "text-sidebar-foreground hover:bg-white/5 hover:text-white rounded-2xl font-medium"
                            )}
                        >
                            <item.icon className={cn(
                                "shrink-0 transition-colors",
                                isSidebarOpen ? "w-5 h-5" : "w-6 h-6",
                                activePage === item.id ? "text-white" : "text-sidebar-foreground group-hover:text-white"
                            )} />

                            <span className={cn(
                                "truncate transition-[opacity,max-width,transform] duration-200 origin-left text-[13px] font-bold uppercase tracking-wider",
                                isSidebarOpen ? "opacity-100 max-w-[200px]" : "opacity-0 w-0 -translate-x-4 overflow-hidden"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </nav>

                {/* Profile Section - Bottom */}
                <div className="p-4 mt-auto">
                    <div className={cn(
                        "bg-[#242942] border border-white/5 rounded-2xl p-3 flex items-center transition-all duration-200 relative group",
                        !isSidebarOpen && "justify-center bg-transparent border-none p-0"
                    )}>
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="h-10 w-10 rounded-full object-cover border border-white/10 shrink-0 shadow-sm" />
                        ) : (
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0 border border-white/10 transition-transform duration-200 shadow-sm">
                                {getInitials(displayName)}
                            </div>
                        )}


                        <div className={cn(
                            "ml-3 flex-1 min-w-0 transition-all duration-200",
                            isSidebarOpen ? "opacity-100 w-auto translate-x-0" : "opacity-0 w-0 -translate-x-4 overflow-hidden hidden"
                        )}>
                            <p className="text-sm font-bold text-white truncate leading-tight">{displayName}</p>
                            <p className="text-[10px] font-bold text-sidebar-foreground truncate tracking-tighter uppercase">{displayEmail}</p>
                        </div>


                        {isSidebarOpen && (
                            <button
                                onClick={onLogout}
                                className="p-2 text-sidebar-foreground hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1 shrink-0"
                                title="Sign Out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 overflow-y-auto relative bg-[#f8f9fa] transition-[margin-left] duration-300 ease-in-out pt-16 lg:pt-0 will-change-[margin-left] [transform:translate3d(0,0,0)]",
                isSidebarOpen ? "lg:ml-[280px]" : "lg:ml-[80px]"
            )}>
                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen">
                    <header className="mb-0 hidden lg:block">
                        {/* Optional breadcrumb or title here if needed */}
                    </header>
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
