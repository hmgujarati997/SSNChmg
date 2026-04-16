import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, User, Camera, Building2, ZoomIn, ZoomOut, Check } from 'lucide-react';
import Cropper from 'react-easy-crop';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function createCroppedImage(imageSrc, pixelCrop) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
        };
        image.src = imageSrc;
    });
}

export default function UserProfile() {
    const { user, setUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState({});
    const ppRef = useRef(null);
    const clRef = useRef(null);

    // Cropper state
    const [cropDialog, setCropDialog] = useState(false);
    const [cropImage, setCropImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    useEffect(() => {
        API.get('/user/profile').then(r => setProfile(r.data)).catch(() => {});
        API.get('/user/categories').then(r => setCategories(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (profile?.category_id) {
            API.get(`/user/subcategories?category_id=${profile.category_id}`).then(r => setSubcategories(r.data)).catch(() => {});
        }
    }, [profile?.category_id]);

    const onCropComplete = useCallback((_, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const handleFileSelect = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setCropImage(reader.result);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCropDialog(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropConfirm = async () => {
        if (!cropImage || !croppedAreaPixels) return;
        setCropDialog(false);
        const blob = await createCroppedImage(cropImage, croppedAreaPixels);
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
        await uploadPhoto(file, 'profile_picture');
        setCropImage(null);
    };

    const uploadPhoto = async (file, photoType) => {
        setUploading(u => ({ ...u, [photoType]: true }));
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('photo_type', photoType);
            const r = await API.post(`/user/upload-photo?photo_type=${photoType}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setProfile(p => ({ ...p, [photoType]: r.data.url }));
            toast.success(photoType === 'profile_picture' ? 'Profile picture updated' : 'Company logo updated');
        } catch { toast.error('Upload failed'); }
        setUploading(u => ({ ...u, [photoType]: false }));
    };

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
            {/* Profile Picture & Company Logo */}
            <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Photos</h3>
                <div className="flex gap-8 items-start">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="w-24 h-24 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center cursor-pointer relative group"
                            onClick={() => ppRef.current?.click()}
                            data-testid="profile-picture-upload"
                        >
                            {profile.profile_picture ? (
                                <img src={`${BACKEND_URL}${profile.profile_picture}`} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User size={36} className="text-muted-foreground" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                                <Camera size={20} className="text-white" />
                            </div>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Profile Picture</span>
                        <input ref={ppRef} type="file" accept="image/*" className="hidden" onChange={e => { e.target.files[0] && handleFileSelect(e.target.files[0]); e.target.value = ''; }} data-testid="profile-picture-input" />
                        {uploading.profile_picture && <span className="text-xs text-primary">Uploading...</span>}
                    </div>
                    {/* Company Logo */}
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="w-24 h-24 rounded-xl bg-muted border-2 border-border overflow-hidden flex items-center justify-center cursor-pointer relative group"
                            onClick={() => clRef.current?.click()}
                            data-testid="company-logo-upload"
                        >
                            {profile.company_logo ? (
                                <img src={`${BACKEND_URL}${profile.company_logo}`} alt="Logo" className="w-full h-full object-contain p-1" />
                            ) : (
                                <Building2 size={36} className="text-muted-foreground" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                <Camera size={20} className="text-white" />
                            </div>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Company Logo</span>
                        <input ref={clRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0], 'company_logo')} />
                        {uploading.company_logo && <span className="text-xs text-primary">Uploading...</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                    {profile.profile_picture ? (
                        <img src={`${BACKEND_URL}${profile.profile_picture}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <User size={24} className="text-primary" />
                    )}
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

            {/* Crop Dialog */}
            <Dialog open={cropDialog} onOpenChange={(open) => { if (!open) { setCropDialog(false); setCropImage(null); } }}>
                <DialogContent className="bg-card border-border max-w-md p-0 overflow-hidden" data-testid="crop-dialog">
                    <DialogHeader className="p-4 pb-0">
                        <DialogTitle className="text-lg" style={{fontFamily:'Outfit'}}>Crop Profile Picture</DialogTitle>
                        <p className="text-xs text-muted-foreground">Position your face in the circle. Pinch or use slider to zoom.</p>
                    </DialogHeader>
                    <div className="relative w-full h-72 bg-black">
                        {cropImage && (
                            <Cropper
                                image={cropImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={true}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        )}
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <ZoomOut size={16} className="text-muted-foreground shrink-0" />
                            <input
                                type="range" min={1} max={3} step={0.1} value={zoom}
                                onChange={e => setZoom(Number(e.target.value))}
                                className="flex-1 accent-primary"
                                data-testid="crop-zoom-slider"
                            />
                            <ZoomIn size={16} className="text-muted-foreground shrink-0" />
                        </div>
                        <Button onClick={handleCropConfirm} className="w-full bg-primary" data-testid="crop-confirm-btn">
                            <Check size={16} className="mr-2" />Save Photo
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
