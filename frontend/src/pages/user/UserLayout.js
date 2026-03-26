import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Home, User, ArrowRightLeft, LogOut, AlertCircle, Save } from 'lucide-react';
import { ThemeToggle, InstallButton, HeaderLogo } from '@/components/AppBranding';
import UserDashboard from './UserDashboard';
import UserProfile from './UserProfile';
import PunchReferences from './PunchReferences';
import ViewReferences from './ViewReferences';

const navItems = [
    { path: '/user', icon: Home, label: 'Home', exact: true },
    { path: '/user/profile', icon: User, label: 'Profile' },
    { path: '/user/references', icon: ArrowRightLeft, label: 'References' },
];

function ProfileCompletion({ onComplete }) {
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [form, setForm] = useState({ business_name: '', category_id: '', subcategory_id: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        API.get('/user/categories').then(r => setCategories(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (form.category_id) {
            API.get(`/user/subcategories?category_id=${form.category_id}`).then(r => setSubcategories(r.data)).catch(() => {});
        } else {
            setSubcategories([]);
        }
    }, [form.category_id]);

    const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.business_name || !form.category_id || !form.subcategory_id) {
            toast.error('All fields are required');
            return;
        }
        setLoading(true);
        try {
            await API.put('/user/profile', form);
            toast.success('Profile completed!');
            onComplete();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to save');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="profile-completion">
            <div className="w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--gold))]/20 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-7 h-7 text-[hsl(var(--gold))]" />
                    </div>
                    <h1 className="text-2xl font-bold" style={{fontFamily:'Outfit'}}>Complete Your Profile</h1>
                    <p className="text-sm text-muted-foreground mt-2">Business information is required to continue</p>
                </div>
                <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-5">
                    <div>
                        <Label className="text-sm text-muted-foreground">Business Name <span className="text-destructive">*</span></Label>
                        <Input value={form.business_name} onChange={e => u('business_name', e.target.value)} placeholder="Your Company Name"
                            className="bg-muted/50 border-border h-11 mt-1" data-testid="complete-business-input" />
                    </div>
                    <div>
                        <Label className="text-sm text-muted-foreground">Business Category <span className="text-destructive">*</span></Label>
                        <Select value={form.category_id} onValueChange={v => { u('category_id', v); u('subcategory_id', ''); }}>
                            <SelectTrigger className="bg-muted/50 border-border h-11 mt-1" data-testid="complete-category-trigger">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-sm text-muted-foreground">Sub Category <span className="text-destructive">*</span></Label>
                        <Select value={form.subcategory_id} onValueChange={v => u('subcategory_id', v)}>
                            <SelectTrigger className="bg-muted/50 border-border h-11 mt-1" data-testid="complete-subcategory-trigger">
                                <SelectValue placeholder="Select sub-category" />
                            </SelectTrigger>
                            <SelectContent>
                                {subcategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" className="w-full h-11 bg-primary" disabled={loading} data-testid="complete-profile-btn">
                        <Save size={16} className="mr-2" />{loading ? 'Saving...' : 'Complete Profile'}
                    </Button>
                </form>
            </div>
        </div>
    );
}

export default function UserLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [profileComplete, setProfileComplete] = useState(null); // null = loading, true/false

    useEffect(() => {
        API.get('/user/profile-status')
            .then(r => setProfileComplete(r.data.complete))
            .catch(() => setProfileComplete(true)); // fallback to true if check fails
    }, []);

    if (profileComplete === null) {
        return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
    }

    if (!profileComplete) {
        return <ProfileCompletion onComplete={() => setProfileComplete(true)} />;
    }

    return (
        <div className="min-h-screen bg-background pb-20" data-testid="user-layout">
            <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <HeaderLogo />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground hidden sm:block">{user?.full_name}</span>
                    <InstallButton />
                    <ThemeToggle />
                    <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }} data-testid="user-logout-btn">
                        <LogOut size={18} />
                    </Button>
                </div>
            </header>

            <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                <Routes>
                    <Route index element={<UserDashboard />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="references" element={<PunchReferences />} />
                    <Route path="references/view" element={<ViewReferences />} />
                </Routes>
            </div>

            <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50 safe-area-pb" data-testid="user-bottom-nav">
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
