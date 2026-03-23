import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ArrowDown, ArrowUp, Building2, Phone, Mail, MessageCircle } from 'lucide-react';

export default function ViewReferences() {
    const [references, setReferences] = useState({ given: [], received: [] });
    const [events, setEvents] = useState([]);
    const [activeEvent, setActiveEvent] = useState(null);

    useEffect(() => {
        API.get('/user/events').then(r => {
            setEvents(r.data);
            const reg = r.data.find(e => e.is_registered);
            if (reg) {
                setActiveEvent(reg);
                API.get(`/user/references/${reg.id}`).then(refs => setReferences(refs.data)).catch(() => {});
            }
        }).catch(() => {});
    }, []);

    const RefCard = ({ ref: r, type }) => {
        const person = type === 'given' ? r.to_user : r.from_user;
        if (!person) return null;
        const social = person.social_links || {};
        return (
            <div className="glass-card rounded-xl p-4" data-testid={`ref-card-${r.id}`}>
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                        {(person.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">{person.full_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 size={10} />{person.business_name} - {person.position}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {person.phone && <a href={`tel:${person.phone}`} className="text-xs text-primary flex items-center gap-1"><Phone size={10} />{person.phone}</a>}
                            {person.email && <a href={`mailto:${person.email}`} className="text-xs text-primary flex items-center gap-1"><Mail size={10} />{person.email}</a>}
                            {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(var(--emerald))] flex items-center gap-1"><MessageCircle size={10} />WhatsApp</a>}
                        </div>
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
                <Link to="/user/references"><Button variant="ghost" size="icon" data-testid="back-to-punch"><ArrowLeft size={18} /></Button></Link>
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
                        {references.received.map(r => <RefCard key={r.id} ref={r} type="received" />)}
                        {references.received.length === 0 && <p className="text-center text-muted-foreground p-8">No references received yet</p>}
                    </div>
                </TabsContent>
                <TabsContent value="given">
                    <div className="space-y-3">
                        {references.given.map(r => <RefCard key={r.id} ref={r} type="given" />)}
                        {references.given.length === 0 && <p className="text-center text-muted-foreground p-8">No references given yet</p>}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
