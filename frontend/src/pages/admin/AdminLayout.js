import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Calendar, Tags, Users, UserCheck, Settings, LogOut, Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/AppBranding';
import EventManagement from './EventManagement';
import BusinessCategories from './BusinessCategories';
import UserManagement from './UserManagement';
import VolunteerManagement from './VolunteerManagement';
import SiteSettings from './SiteSettings';

const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/admin/events', icon: Calendar, label: 'Events' },
    { path: '/admin/categories', icon: Tags, label: 'Categories' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/volunteers', icon: UserCheck, label: 'Volunteers' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

function AdminDashboard() {
    const [stats, setStats] = useState(null);
    useEffect(() => {
        API.get('/admin/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
    }, []);
    if (!stats) return <div className="p-8 text-muted-foreground">Loading...</div>;
    const cards = [
        { label: 'Total Users', value: stats.total_users, color: 'text-primary' },
        { label: 'Events', value: stats.total_events, color: 'text-[hsl(var(--cyan))]' },
        { label: 'Categories', value: stats.total_categories, color: 'text-[hsl(var(--gold))]' },
        { label: 'Volunteers', value: stats.total_volunteers, color: 'text-[hsl(var(--emerald))]' },
        { label: 'Active Registrations', value: stats.active_registrations, color: 'text-primary' },
        { label: 'Total References', value: stats.total_references, color: 'text-[hsl(var(--gold))]' },
    ];
    return (
        <div data-testid="admin-dashboard">
            <h2 className="text-3xl font-bold tracking-tight mb-8" style={{fontFamily:'Outfit'}}>Dashboard</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {cards.map((c, i) => (
                    <div key={i} className="glass-card rounded-xl p-5 hover:border-border transition-colors" data-testid={`stat-${c.label.toLowerCase().replace(/\s/g,'-')}`}>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">{c.label}</p>
                        <p className={`text-3xl font-black ${c.color}`} style={{fontFamily:'Outfit'}}>{c.value}</p>
                    </div>
                ))}
            </div>
            {stats.active_event && (
                <div className="glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-3">Active Event</h3>
                    <p className="text-xl font-bold text-foreground">{stats.active_event.name}</p>
                    <div className="flex gap-6 mt-3 text-sm text-muted-foreground">
                        <span>{stats.active_event.date}</span>
                        <span>{stats.active_event.venue}</span>
                        <span className="text-primary">{stats.active_event.status}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminLayout() {
    const { logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div className="min-h-screen bg-background flex" data-testid="admin-layout">
            {/* Mobile overlay */}
            {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="p-6 flex items-center gap-3 border-b border-border">
                    <img src="/sbc_logo.png" alt="SBC" className="h-9 w-auto object-contain" />
                    <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded">Admin</span>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map(item => {
                        const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                        return (
                            <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                data-testid={`nav-${item.label.toLowerCase()}`}>
                                <item.icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-border flex items-center gap-2">
                    <ThemeToggle />
                    <Button variant="ghost" className="flex-1 justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={handleLogout} data-testid="admin-logout-btn">
                        <LogOut size={18} /> Logout
                    </Button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 min-h-screen">
                <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center gap-4 lg:hidden">
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="mobile-menu-btn">
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </Button>
                    <img src="/sbc_logo.png" alt="SBC" className="h-7 w-auto" />
                    <span className="text-sm text-muted-foreground">Admin</span>
                </header>
                <div className="p-6 lg:p-10 max-w-7xl">
                    <Routes>
                        <Route index element={<AdminDashboard />} />
                        <Route path="events/*" element={<EventManagement />} />
                        <Route path="categories" element={<BusinessCategories />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="volunteers" element={<VolunteerManagement />} />
                        <Route path="settings" element={<SiteSettings />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}
