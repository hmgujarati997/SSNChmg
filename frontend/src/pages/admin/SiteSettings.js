import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Settings } from 'lucide-react';

export default function SiteSettings() {
    const [settings, setSettings] = useState({ admin_email: '', live_screen_password: '', razorpay_key_id: '', razorpay_key_secret: '' });
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        API.get('/admin/settings').then(r => setSettings(r.data)).catch(() => {});
    }, []);

    const save = async () => {
        setLoading(true);
        try {
            const data = { live_screen_password: settings.live_screen_password };
            if (settings.admin_email) data.admin_email = settings.admin_email;
            if (newPassword) data.admin_password = newPassword;
            if (settings.razorpay_key_id) data.razorpay_key_id = settings.razorpay_key_id;
            await API.put('/admin/settings', data);
            toast.success('Settings saved'); setNewPassword('');
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
        setLoading(false);
    };

    return (
        <div data-testid="site-settings">
            <h2 className="text-3xl font-bold tracking-tight mb-8" style={{fontFamily:'Outfit'}}>Settings</h2>

            <div className="space-y-6 max-w-xl">
                <div className="glass-card rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2"><Settings size={18} className="text-primary" /><h3 className="font-semibold">Admin Credentials</h3></div>
                    <div>
                        <Label className="text-sm text-muted-foreground">Admin Email</Label>
                        <Input value={settings.admin_email} onChange={e => setSettings(p => ({ ...p, admin_email: e.target.value }))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="settings-email-input" />
                    </div>
                    <div>
                        <Label className="text-sm text-muted-foreground">New Password (leave empty to keep current)</Label>
                        <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="bg-black/30 border-white/10 h-11 mt-1" data-testid="settings-password-input" />
                    </div>
                </div>

                <div className="glass-card rounded-xl p-6 space-y-4">
                    <h3 className="font-semibold">Live Screen</h3>
                    <div>
                        <Label className="text-sm text-muted-foreground">Live Screen Password</Label>
                        <Input value={settings.live_screen_password} onChange={e => setSettings(p => ({ ...p, live_screen_password: e.target.value }))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="settings-live-password-input" />
                    </div>
                </div>

                <div className="glass-card rounded-xl p-6 space-y-4">
                    <h3 className="font-semibold">Razorpay (Coming Soon)</h3>
                    <div>
                        <Label className="text-sm text-muted-foreground">Razorpay Key ID</Label>
                        <Input value={settings.razorpay_key_id} onChange={e => setSettings(p => ({ ...p, razorpay_key_id: e.target.value }))} placeholder="rzp_test_..." className="bg-black/30 border-white/10 h-11 mt-1" data-testid="settings-razorpay-input" />
                    </div>
                </div>

                <Button onClick={save} className="w-full h-11 bg-primary" disabled={loading} data-testid="save-settings-btn">
                    <Save size={16} className="mr-2" />{loading ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
