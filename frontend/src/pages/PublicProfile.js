import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '@/lib/api';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Globe, Linkedin, Instagram, Twitter, Youtube, Facebook, MessageCircle, Download, Building2, Briefcase, Zap } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function PublicProfile() {
    const { userId } = useParams();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        API.get(`/public/profile/${userId}`).then(r => { setUser(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [userId]);

    const downloadVCard = () => {
        window.open(`${BACKEND_URL}/api/public/vcard/${userId}`, '_blank');
    };

    if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
    if (!user) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Profile not found</div>;

    const social = user.social_links || {};
    const socialLinks = [
        { key: 'linkedin', icon: Linkedin, label: 'LinkedIn', url: social.linkedin, color: 'text-blue-400' },
        { key: 'instagram', icon: Instagram, label: 'Instagram', url: social.instagram, color: 'text-pink-400' },
        { key: 'twitter', icon: Twitter, label: 'X (Twitter)', url: social.twitter, color: 'text-foreground' },
        { key: 'youtube', icon: Youtube, label: 'YouTube', url: social.youtube, color: 'text-red-400' },
        { key: 'facebook', icon: Facebook, label: 'Facebook', url: social.facebook, color: 'text-blue-500' },
        { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', url: social.whatsapp, color: 'text-[hsl(var(--emerald))]' },
        { key: 'website', icon: Globe, label: 'Website', url: social.website, color: 'text-primary' },
    ].filter(s => s.url);

    const getLink = (item) => {
        if (item.key === 'whatsapp') return `https://wa.me/${item.url}`;
        if (item.key === 'linkedin' && !item.url.startsWith('http')) return `https://${item.url}`;
        if (item.key === 'website' && !item.url.startsWith('http')) return `https://${item.url}`;
        if (item.key === 'instagram') return `https://instagram.com/${item.url.replace('@', '')}`;
        if (item.key === 'twitter') return `https://x.com/${item.url.replace('@', '')}`;
        if (item.key === 'youtube') return item.url.startsWith('http') ? item.url : `https://youtube.com/${item.url}`;
        if (item.key === 'facebook') return item.url.startsWith('http') ? item.url : `https://facebook.com/${item.url}`;
        return item.url;
    };

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6" data-testid="public-profile">
            <div className="max-w-md mx-auto animate-fade-in">
                {/* Header */}
                <div className="glass-card rounded-2xl overflow-hidden mb-4">
                    <div className="h-24 bg-gradient-to-br from-primary/30 via-[hsl(var(--cyan))]/10 to-transparent" />
                    <div className="px-6 pb-6 -mt-10">
                        <div className="w-20 h-20 rounded-2xl bg-muted border-4 border-background flex items-center justify-center text-3xl font-black text-primary" style={{fontFamily:'Outfit'}}>
                            {(user.full_name || '?')[0].toUpperCase()}
                        </div>
                        <h1 className="text-2xl font-bold mt-3" style={{fontFamily:'Outfit'}}>{user.full_name}</h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Briefcase size={14} />{user.position} at {user.business_name}
                        </p>
                        {user.category_name && (
                            <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">{user.category_name}</Badge>
                                {user.subcategory_name && <Badge variant="outline" className="text-xs">{user.subcategory_name}</Badge>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Contact */}
                <div className="glass-card rounded-xl p-5 mb-4 space-y-3">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Contact</h3>
                    {user.phone && (
                        <a href={`tel:${user.phone}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-white/5 transition-colors" data-testid="contact-phone">
                            <Phone size={18} className="text-primary" /><span className="text-sm">{user.phone}</span>
                        </a>
                    )}
                    {user.email && (
                        <a href={`mailto:${user.email}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-white/5 transition-colors" data-testid="contact-email">
                            <Mail size={18} className="text-primary" /><span className="text-sm">{user.email}</span>
                        </a>
                    )}
                </div>

                {/* Social Links */}
                {socialLinks.length > 0 && (
                    <div className="glass-card rounded-xl p-5 mb-4 space-y-3">
                        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Social</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {socialLinks.map(s => (
                                <a key={s.key} href={getLink(s)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-white/5 transition-colors" data-testid={`social-${s.key}`}>
                                    <s.icon size={16} className={s.color} />
                                    <span className="text-sm truncate">{s.label}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* QR Code */}
                <div className="glass-card rounded-xl p-5 mb-4 text-center">
                    <div className="inline-block p-4 bg-white rounded-xl mb-3">
                        <QRCode value={window.location.href} size={140} />
                    </div>
                    <p className="text-xs text-muted-foreground">Scan to view this profile</p>
                </div>

                {/* Save Contact */}
                <Button onClick={downloadVCard} className="w-full h-12 bg-primary text-base font-semibold" data-testid="save-contact-btn">
                    <Download size={16} className="mr-2" />Save Contact
                </Button>

                <div className="text-center mt-6 pb-4">
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Zap size={12} className="text-primary" />Powered by SSNC
                    </div>
                </div>
            </div>
        </div>
    );
}
