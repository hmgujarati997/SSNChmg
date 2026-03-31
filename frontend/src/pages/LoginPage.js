import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User } from 'lucide-react';
import { ThemeToggle, InstallButton } from '@/components/AppBranding';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/user';
    const [loading, setLoading] = useState(false);
    const [userPhone, setUserPhone] = useState('');
    const [branding, setBranding] = useState({});
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

    useEffect(() => {
        API.get('/public/branding').then(r => setBranding(r.data)).catch(() => {});
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login('/auth/user/login', { phone: userPhone });
            navigate(redirectTo);
            toast.success('Welcome back!');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Login failed');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 relative" data-testid="login-page">
            <div className="absolute top-4 right-4 flex items-center gap-2"><InstallButton /><ThemeToggle /></div>
            <div className="w-full max-w-md animate-fade-in">
                <div className="text-center mb-10">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <img src={branding.login_logo_1 ? `${backendUrl}${branding.login_logo_1}` : '/sgcci_logo.png'} alt="Logo 1" className="h-16 w-auto object-contain" />
                        <img src={branding.login_logo_2 ? `${backendUrl}${branding.login_logo_2}` : '/sbc_logo.png'} alt="Logo 2" className="h-16 w-auto object-contain" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight" style={{fontFamily:'Outfit'}}>Speed Networking</h1>
                    <p className="text-muted-foreground text-sm mt-1">SGCCI Business Connect</p>
                </div>

                <div className="glass-card rounded-xl p-8 shadow-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <User size={18} className="text-primary" />
                        <h2 className="text-lg font-bold" style={{fontFamily:'Outfit'}}>Sign In</h2>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Phone Number</Label>
                            <Input type="tel" placeholder="9876543210" value={userPhone} onChange={e => setUserPhone(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5 focus:border-primary/50" data-testid="user-phone-input" />
                        </div>
                        <Button type="submit" className="w-full h-12 text-base font-semibold tracking-wide bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-200" disabled={loading} data-testid="user-login-btn">
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
