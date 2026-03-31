import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

export default function AdminLoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login('/auth/admin/login', { email, password });
            navigate('/admin');
            toast.success('Welcome, Admin!');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Login failed');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="admin-login-page">
            <div className="w-full max-w-sm animate-fade-in">
                <div className="glass-card rounded-xl p-8 shadow-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <Shield size={18} className="text-primary" />
                        <h2 className="text-lg font-bold" style={{fontFamily:'Outfit'}}>Admin Access</h2>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Email</Label>
                            <Input type="email" placeholder="admin@ssnc.com" value={email} onChange={e => setEmail(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5" data-testid="admin-email-input" />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Password</Label>
                            <Input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} className="bg-muted/50 border-border h-12 mt-1.5" data-testid="admin-password-input" />
                        </div>
                        <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary" disabled={loading} data-testid="admin-login-btn">
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
