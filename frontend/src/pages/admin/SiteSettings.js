import { useState, useEffect, useRef } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Settings, Upload, Image, Globe, Smartphone, Star, MessageCircle } from 'lucide-react';

const LOGO_TYPES = [
    { key: 'favicon', label: 'Favicon', desc: 'Browser tab icon (auto-generates 16px, 32px, ICO)', icon: Globe },
    { key: 'pwa_icon', label: 'PWA App Icon', desc: 'Icon shown when app is installed on phone (auto-generates 192px, 512px)', icon: Smartphone },
    { key: 'header_logo', label: 'Website Header Logo', desc: 'Logo shown in sidebar/header across the app', icon: Star },
    { key: 'login_logo_1', label: 'Login Logo 1 (Left)', desc: 'First logo on the login page (e.g. SGCCI)', icon: Image },
    { key: 'login_logo_2', label: 'Login Logo 2 (Right)', desc: 'Second logo on the login page (e.g. SBC)', icon: Image },
    { key: 'sponsor_logo_1', label: 'Dashboard Sponsor 1 Logo', desc: 'First sponsor logo displayed on live screen', icon: Image },
    { key: 'sponsor_logo_2', label: 'Dashboard Sponsor 2 Logo', desc: 'Second sponsor logo displayed on live screen', icon: Image },
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
            // WhatsApp config
            data.wa_api_key = settings.wa_api_key || '';
            data.wa_username = settings.wa_username || '';
            data.wa_source = settings.wa_source || '';
            data.wa_template_welcome = settings.wa_template_welcome || '';
            data.wa_template_assignment = settings.wa_template_assignment || '';
            data.wa_template_reference = settings.wa_template_reference || '';
            data.wa_campaign_welcome = settings.wa_campaign_welcome || '';
            data.wa_campaign_assignment = settings.wa_campaign_assignment || '';
            data.wa_campaign_reference = settings.wa_campaign_reference || '';
            data.sponsor_name_1 = settings.sponsor_name_1 || '';
            data.sponsor_name_2 = settings.sponsor_name_2 || '';
            data.sponsor_title_1 = settings.sponsor_title_1 || '';
            data.sponsor_title_2 = settings.sponsor_title_2 || '';
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

                {/* Sponsor Names */}
                <div className="glass-card rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2"><Image size={18} className="text-primary" /><h3 className="font-semibold">Dashboard Sponsors</h3></div>
                    <p className="text-xs text-muted-foreground">Sponsor titles and names displayed on the live screen alongside their logos uploaded above.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Sponsor 1 Title</Label>
                            <Input value={settings.sponsor_title_1 || ''} onChange={e => setSettings(p => ({ ...p, sponsor_title_1: e.target.value }))} placeholder="e.g. Tech Partner, Gold Sponsor" className="bg-muted/50 border-border h-11 mt-1" data-testid="sponsor-title-1-input" />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Sponsor 2 Title</Label>
                            <Input value={settings.sponsor_title_2 || ''} onChange={e => setSettings(p => ({ ...p, sponsor_title_2: e.target.value }))} placeholder="e.g. Powered By, Event Partner" className="bg-muted/50 border-border h-11 mt-1" data-testid="sponsor-title-2-input" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Sponsor 1 Name</Label>
                            <Input value={settings.sponsor_name_1 || ''} onChange={e => setSettings(p => ({ ...p, sponsor_name_1: e.target.value }))} placeholder="Sponsor 1" className="bg-muted/50 border-border h-11 mt-1" data-testid="sponsor-name-1-input" />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Sponsor 2 Name</Label>
                            <Input value={settings.sponsor_name_2 || ''} onChange={e => setSettings(p => ({ ...p, sponsor_name_2: e.target.value }))} placeholder="Sponsor 2" className="bg-muted/50 border-border h-11 mt-1" data-testid="sponsor-name-2-input" />
                        </div>
                    </div>
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

                <div className="glass-card rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2"><MessageCircle size={18} className="text-green-500" /><h3 className="font-semibold">WhatsApp Configuration</h3></div>
                    <p className="text-xs text-muted-foreground">Configure WhatsApp API for sending event notifications.</p>
                    <div>
                        <Label className="text-sm text-muted-foreground">API Key</Label>
                        <Input value={settings.wa_api_key || ''} onChange={e => setSettings(p => ({ ...p, wa_api_key: e.target.value }))} placeholder="Your API key" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-api-key-input" />
                    </div>
                    <div>
                        <Label className="text-sm text-muted-foreground">Username</Label>
                        <Input value={settings.wa_username || ''} onChange={e => setSettings(p => ({ ...p, wa_username: e.target.value }))} placeholder="sm@sgcci.in" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-username-input" />
                    </div>
                    <div>
                        <Label className="text-sm text-muted-foreground">Source Phone</Label>
                        <Input value={settings.wa_source || ''} onChange={e => setSettings(p => ({ ...p, wa_source: e.target.value }))} placeholder="+919979791940" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-source-input" />
                    </div>
                    <hr className="border-border" />
                    <p className="text-xs text-muted-foreground font-medium">Template & Campaign Names (as registered on your WhatsApp provider)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Welcome Template</Label>
                            <Input value={settings.wa_template_welcome || ''} onChange={e => setSettings(p => ({ ...p, wa_template_welcome: e.target.value }))} placeholder="welcome_template" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-template-welcome-input" />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Welcome Campaign</Label>
                            <Input value={settings.wa_campaign_welcome || ''} onChange={e => setSettings(p => ({ ...p, wa_campaign_welcome: e.target.value }))} placeholder="welcome_campaign" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-campaign-welcome-input" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-2">Params: {'{1}'} = User Name</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Table Assignment Template</Label>
                            <Input value={settings.wa_template_assignment || ''} onChange={e => setSettings(p => ({ ...p, wa_template_assignment: e.target.value }))} placeholder="table_assignment_template" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-template-assignment-input" />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Table Assignment Campaign</Label>
                            <Input value={settings.wa_campaign_assignment || ''} onChange={e => setSettings(p => ({ ...p, wa_campaign_assignment: e.target.value }))} placeholder="assignment_campaign" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-campaign-assignment-input" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-2">Params: {'{1}'} = Name, {'{2}'} = Table R1, {'{3}'} = Table R2, {'{4}'} = Table R3</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Reference Notification Template</Label>
                            <Input value={settings.wa_template_reference || ''} onChange={e => setSettings(p => ({ ...p, wa_template_reference: e.target.value }))} placeholder="reference_notify_template" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-template-reference-input" />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Reference Campaign</Label>
                            <Input value={settings.wa_campaign_reference || ''} onChange={e => setSettings(p => ({ ...p, wa_campaign_reference: e.target.value }))} placeholder="reference_campaign" className="bg-muted/50 border-border h-11 mt-1" data-testid="wa-campaign-reference-input" />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-2">Params: {'{1}'} = Your Name, {'{2}'} = Referrer Name, {'{3}'} = Contact Name, {'{4}'} = Contact Phone</p>
                </div>

                <Button onClick={save} className="w-full h-11 bg-primary" disabled={loading} data-testid="save-settings-btn">
                    <Save size={16} className="mr-2" />{loading ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
