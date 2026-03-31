import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Send, Eye, Building2, Check, X } from 'lucide-react';

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
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-foreground hover:scale-110 transition-transform"
                        style={{ backgroundColor: s.color }} title={key} data-testid={`social-${key}`}>
                        {s.label}
                    </a>
                );
            })}
        </div>
    );
}

export default function PunchReferences() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [activeEvent, setActiveEvent] = useState(null);
    const [myTables, setMyTables] = useState([]);
    const [selectedRound, setSelectedRound] = useState(null);
    const [tablePeople, setTablePeople] = useState([]);
    const [tableNumber, setTableNumber] = useState(0);
    const [refCounts, setRefCounts] = useState({});
    const [loading, setLoading] = useState(false);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [refForm, setRefForm] = useState({ contact_name: '', contact_phone: '', contact_email: '', notes: '' });

    useEffect(() => {
        API.get('/user/events').then(r => {
            setEvents(r.data);
            const reg = r.data.find(e => e.is_registered);
            if (reg) {
                setActiveEvent(reg);
                API.get(`/user/events/${reg.id}/my-tables`).then(t => setMyTables(t.data)).catch(() => {});
                loadRefCounts(reg.id);
            }
        }).catch(() => {});
    }, []);

    const loadRefCounts = async (eventId) => {
        try {
            const refs = await API.get(`/user/references/${eventId}`);
            const counts = {};
            for (const g of refs.data.given) {
                const key = `${g.to_user_id}-${g.round_number}`;
                counts[key] = (counts[key] || 0) + 1;
            }
            setRefCounts(counts);
        } catch {}
    };

    const loadTablePeople = async (roundNumber) => {
        if (!activeEvent) return;
        setSelectedRound(roundNumber);
        try {
            const r = await API.get(`/user/events/${activeEvent.id}/table-people/${roundNumber}`);
            setTablePeople(r.data.people);
            setTableNumber(r.data.table_number);
        } catch { setTablePeople([]); }
    };

    // Open dialog with empty form (manual entry)
    const openRefDialog = (person) => {
        setSelectedPerson(person);
        setRefForm({ contact_name: '', contact_phone: '', contact_email: '', notes: '' });
        setDialogOpen(true);
    };

    const submitReference = async () => {
        if (!activeEvent || !selectedRound || !selectedPerson) return;
        setLoading(true);
        try {
            await API.post('/user/references', {
                event_id: activeEvent.id,
                to_user_id: selectedPerson.id,
                round_number: selectedRound,
                table_number: tableNumber,
                ...refForm
            });
            toast.success('Reference passed!');
            const key = `${selectedPerson.id}-${selectedRound}`;
            setRefCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
            setDialogOpen(false);
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
        setLoading(false);
    };

    if (!activeEvent) return <div className="p-4 text-center text-muted-foreground">No registered event</div>;

    return (
        <div className="space-y-6 animate-fade-in" data-testid="pass-references">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Pass References</h1>
                    <p className="text-sm text-muted-foreground mt-1">{activeEvent.name}</p>
                </div>
                <Link to="/user/references/view" data-testid="view-references-link">
                    <Button variant="outline" size="sm"><Eye size={14} className="mr-1" />View Received</Button>
                </Link>
            </div>

            <div>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Select Round</h3>
                <div className="flex gap-2 flex-wrap">
                    {myTables.map(t => (
                        <Button key={t.round_number} variant={selectedRound === t.round_number ? 'default' : 'outline'}
                            onClick={() => loadTablePeople(t.round_number)}
                            className={selectedRound === t.round_number ? 'bg-primary' : ''}
                            data-testid={`round-${t.round_number}-btn`}>
                            Round {t.round_number} <span className="ml-2 text-xs opacity-70">Table {t.table_number}</span>
                        </Button>
                    ))}
                </div>
                {myTables.length === 0 && <p className="text-sm text-muted-foreground">Table assignments not ready yet</p>}
            </div>

            {selectedRound && (
                <div>
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">People at Table {tableNumber}</h3>
                    <div className="space-y-3">
                        {tablePeople.map(p => {
                            const key = `${p.id}-${selectedRound}`;
                            const count = refCounts[key] || 0;
                            return (
                                <div key={p.id} className="glass-card rounded-xl p-4" data-testid={`person-${p.id}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                                                {(p.full_name || '?')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{p.full_name}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <Building2 size={10} />{p.business_name}
                                                    {p.category_name && <Badge variant="outline" className="text-[10px] px-1.5">{p.category_name}</Badge>}
                                                    {p.subcategory_name && <Badge variant="outline" className="text-[10px] px-1.5">{p.subcategory_name}</Badge>}
                                                </div>
                                                <SocialIcons links={p.social_links} />
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <Button size="sm" onClick={() => openRefDialog(p)} className="bg-primary" data-testid={`pass-ref-${p.id}`}>
                                                <Send size={14} className="mr-1" />Pass Ref
                                            </Button>
                                            {count > 0 && (
                                                <Badge className="bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))] border-0 text-[10px]">
                                                    <Check size={10} className="mr-0.5" />{count} passed
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {tablePeople.length === 0 && <p className="text-center text-muted-foreground p-6 glass-card rounded-xl">No one at this table yet</p>}
                    </div>
                </div>
            )}

            {/* Pass Reference Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md" data-testid="pass-ref-dialog">
                    <DialogHeader>
                        <DialogTitle className="text-lg" style={{fontFamily:'Outfit'}}>
                            Pass Reference to {selectedPerson?.full_name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <p className="text-xs text-muted-foreground">Add the contact details of the person you are referring.</p>

                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <Label className="text-xs">Contact Name</Label>
                                <Input value={refForm.contact_name} onChange={e => setRefForm(p => ({ ...p, contact_name: e.target.value }))}
                                    placeholder="Person's name" className="bg-muted/50 border-border h-10 mt-1" data-testid="ref-contact-name" />
                            </div>
                            <div>
                                <Label className="text-xs">Contact Phone</Label>
                                <Input value={refForm.contact_phone} onChange={e => setRefForm(p => ({ ...p, contact_phone: e.target.value }))}
                                    placeholder="Phone number" className="bg-muted/50 border-border h-10 mt-1" data-testid="ref-contact-phone" />
                            </div>
                            <div>
                                <Label className="text-xs">Contact Email</Label>
                                <Input value={refForm.contact_email} onChange={e => setRefForm(p => ({ ...p, contact_email: e.target.value }))}
                                    placeholder="Email address" className="bg-muted/50 border-border h-10 mt-1" data-testid="ref-contact-email" />
                            </div>
                            <div>
                                <Label className="text-xs">Note</Label>
                                <Textarea value={refForm.notes} onChange={e => setRefForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="E.g., Looking for web development services, budget ~50k"
                                    className="bg-muted/50 border-border mt-1 min-h-[80px] text-sm" data-testid="ref-notes" />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button onClick={submitReference} disabled={loading} className="flex-1 bg-primary" data-testid="submit-ref-btn">
                                <Send size={14} className="mr-2" />{loading ? 'Passing...' : 'Pass Reference'}
                            </Button>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}><X size={14} /></Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
