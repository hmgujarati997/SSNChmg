import { useState, useEffect, useRef } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Settings, Upload, Image, Globe, Smartphone, Star } from 'lucide-react';

const LOGO_TYPES = [
    { key: 'favicon', label: 'Favicon', desc: 'Browser tab icon (auto-generates 16px, 32px, ICO)', icon: Globe },
    { key: 'pwa_icon', label: 'PWA App Icon', desc: 'Icon shown when app is installed on phone (auto-generates 192px, 512px)', icon: Smartphone },
    { key: 'header_logo', label: 'Website Header Logo', desc: 'Logo shown in sidebar/header across the app', icon: Star },
    { key: 'login_logo_1', label: 'Login Logo 1 (Left)', desc: 'First logo on the login page (e.g. SGCCI)', icon: Image },
    { key: 'login_logo_2', label: 'Login Logo 2 (Right)', desc: 'Second logo on the login page (e.g. SBC)', icon: Image },
];

export default function SiteSettings() {
    const [settings, setSettings] = useState({ admin_email: '', live_screen_password: '', razorpay_key_id: '' });
    const [logos, setLogos] = useState({});
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState({});
    const fileRefs = useRef({});

    useEffect(() => {
        API.get('/admin/settings').then(r => setSettings(r.data)).catch(() => {});
        API.get('/public/branding').then(r => setLogos(r.data)).catch(() => {});
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

    const uploadLogo = async (e, logoType) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(p => ({ ...p, [logoType]: true }));
        try {
            const formData = new FormData();
            formData.append('file', file);
            const r = await API.post(`/admin/upload-logo?logo_type=${logoType}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setLogos(p => ({ ...p, [logoType]: r.data.url }));
            toast.success(`${logoType.replace(/_/g, ' ')} uploaded! Refresh to see changes.`);
        } catch (err) { toast.error('Upload failed'); }
        setUploading(p => ({ ...p, [logoType]: false }));
        if (fileRefs.current[logoType]) fileRefs.current[logoType].value = '';
    };

    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

    return (
        <div data-testid="site-settings">
            <h2 className="text-3xl font-bold tracking-tight mb-8" style={{fontFamily:'Outfit'}}>Settings</h2>

            <div className="space-y-6 max-w-xl">
                {/* Logo Upload Sections */}
                <div className="glass-card rounded-xl p-6 space-y-5">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Image size={20} className="text-primary" />App Logos & Icons</h3>
                    <p className="text-xs text-muted-foreground">Upload images for different parts of the app. Changes take effect after a page refresh.</p>

                    {LOGO_TYPES.map(({ key, label, desc, icon: Icon }) => (
                        <div key={key} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                <Icon size={18} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{label}</p>
                                <p className="text-xs text-muted-foreground mb-2">{desc}</p>
                                {logos[key] && (
                                    <div className="mb-2">
                                        <img src={`${backendUrl}${logos[key]}`} alt={label} className="h-10 w-auto object-contain rounded bg-muted/50 p-1" />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={el => fileRefs.current[key] = el}
                                    accept="image/*"
                                    onChange={e => uploadLogo(e, key)}
                                    className="hidden"
                                    data-testid={`${key}-file-input`}
                                />
                                <Button
                                    variant="outline" size="sm"
                                    onClick={() => fileRefs.current[key]?.click()}
                                    disabled={uploading[key]}
                                    data-testid={`upload-${key}-btn`}
                                >
                                    <Upload size={14} className="mr-1.5" />
                                    {uploading[key] ? 'Uploading...' : logos[key] ? 'Replace' : 'Upload'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="glass-card rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2"><Settings size={18} className="text-primary" /><h3 className="font-semibold">Admin Credentials</h3></div>
                    <div>
                        <Label className="text-sm text-muted-foreground">Admin Email</Label>
                        <Input value={settings.admin_email} onChange={e => setSettings(p => ({ ...p, admin_email: e.target.value }))} className="bg-muted/50 border-border h-11 mt-1" data-testid="settings-email-input" />
                    </div>
                    <div>
                        <Label className="text-sm text-muted-foreground">New Password (leave empty to keep current)</Label>
                        <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="bg-muted/50 border-border h-11 mt-1" data-testid="settings-password-input" />
                    </div>
                </div>

                <div className="glass-card rounded-xl p-6 space-y-4">
                    <h3 className="font-semibold">Live Screen</h3>
                    <div>
                        <Label className="text-sm text-muted-foreground">Live Screen Password</Label>
                        <Input value={settings.live_screen_password} onChange={e => setSettings(p => ({ ...p, live_screen_password: e.target.value }))} className="bg-muted/50 border-border h-11 mt-1" data-testid="settings-live-password-input" />
                    </div>
                </div>

                <div className="glass-card rounded-xl p-6 space-y-4">
                    <h3 className="font-semibold">Razorpay (Coming Soon)</h3>
                    <div>
                        <Label className="text-sm text-muted-foreground">Razorpay Key ID</Label>
                        <Input value={settings.razorpay_key_id} onChange={e => setSettings(p => ({ ...p, razorpay_key_id: e.target.value }))} placeholder="rzp_test_..." className="bg-muted/50 border-border h-11 mt-1" data-testid="settings-razorpay-input" />
                    </div>
                </div>

                <Button onClick={save} className="w-full h-11 bg-primary" disabled={loading} data-testid="save-settings-btn">
                    <Save size={16} className="mr-2" />{loading ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
