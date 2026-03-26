import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Lock, Trophy, ArrowUp, ArrowDown, Timer, Zap, Users, Hash } from 'lucide-react';

export default function LiveScreen() {
    const { eventId: paramEventId } = useParams();
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [eventId, setEventId] = useState(paramEventId || '');
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState(null);
    const [event, setEvent] = useState(null);
    const [roundTimeLeft, setRoundTimeLeft] = useState(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!paramEventId) {
            API.get('/live/events').then(r => setEvents(r.data)).catch(() => {});
        }
    }, [paramEventId]);

    const authenticate = async () => {
        try {
            await API.post('/live/auth', { password });
            setAuthenticated(true);
            toast.success('Access granted');
        } catch { toast.error('Invalid password'); }
    };

    useEffect(() => {
        if (!authenticated || !eventId) return;
        const fetchData = async () => {
            try {
                const [s, l] = await Promise.all([
                    API.get(`/live/stats/${eventId}`),
                    API.get(`/live/leaderboard/${eventId}`)
                ]);
                setStats(s.data);
                setLeaderboard(l.data);
                setEvent(s.data.event);
            } catch {}
        };
        fetchData();
        intervalRef.current = setInterval(fetchData, 5000);
        return () => clearInterval(intervalRef.current);
    }, [authenticated, eventId]);

    // Round timer
    useEffect(() => {
        if (!event?.round_start_time || !event?.round_duration_minutes) { setRoundTimeLeft(null); return; }
        const calcTime = () => {
            const started = new Date(event.round_start_time).getTime();
            const duration = event.round_duration_minutes * 60 * 1000;
            const remaining = Math.max(0, (started + duration) - Date.now());
            setRoundTimeLeft(remaining);
        };
        calcTime();
        const timer = setInterval(calcTime, 1000);
        return () => clearInterval(timer);
    }, [event?.round_start_time, event?.round_duration_minutes]);

    const formatTime = (ms) => {
        if (ms === null) return '--:--';
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6" data-testid="live-auth">
                <div className="w-full max-w-sm glass-card rounded-xl p-8 text-center animate-fade-in">
                    <Lock size={40} className="mx-auto mb-4 text-primary" />
                    <h1 className="text-2xl font-bold mb-2" style={{fontFamily:'Outfit'}}>SSNC Live Screen</h1>
                    <p className="text-sm text-muted-foreground mb-6">Enter password to access</p>
                    <form onSubmit={(e) => { e.preventDefault(); authenticate(); }}>
                        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                            className="bg-muted/50 border-border h-12 mb-4 text-center text-lg" data-testid="live-password-input" />
                        {!paramEventId && events.length > 0 && (
                            <select value={eventId} onChange={e => setEventId(e.target.value)}
                                className="w-full bg-muted/50 border border-border rounded-lg h-12 mb-4 text-foreground px-3" data-testid="live-event-select">
                                <option value="">Select Event</option>
                                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                            </select>
                        )}
                        <Button type="submit" className="w-full h-12 bg-primary text-lg font-semibold" data-testid="live-auth-btn">Enter</Button>
                    </form>
                </div>
            </div>
        );
    }

    if (!stats || !leaderboard) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-muted-foreground">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#050505] p-4 sm:p-8 overflow-hidden" data-testid="live-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Zap className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-black tracking-tighter" style={{fontFamily:'Outfit'}}>{event?.name || 'SSNC'}</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">{event?.venue}</p>
                    </div>
                </div>
                {event?.status === 'live' && (
                    <div className="flex items-center gap-4">
                        <Badge className="bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))] border-0 pulse-live text-lg px-4 py-1">LIVE</Badge>
                        {event.current_round > 0 && <span className="text-2xl font-black text-primary" style={{fontFamily:'Outfit'}}>Round {event.current_round}</span>}
                    </div>
                )}
            </div>

            {/* Timer & Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="glass-card rounded-xl p-5 text-center">
                    <Timer size={24} className="mx-auto mb-2 text-[hsl(var(--gold))]" />
                    <p className={`text-4xl sm:text-6xl font-black ${roundTimeLeft !== null && roundTimeLeft < 60000 ? 'text-destructive' : 'text-[hsl(var(--gold))]'}`} style={{fontFamily:'Outfit'}}>{formatTime(roundTimeLeft)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Time Remaining</p>
                </div>
                <div className="glass-card rounded-xl p-5 text-center">
                    <ArrowUp size={24} className="mx-auto mb-2 text-primary" />
                    <p className="text-4xl sm:text-6xl font-black text-primary" style={{fontFamily:'Outfit'}}>{stats.total_references}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total References</p>
                </div>
                <div className="glass-card rounded-xl p-5 text-center">
                    <Users size={24} className="mx-auto mb-2 text-[hsl(var(--emerald))]" />
                    <p className="text-4xl sm:text-6xl font-black text-[hsl(var(--emerald))]" style={{fontFamily:'Outfit'}}>{stats.attendance_count}</p>
                    <p className="text-xs text-muted-foreground mt-1">Attendance</p>
                </div>
                <div className="glass-card rounded-xl p-5 text-center">
                    <Hash size={24} className="mx-auto mb-2 text-[hsl(var(--cyan))]" />
                    <p className="text-4xl sm:text-6xl font-black text-[hsl(var(--cyan))]" style={{fontFamily:'Outfit'}}>{stats.registration_count}</p>
                    <p className="text-xs text-muted-foreground mt-1">Registered</p>
                </div>
            </div>

            {/* Leaderboards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Top Givers */}
                <div className="glass-card rounded-xl p-5">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2"><ArrowUp size={14} className="text-primary" />Max References Given</h3>
                    <div className="space-y-3">
                        {leaderboard.top_givers.map((g, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]' : i === 1 ? 'bg-white/10 text-foreground' : i === 2 ? 'bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))]' : 'bg-white/5 text-muted-foreground'}`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{g.user.full_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{g.user.business_name}</p>
                                </div>
                                <span className="text-lg font-black text-primary" style={{fontFamily:'Outfit'}}>{g.count}</span>
                            </div>
                        ))}
                        {leaderboard.top_givers.length === 0 && <p className="text-sm text-muted-foreground text-center">No data yet</p>}
                    </div>
                </div>

                {/* Top Receivers */}
                <div className="glass-card rounded-xl p-5">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2"><ArrowDown size={14} className="text-[hsl(var(--emerald))]" />Max References Received</h3>
                    <div className="space-y-3">
                        {leaderboard.top_receivers.map((r, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]' : i === 1 ? 'bg-white/10 text-foreground' : i === 2 ? 'bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))]' : 'bg-white/5 text-muted-foreground'}`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{r.user.full_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{r.user.business_name}</p>
                                </div>
                                <span className="text-lg font-black text-[hsl(var(--emerald))]" style={{fontFamily:'Outfit'}}>{r.count}</span>
                            </div>
                        ))}
                        {leaderboard.top_receivers.length === 0 && <p className="text-sm text-muted-foreground text-center">No data yet</p>}
                    </div>
                </div>

                {/* Table Leaderboard */}
                <div className="glass-card rounded-xl p-5">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2"><Trophy size={14} className="text-[hsl(var(--gold))]" />Table Leaderboard</h3>
                    <div className="space-y-3">
                        {leaderboard.table_stats.map((t, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="table-badge text-sm w-8 h-8">{t.table_number}</div>
                                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary to-[hsl(var(--cyan))] rounded-full transition-all duration-500" style={{width: `${Math.min(100, (t.count / Math.max(1, leaderboard.table_stats[0]?.count)) * 100)}%`}} />
                                </div>
                                <span className="text-sm font-bold text-[hsl(var(--gold))]">{t.count}</span>
                            </div>
                        ))}
                        {leaderboard.table_stats.length === 0 && <p className="text-sm text-muted-foreground text-center">No data yet</p>}
                    </div>
                </div>
            </div>

            {/* Round Stats */}
            {leaderboard.round_stats.length > 0 && (
                <div className="glass-card rounded-xl p-5 mt-6">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">References Per Round</h3>
                    <div className="flex gap-4 overflow-x-auto">
                        {leaderboard.round_stats.map((r, i) => (
                            <div key={i} className="text-center flex-shrink-0">
                                <p className="text-3xl font-black text-primary" style={{fontFamily:'Outfit'}}>{r.count}</p>
                                <p className="text-xs text-muted-foreground">Round {r.round}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
