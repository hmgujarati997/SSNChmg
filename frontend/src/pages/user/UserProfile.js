import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, User } from 'lucide-react';

export default function UserProfile() {
    const { user, setUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        API.get('/user/profile').then(r => setProfile(r.data)).catch(() => {});
        API.get('/user/categories').then(r => setCategories(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (profile?.category_id) {
            API.get(`/user/subcategories?category_id=${profile.category_id}`).then(r => setSubcategories(r.data)).catch(() => {});
        }
    }, [profile?.category_id]);

    const save = async () => {
        setLoading(true);
        try {
            const social = profile.social_links || {};
            const data = {
                full_name: profile.full_name, email: profile.email, business_name: profile.business_name,
                category_id: profile.category_id, subcategory_id: profile.subcategory_id, position: profile.position,
                profile_picture: profile.profile_picture, company_logo: profile.company_logo,
                linkedin: social.linkedin || '', instagram: social.instagram || '', twitter: social.twitter || '',
                youtube: social.youtube || '', whatsapp: social.whatsapp || '', facebook: social.facebook || '', website: social.website || ''
            };
            const r = await API.put('/user/profile', data);
            setProfile(r.data);
            localStorage.setItem('ssnc_user', JSON.stringify(r.data));
            setUser(r.data);
            toast.success('Profile saved');
        } catch (err) { toast.error('Failed to save'); }
        setLoading(false);
    };

    const u = (k, v) => setProfile(p => ({ ...p, [k]: v }));
    const uSocial = (k, v) => setProfile(p => ({ ...p, social_links: { ...(p.social_links || {}), [k]: v } }));

    if (!profile) return <div className="p-4 text-muted-foreground">Loading...</div>;

    return (
        <div className="space-y-6 animate-fade-in" data-testid="user-profile">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User size={24} className="text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>My Profile</h1>
                    <p className="text-sm text-muted-foreground">{profile.phone}</p>
                </div>
            </div>

            <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Personal Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label className="text-xs text-muted-foreground">Full Name</Label><Input value={profile.full_name || ''} onChange={e => u('full_name', e.target.value)} className="bg-muted/50 border-border h-10 mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Email</Label><Input value={profile.email || ''} onChange={e => u('email', e.target.value)} className="bg-muted/50 border-border h-10 mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Position</Label><Input value={profile.position || ''} onChange={e => u('position', e.target.value)} className="bg-muted/50 border-border h-10 mt-1" /></div>
                    <div><Label className="text-xs text-muted-foreground">Business Name</Label><Input value={profile.business_name || ''} onChange={e => u('business_name', e.target.value)} className="bg-muted/50 border-border h-10 mt-1" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <Select value={profile.category_id || ''} onValueChange={v => u('category_id', v)}>
                            <SelectTrigger className="bg-muted/50 border-border h-10 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground">Sub Category</Label>
                        <Select value={profile.subcategory_id || ''} onValueChange={v => u('subcategory_id', v)}>
                            <SelectTrigger className="bg-muted/50 border-border h-10 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{subcategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Social Links</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {['linkedin', 'instagram', 'twitter', 'youtube', 'whatsapp', 'facebook', 'website'].map(f => (
                        <div key={f}>
                            <Label className="text-xs text-muted-foreground capitalize">{f}</Label>
                            {f === 'whatsapp' ? (
                                <div className="flex mt-1">
                                    <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-border bg-black/50 text-muted-foreground text-xs">+</span>
                                    <Input
                                        value={(profile.social_links || {})[f] || '91'}
                                        onChange={e => uSocial(f, e.target.value.replace(/[^0-9]/g, ''))}
                                        className="bg-muted/50 border-border h-10 rounded-l-none"
                                        placeholder="919876543210"
                                        data-testid="social-whatsapp-input"
                                    />
                                </div>
                            ) : (
                                <Input value={(profile.social_links || {})[f] || ''} onChange={e => uSocial(f, e.target.value)} className="bg-muted/50 border-border h-10 mt-1" placeholder={f} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <Button onClick={save} className="w-full h-11 bg-primary" disabled={loading} data-testid="save-profile-btn">
                <Save size={16} className="mr-2" />{loading ? 'Saving...' : 'Save Profile'}
            </Button>
        </div>
    );
}
