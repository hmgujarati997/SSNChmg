import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Home, User, ArrowRightLeft, LogOut, Zap } from 'lucide-react';
import UserDashboard from './UserDashboard';
import UserProfile from './UserProfile';
import PunchReferences from './PunchReferences';
import ViewReferences from './ViewReferences';

const navItems = [
    { path: '/user', icon: Home, label: 'Home', exact: true },
    { path: '/user/profile', icon: User, label: 'Profile' },
    { path: '/user/references', icon: ArrowRightLeft, label: 'References' },
];

export default function UserLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background pb-20" data-testid="user-layout">
            {/* Top bar */}
            <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-lg font-bold tracking-tighter" style={{fontFamily:'Outfit'}}>SSNC</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground hidden sm:block">{user?.full_name}</span>
                    <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }} data-testid="user-logout-btn">
                        <LogOut size={18} />
                    </Button>
                </div>
            </header>

            {/* Content */}
            <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                <Routes>
                    <Route index element={<UserDashboard />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="references" element={<PunchReferences />} />
                    <Route path="references/view" element={<ViewReferences />} />
                </Routes>
            </div>

            {/* Bottom nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A]/95 backdrop-blur-lg border-t border-white/10 z-50 safe-area-pb" data-testid="user-bottom-nav">
                <div className="flex items-center justify-around max-w-lg mx-auto h-16">
                    {navItems.map(item => {
                        const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                        return (
                            <Link key={item.path} to={item.path}
                                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                                data-testid={`nav-${item.label.toLowerCase()}`}>
                                <item.icon size={20} />
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
