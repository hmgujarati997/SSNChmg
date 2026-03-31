import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from '@/lib/api';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Globe, Download, Building2, Briefcase, Zap } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SocialIcon = ({ platform, className = "" }) => {
    const icons = {
        linkedin: (
            <svg viewBox="0 0 24 24" className={className} fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
        ),
        instagram: (
            <svg viewBox="0 0 24 24" className={className} fill="currentColor">
                <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.88 0 1.441 1.441 0 012.88 0z"/>
            </svg>
        ),
        twitter: (
            <svg viewBox="0 0 24 24" className={className} fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
        ),
        youtube: (
            <svg viewBox="0 0 24 24" className={className} fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
        ),
        facebook: (
            <svg viewBox="0 0 24 24" className={className} fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
        ),
        whatsapp: (
            <svg viewBox="0 0 24 24" className={className} fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
        ),
        website: (
            <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
        ),
    };
    return icons[platform] || null;
};

const SOCIAL_COLORS = {
    linkedin: '#0A66C2',
    instagram: '#E4405F',
    twitter: '#000000',
    youtube: '#FF0000',
    facebook: '#1877F2',
    whatsapp: '#25D366',
    website: '#6366f1',
};

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
        { key: 'linkedin', label: 'LinkedIn', url: social.linkedin },
        { key: 'instagram', label: 'Instagram', url: social.instagram },
        { key: 'twitter', label: 'X (Twitter)', url: social.twitter },
        { key: 'youtube', label: 'YouTube', url: social.youtube },
        { key: 'facebook', label: 'Facebook', url: social.facebook },
        { key: 'whatsapp', label: 'WhatsApp', url: social.whatsapp },
        { key: 'website', label: 'Website', url: social.website },
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
                {/* Header with Profile Picture & Company Logo */}
                <div className="glass-card rounded-2xl overflow-hidden mb-4">
                    <div className="h-24 bg-gradient-to-br from-primary/30 via-[hsl(var(--cyan))]/10 to-transparent" />
                    <div className="px-6 pb-6 -mt-10">
                        <div className="flex items-end justify-between">
                            <div className="w-20 h-20 rounded-2xl bg-muted border-4 border-background overflow-hidden flex items-center justify-center text-3xl font-black text-primary" style={{fontFamily:'Outfit'}}>
                                {user.profile_picture ? (
                                    <img src={`${BACKEND_URL}${user.profile_picture}`} alt={user.full_name} className="w-full h-full object-cover" data-testid="profile-picture" />
                                ) : (
                                    (user.full_name || '?')[0].toUpperCase()
                                )}
                            </div>
                            {user.company_logo && (
                                <div className="w-14 h-14 rounded-xl bg-white border border-border overflow-hidden flex items-center justify-center p-1 shadow-sm" data-testid="company-logo">
                                    <img src={`${BACKEND_URL}${user.company_logo}`} alt={user.business_name} className="w-full h-full object-contain" />
                                </div>
                            )}
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

                {/* Social Links with Brand Icons */}
                {socialLinks.length > 0 && (
                    <div className="glass-card rounded-xl p-5 mb-4 space-y-3">
                        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Social</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {socialLinks.map(s => (
                                <a key={s.key} href={getLink(s)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:brightness-110 transition-all" data-testid={`social-${s.key}`}>
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: SOCIAL_COLORS[s.key] + '18' }}>
                                        <SocialIcon platform={s.key} className="w-4 h-4" style={{ color: SOCIAL_COLORS[s.key] }} />
                                    </div>
                                    <span className="text-sm font-medium truncate">{s.label}</span>
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
