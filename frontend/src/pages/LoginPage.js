import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, User, UserCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/AppBranding';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [volPhone, setVolPhone] = useState('');
    const [volPassword, setVolPassword] = useState('');

    const handleLogin = async (e, endpoint, credentials, redirectTo) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(endpoint, credentials);
            navigate(redirectTo);
            toast.success('Welcome back!');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Login failed');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 relative" data-testid="login-page">
            <div className="absolute top-4 right-4"><ThemeToggle /></div>
            <div className="w-full max-w-md animate-fade-in">
                <div className="text-center mb-10">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <img src="/sgcci_logo.png" alt="SGCCI" className="h-16 w-auto object-contain" />
                        <img src="/sbc_logo.png" alt="SBC" className="h-16 w-auto object-contain" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight" style={{fontFamily:'Outfit'}}>Speed Networking</h1>
                    <p className="text-muted-foreground text-sm mt-1">SGCCI Business Connect</p>
                </div>

                <div className="glass-card rounded-xl p-8 shadow-xl">
                    <Tabs defaultValue="user" className="w-full">
                        <TabsList className="grid grid-cols-3 w-full bg-muted mb-6 h-11">
                            <TabsTrigger value="user" className="flex items-center gap-1.5 text-xs sm:text-sm" data-testid="tab-user">
                                <User size={14} /> User
                            </TabsTrigger>
                            <TabsTrigger value="admin" className="flex items-center gap-1.5 text-xs sm:text-sm" data-testid="tab-admin">
                                <Shield size={14} /> Admin
                            </TabsTrigger>
                            <TabsTrigger value="volunteer" className="flex items-center gap-1.5 text-xs sm:text-sm" data-testid="tab-volunteer">
                                <UserCheck size={14} /> Volunteer
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="user">
                            <form onSubmit={(e) => handleLogin(e, '/auth/user/login', { phone: userPhone, password: userPassword }, '/user')} className="space-y-4">
                                <div>
                                    <Label className="text-sm text-muted-foreground">Phone Number</Label>
                                    <Input type="tel" placeholder="9876543210" value={userPhone} onChange={e => setUserPhone(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5 focus:border-primary/50" data-testid="user-phone-input" />
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Password</Label>
                                    <Input type="password" placeholder="Enter password" value={userPassword} onChange={e => setUserPassword(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5 focus:border-primary/50" data-testid="user-password-input" />
                                </div>
                                <Button type="submit" className="w-full h-12 text-base font-semibold tracking-wide bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-200" disabled={loading} data-testid="user-login-btn">
                                    {loading ? 'Signing in...' : 'Sign In'}
                                </Button>
                                <p className="text-center text-sm text-muted-foreground pt-2">
                                    New here? <Link to="/register" className="text-primary hover:underline font-medium" data-testid="register-link">Create Account</Link>
                                </p>
                            </form>
                        </TabsContent>

                        <TabsContent value="admin">
                            <form onSubmit={(e) => handleLogin(e, '/auth/admin/login', { email: adminEmail, password: adminPassword }, '/admin')} className="space-y-4">
                                <div>
                                    <Label className="text-sm text-muted-foreground">Email</Label>
                                    <Input type="email" placeholder="admin@ssnc.com" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5 focus:border-primary/50" data-testid="admin-email-input" />
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Password</Label>
                                    <Input type="password" placeholder="Enter password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5 focus:border-primary/50" data-testid="admin-password-input" />
                                </div>
                                <Button type="submit" className="w-full h-12 text-base font-semibold tracking-wide bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-200" disabled={loading} data-testid="admin-login-btn">
                                    {loading ? 'Signing in...' : 'Sign In as Admin'}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="volunteer">
                            <form onSubmit={(e) => handleLogin(e, '/auth/volunteer/login', { phone: volPhone, password: volPassword }, '/volunteer')} className="space-y-4">
                                <div>
                                    <Label className="text-sm text-muted-foreground">Phone Number</Label>
                                    <Input type="tel" placeholder="9876543210" value={volPhone} onChange={e => setVolPhone(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5 focus:border-primary/50" data-testid="volunteer-phone-input" />
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Password</Label>
                                    <Input type="password" placeholder="Enter password" value={volPassword} onChange={e => setVolPassword(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5 focus:border-primary/50" data-testid="volunteer-password-input" />
                                </div>
                                <Button type="submit" className="w-full h-12 text-base font-semibold tracking-wide bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-200" disabled={loading} data-testid="volunteer-login-btn">
                                    {loading ? 'Signing in...' : 'Sign In as Volunteer'}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
