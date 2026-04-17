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
import { Send, Eye, Building2, Check, X, QrCode, Hash, Search } from 'lucide-react';
import QrScanner from '@/components/QrScanner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Branded SVG icons (Simple Icons paths, 24x24 viewBox)
const ICON_PATHS = {
    whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
    linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
    twitter: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 011.141.195v3.325a8.623 8.623 0 00-.653-.036 26.805 26.805 0 00-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 00-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647z',
    youtube: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
    website: 'M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm-1 21.95C5.92 21.46 2 17.19 2 12c0-.78.096-1.54.258-2.28L7 14.5V16c0 1.1.9 2 2 2v3.95zM17.9 18.55c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V8h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.81 3.98-2.1 5.55z',
};

const SOCIAL_META = {
    whatsapp: { color: '#25D366', url: v => `https://wa.me/${v.replace(/[^\d+]/g, '')}` },
    linkedin: { color: '#0A66C2', url: v => v.startsWith('http') ? v : `https://linkedin.com/in/${v}` },
    instagram: { color: '#E4405F', url: v => v.startsWith('http') ? v : `https://instagram.com/${v}` },
    twitter: { color: '#000000', url: v => v.startsWith('http') ? v : `https://x.com/${v}` },
    facebook: { color: '#1877F2', url: v => v.startsWith('http') ? v : `https://facebook.com/${v}` },
    youtube: { color: '#FF0000', url: v => v.startsWith('http') ? v : `https://youtube.com/${v}` },
    website: { color: '#6366F1', url: v => v.startsWith('http') ? v : `https://${v}` },
};

function SocialIcons({ links }) {
    if (!links) return null;
    const active = Object.entries(links).filter(([, v]) => v);
    if (active.length === 0) return null;
    return (
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {active.map(([key, val]) => {
                const s = SOCIAL_META[key];
                const path = ICON_PATHS[key];
                if (!s || !path) return null;
                return (
                    <a key={key} href={s.url(val)} target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                        style={{ backgroundColor: s.color }} title={key} data-testid={`social-${key}`}>
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="white" aria-hidden="true">
                            <path d={path} />
                        </svg>
                    </a>
                );
            })}
        </div>
    );
}

