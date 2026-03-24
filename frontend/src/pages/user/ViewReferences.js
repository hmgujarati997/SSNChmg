import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ArrowDown, ArrowUp, Building2, Phone, Mail, User } from 'lucide-react';

const SOCIAL_ICONS = {
    whatsapp: { color: '#25D366', label: 'WA', url: v => `https://wa.me/${v}` },
    linkedin: { color: '#0A66C2', label: 'in', url: v => v.startsWith('http') ? v : `https://linkedin.com/in/${v}` },
    instagram: { color: '#E4405F', label: 'IG', url: v => v.startsWith('http') ? v : `https://instagram.com/${v}` },
    twitter: { color: '#1DA1F2', label: 'X', url: v => v.startsWith('http') ? v : `https://x.com/${v}` },
    facebook: { color: '#1877F2', label: 'FB', url: v => v.startsWith('http') ? v : `https://facebook.com/${v}` },
    youtube: { color: '#FF0000', label: 'YT', url: v => v.startsWith('http') ? v : `https://youtube.com/${v}` },
    website: { color: '#6366F1', label: 'W', url: v => v.startsWith('http') ? v : `https://${v}` },
};

function SocialIcons({ links }) {
    if (!links) return null;
    const active = Object.entries(links).filter(([, v]) => v);
    if (active.length === 0) return null;
    return (
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {active.map(([key, val]) => {
                const s = SOCIAL_ICONS[key];
                if (!s) return null;
                return (
                    <a key={key} href={s.url(val)} target="_blank" rel="noopener noreferrer"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white hover:scale-110 transition-transform"
                        style={{ backgroundColor: s.color }} title={key}>
                        {s.label}
                    </a>
                );
            })}
        </div>
    );
}

export default function ViewReferences() {
    const [references, setReferences] = useState({ given: [], received: [] });
    const [activeEvent, setActiveEvent] = useState(null);

    useEffect(() => {
        API.get('/user/events').then(r => {
            const reg = r.data.find(e => e.is_registered);
            if (reg) {
                setActiveEvent(reg);
                API.get(`/user/references/${reg.id}`).then(refs => setReferences(refs.data)).catch(() => {});
            }
        }).catch(() => {});
    }, []);

    const RefCard = ({ r, type }) => {
        const person = type === 'given' ? r.to_user : r.from_user;
        if (!person) return null;
        return (
            <div className="glass-card rounded-xl p-4" data-testid={`ref-card-${r.id}`}>
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                        {(person.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">{person.full_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 size={10} />{person.business_name} - {person.position}</p>
                        <SocialIcons links={person.social_links} />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {person.phone && <a href={`tel:${person.phone}`} className="text-xs text-primary flex items-center gap-1"><Phone size={10} />{person.phone}</a>}
                            {person.email && <a href={`mailto:${person.email}`} className="text-xs text-primary flex items-center gap-1"><Mail size={10} />{person.email}</a>}
                        </div>
                        {/* Referred contact details */}
                        {(r.contact_name || r.contact_phone || r.contact_email) && (
                            <div className="mt-2 p-2 rounded-lg bg-black/20 border border-white/5">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1 flex items-center gap-1"><User size={9} />Referred Contact</p>
                                {r.contact_name && <p className="text-xs text-white">{r.contact_name}</p>}
                                <div className="flex gap-3 mt-0.5">
                                    {r.contact_phone && <a href={`tel:${r.contact_phone}`} className="text-[11px] text-primary flex items-center gap-1"><Phone size={9} />{r.contact_phone}</a>}
                                    {r.contact_email && <a href={`mailto:${r.contact_email}`} className="text-[11px] text-primary flex items-center gap-1"><Mail size={9} />{r.contact_email}</a>}
                                </div>
                            </div>
                        )}
                        {r.notes && <p className="text-xs text-muted-foreground mt-2 italic">"{r.notes}"</p>}
                        <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px]">Round {r.round_number}</Badge>
                            <Badge variant="outline" className="text-[10px]">Table {r.table_number}</Badge>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in" data-testid="view-references">
            <div className="flex items-center gap-3">
                <Link to="/user/references"><Button variant="ghost" size="icon" data-testid="back-to-refs"><ArrowLeft size={18} /></Button></Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>My References</h1>
                    <p className="text-sm text-muted-foreground">{activeEvent?.name}</p>
                </div>
            </div>

            <Tabs defaultValue="received" className="w-full">
                <TabsList className="bg-[#171717] w-full mb-4">
                    <TabsTrigger value="received" className="flex-1 flex items-center gap-1">
                        <ArrowDown size={14} />Received ({references.received.length})
                    </TabsTrigger>
                    <TabsTrigger value="given" className="flex-1 flex items-center gap-1">
                        <ArrowUp size={14} />Given ({references.given.length})
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="received">
                    <div className="space-y-3">
                        {references.received.map(r => <RefCard key={r.id} r={r} type="received" />)}
                        {references.received.length === 0 && <p className="text-center text-muted-foreground p-8">No references received yet</p>}
                    </div>
                </TabsContent>
                <TabsContent value="given">
                    <div className="space-y-3">
                        {references.given.map(r => <RefCard key={r.id} r={r} type="given" />)}
                        {references.given.length === 0 && <p className="text-center text-muted-foreground p-8">No references given yet</p>}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
