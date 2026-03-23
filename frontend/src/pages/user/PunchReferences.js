import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowRightLeft, Send, Eye, User, Building2, Check } from 'lucide-react';

export default function PunchReferences() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [activeEvent, setActiveEvent] = useState(null);
    const [myTables, setMyTables] = useState([]);
    const [selectedRound, setSelectedRound] = useState(null);
    const [tablePeople, setTablePeople] = useState([]);
    const [tableNumber, setTableNumber] = useState(0);
    const [notes, setNotes] = useState({});
    const [punched, setPunched] = useState(new Set());
    const [loading, setLoading] = useState({});

    useEffect(() => {
        API.get('/user/events').then(r => {
            setEvents(r.data);
            const reg = r.data.find(e => e.is_registered);
            if (reg) {
                setActiveEvent(reg);
                API.get(`/user/events/${reg.id}/my-tables`).then(t => setMyTables(t.data)).catch(() => {});
                API.get(`/user/references/${reg.id}`).then(refs => {
                    const punchedSet = new Set(refs.data.given.map(g => `${g.to_user_id}-${g.round_number}`));
                    setPunched(punchedSet);
                }).catch(() => {});
            }
        }).catch(() => {});
    }, []);

    const loadTablePeople = async (roundNumber) => {
        if (!activeEvent) return;
        setSelectedRound(roundNumber);
        try {
            const r = await API.get(`/user/events/${activeEvent.id}/table-people/${roundNumber}`);
            setTablePeople(r.data.people);
            setTableNumber(r.data.table_number);
        } catch { setTablePeople([]); }
    };

    const punchRef = async (toUserId) => {
        if (!activeEvent || !selectedRound) return;
        const key = `${toUserId}-${selectedRound}`;
        if (punched.has(key)) return;
        setLoading(prev => ({ ...prev, [toUserId]: true }));
        try {
            await API.post('/user/references', {
                event_id: activeEvent.id, to_user_id: toUserId,
                round_number: selectedRound, table_number: tableNumber,
                notes: notes[toUserId] || ''
            });
            toast.success('Reference punched!');
            setPunched(prev => new Set([...prev, key]));
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
        setLoading(prev => ({ ...prev, [toUserId]: false }));
    };

    if (!activeEvent) return <div className="p-4 text-center text-muted-foreground">No registered event</div>;

    return (
        <div className="space-y-6 animate-fade-in" data-testid="punch-references">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Punch References</h1>
                    <p className="text-sm text-muted-foreground mt-1">{activeEvent.name}</p>
                </div>
                <Link to="/user/references/view" data-testid="view-references-link">
                    <Button variant="outline" size="sm"><Eye size={14} className="mr-1" />View Received</Button>
                </Link>
            </div>

            {/* Round selector */}
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

            {/* People at table */}
            {selectedRound && (
                <div>
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">People at Table {tableNumber}</h3>
                    <div className="space-y-3">
                        {tablePeople.map(p => {
                            const key = `${p.id}-${selectedRound}`;
                            const isPunched = punched.has(key);
                            return (
                                <div key={p.id} className="glass-card rounded-xl p-4" data-testid={`person-${p.id}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                                                {(p.full_name || '?')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{p.full_name}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <Building2 size={10} />{p.business_name}
                                                    {p.category_name && <Badge variant="outline" className="text-[10px] px-1.5">{p.category_name}</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                        {isPunched ? (
                                            <Badge className="bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))] border-0"><Check size={12} className="mr-1" />Punched</Badge>
                                        ) : (
                                            <Button size="sm" onClick={() => punchRef(p.id)} disabled={loading[p.id]} className="bg-primary" data-testid={`punch-${p.id}`}>
                                                <Send size={14} className="mr-1" />{loading[p.id] ? '...' : 'Punch'}
                                            </Button>
                                        )}
                                    </div>
                                    {!isPunched && (
                                        <Input placeholder="Add notes (optional)" value={notes[p.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                                            className="bg-black/20 border-white/5 h-9 mt-3 text-sm" />
                                    )}
                                </div>
                            );
                        })}
                        {tablePeople.length === 0 && <p className="text-center text-muted-foreground p-6 glass-card rounded-xl">No one at this table yet</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