function PersonCard({ person, selectedRound, refCounts, onPassRef, refsEnabled }) {
    const key = `${person.id}-${selectedRound || 'quick'}`;
    const count = refCounts[key] || 0;
    return (
        <div className="glass-card rounded-xl p-4" data-testid={`person-${person.id}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0 overflow-hidden ring-2 ring-border">
                        {person.profile_picture ? (
                            <img src={`${BACKEND_URL}${person.profile_picture}`} alt={person.full_name}
                                className="w-full h-full object-cover" />
                        ) : (
                            (person.full_name || '?')[0].toUpperCase()
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{person.full_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <Building2 size={10} className="shrink-0" /><span className="truncate">{person.business_name}</span>
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {person.category_name && <Badge variant="outline" className="text-[10px] px-1.5 whitespace-nowrap">{person.category_name}</Badge>}
                            {person.subcategory_name && <Badge variant="outline" className="text-[10px] px-1.5 whitespace-nowrap">{person.subcategory_name}</Badge>}
                            {person.badge_number && <Badge className="text-[10px] px-1.5 bg-primary/20 text-primary border-0">Badge #{person.badge_number}</Badge>}
                        </div>
                        <SocialIcons links={person.social_links} />
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {refsEnabled ? (
                        <Button size="sm" onClick={() => onPassRef(person)} className="bg-primary" data-testid={`pass-ref-${person.id}`}>
                            <Send size={14} className="mr-1" />Pass Ref
                        </Button>
                    ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Refs not open</Badge>
                    )}
                    {count > 0 && (
                        <Badge className="bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))] border-0 text-[10px]">
                            <Check size={10} className="mr-0.5" />{count} passed
                        </Badge>
                    )}
                </div>
            </div>
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

    // Quick reference state
    const [showScanner, setShowScanner] = useState(false);
    const [badgeInput, setBadgeInput] = useState('');
    const [quickPerson, setQuickPerson] = useState(null);
    const [lookupLoading, setLookupLoading] = useState(false);

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

    const refsEnabled = activeEvent?.references_enabled || false;

    const loadRefCounts = async (eventId) => {
        try {
            const refs = await API.get(`/user/references/${eventId}`);
            const counts = {};
            for (const g of refs.data.given) {
                const key = `${g.to_user_id}-${g.round_number}`;
                counts[key] = (counts[key] || 0) + 1;
                const quickKey = `${g.to_user_id}-quick`;
                counts[quickKey] = (counts[quickKey] || 0) + 1;
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

    // QR scan handler — extract user ID from profile URL
    const handleQrScan = async (scannedText) => {
        setShowScanner(false);
        const match = scannedText.match(/\/profile\/([a-f0-9-]+)/i);
        const userId = match ? match[1] : scannedText.trim();
        if (!userId) { toast.error('Invalid QR code'); return; }
        setLookupLoading(true);
        try {
            const r = await API.get(`/user/lookup-profile/${userId}`);
            setQuickPerson(r.data);
            toast.success(`Found: ${r.data.full_name}`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'User not found');
            setQuickPerson(null);
        }
        setLookupLoading(false);
    };

    // Badge number lookup
    const handleBadgeLookup = async () => {
        if (!badgeInput.trim() || !activeEvent) return;
        setLookupLoading(true);
        try {
            const r = await API.get(`/user/lookup-badge/${activeEvent.id}/${badgeInput.trim()}`);
            setQuickPerson(r.data);
            toast.success(`Found: ${r.data.full_name}`);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Badge not found');
            setQuickPerson(null);
        }
        setLookupLoading(false);
    };

    // Open dialog
    const openRefDialog = (person, isQuick = false) => {
        setSelectedPerson({ ...person, _isQuick: isQuick });
        setRefForm({ contact_name: '', contact_phone: '', contact_email: '', notes: '' });
        setDialogOpen(true);
    };

    const submitReference = async () => {
        if (!activeEvent || !selectedPerson) return;
        const isQuick = selectedPerson._isQuick;
        const roundNum = isQuick ? (activeEvent.current_round || 1) : selectedRound;
        const tblNum = isQuick ? 0 : tableNumber;
        setLoading(true);
        try {
            await API.post('/user/references', {
                event_id: activeEvent.id,
                to_user_id: selectedPerson.id,
                round_number: roundNum,
                table_number: tblNum,
                ...refForm
            });
            toast.success('Reference passed!');
            const key = `${selectedPerson.id}-${isQuick ? 'quick' : roundNum}`;
            setRefCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
            setDialogOpen(false);
            if (isQuick) { setQuickPerson(null); setBadgeInput(''); }
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

            {/* Quick Reference — QR Scan or Badge Number */}
            {!refsEnabled && (
                <div className="glass-card rounded-xl p-4 border-l-4 border-yellow-500 bg-yellow-500/5" data-testid="refs-disabled-banner">
                    <p className="text-sm font-medium">References are not open yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You can view table members but cannot pass references until the admin enables it.</p>
                </div>
            )}
            <div className="glass-card rounded-xl p-5" data-testid="quick-reference-section">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Quick Reference — Scan QR or Enter Badge</h3>
                <div className="flex gap-2 mb-3">
                    <Button variant={showScanner ? 'default' : 'outline'} size="sm"
                        onClick={() => setShowScanner(!showScanner)} data-testid="toggle-qr-scanner-btn">
                        <QrCode size={14} className="mr-1.5" />{showScanner ? 'Close Scanner' : 'Scan QR Code'}
                    </Button>
                    <div className="flex gap-1.5 flex-1">
                        <Input value={badgeInput} onChange={e => setBadgeInput(e.target.value)}
                            placeholder="Badge #" className="bg-muted/50 border-border h-9 w-24"
                            type="number" data-testid="badge-input"
                            onKeyDown={e => e.key === 'Enter' && handleBadgeLookup()} />
                        <Button variant="outline" size="sm" onClick={handleBadgeLookup}
                            disabled={lookupLoading || !badgeInput.trim()} data-testid="badge-lookup-btn">
                            <Search size={14} className="mr-1" />{lookupLoading ? '...' : 'Find'}
                        </Button>
                    </div>
                </div>

                {showScanner && (
                    <div className="mb-3">
                        <QrScanner onScan={handleQrScan} onError={(msg) => toast.error(msg)} />
                    </div>
                )}

                {quickPerson && (
                    <PersonCard person={quickPerson} selectedRound="quick" refCounts={refCounts}
                        onPassRef={(p) => openRefDialog(p, true)} refsEnabled={refsEnabled} />
                )}
            </div>

            {/* Table-based References */}
            <div>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Table References — Select Round</h3>
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
                        {tablePeople.map(p => (
                            <PersonCard key={p.id} person={p} selectedRound={selectedRound} refCounts={refCounts}
                                onPassRef={(person) => openRefDialog(person, false)} refsEnabled={refsEnabled} />
                        ))}
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
                                <Label className="text-xs">Contact Name <span className="text-red-500">*</span></Label>
                                <Input value={refForm.contact_name} onChange={e => setRefForm(p => ({ ...p, contact_name: e.target.value }))}
                                    placeholder="Person's name" className="bg-muted/50 border-border h-10 mt-1" data-testid="ref-contact-name" required />
                            </div>
                            <div>
                                <Label className="text-xs">Contact Phone <span className="text-red-500">*</span></Label>
                                <Input value={refForm.contact_phone} onChange={e => setRefForm(p => ({ ...p, contact_phone: e.target.value }))}
                                    placeholder="Phone number" className="bg-muted/50 border-border h-10 mt-1" data-testid="ref-contact-phone" required />
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
                            <Button onClick={submitReference} disabled={loading || !refForm.contact_name.trim() || !refForm.contact_phone.trim()} className="flex-1 bg-primary" data-testid="submit-ref-btn">
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
