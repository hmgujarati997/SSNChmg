import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Lock, Trophy, ArrowUp, ArrowDown, Users, Zap, Volume2 } from 'lucide-react';

export default function LiveScreen() {
    const { eventId: paramEventId } = useParams();
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [eventId, setEventId] = useState(paramEventId || '');
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState(null);
    const [event, setEvent] = useState(null);
    const intervalRef = useRef(null);

    // Speaker timer state
    const [speakerNum, setSpeakerNum] = useState(0);
    const [speakerTimeLeft, setSpeakerTimeLeft] = useState(null);
    const [timerPhase, setTimerPhase] = useState('idle'); // idle, speaking, concluding, done
    const speakerIntervalRef = useRef(null);
    const concludeAlertedRef = useRef(false);
    const doneAlertedRef = useRef(false);
    const audioCtxRef = useRef(null);

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

    // Audio beep
    const playBeep = useCallback((freq = 800, duration = 500, count = 1) => {
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioCtxRef.current;
            let t = ctx.currentTime;
            for (let i = 0; i < count; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.5, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + duration / 1000);
                osc.start(t);
                osc.stop(t + duration / 1000);
                t += (duration + 200) / 1000;
            }
        } catch {}
    }, []);

    // Speaker timer logic
    useEffect(() => {
        if (!event?.round_start_time || !event?.speaker_time_seconds) return;
        const speakerTime = event.speaker_time_seconds;
        const conclusionTime = event.conclusion_time_seconds || 60;
        const totalPerSpeaker = speakerTime + conclusionTime;
        const chairsPerTable = event.chairs_per_table || 3;

        const calcSpeaker = () => {
            const started = new Date(event.round_start_time).getTime();
            const elapsed = (Date.now() - started) / 1000;

            if (elapsed < 0) {
                setSpeakerNum(0);
                setSpeakerTimeLeft(null);
                setTimerPhase('idle');
                return;
            }

            const currentSpeakerIndex = Math.floor(elapsed / totalPerSpeaker);
            if (currentSpeakerIndex >= chairsPerTable) {
                setSpeakerNum(chairsPerTable);
                setSpeakerTimeLeft(0);
                setTimerPhase('done');
                if (!doneAlertedRef.current) {
                    playBeep(1000, 400, 3);
                    doneAlertedRef.current = true;
                }
                return;
            }

            const timeIntoThisSpeaker = elapsed - (currentSpeakerIndex * totalPerSpeaker);

            if (timeIntoThisSpeaker < speakerTime) {
                // Speaking phase
                const remaining = speakerTime - timeIntoThisSpeaker;
                setSpeakerNum(currentSpeakerIndex + 1);
                setSpeakerTimeLeft(Math.ceil(remaining));
                setTimerPhase('speaking');
                concludeAlertedRef.current = false;
                doneAlertedRef.current = false;
            } else {
                // Conclusion phase
                const remaining = totalPerSpeaker - timeIntoThisSpeaker;
                setSpeakerNum(currentSpeakerIndex + 1);
                setSpeakerTimeLeft(Math.ceil(remaining));
                setTimerPhase('concluding');
                if (!concludeAlertedRef.current) {
                    playBeep(600, 600, 2);
                    concludeAlertedRef.current = true;
                }
                doneAlertedRef.current = false;
            }
        };

        calcSpeaker();
        speakerIntervalRef.current = setInterval(calcSpeaker, 500);
        return () => clearInterval(speakerIntervalRef.current);
    }, [event?.round_start_time, event?.speaker_time_seconds, event?.conclusion_time_seconds, event?.chairs_per_table, playBeep]);

    const formatSec = (s) => {
        if (s === null || s === undefined) return '--:--';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
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

    if (!stats || !leaderboard) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-muted-foreground text-3xl">Loading...</div>;

    const timerColor = timerPhase === 'concluding' ? 'text-orange-400' : timerPhase === 'done' ? 'text-destructive' : 'text-[hsl(var(--gold))]';
    const timerBg = timerPhase === 'concluding' ? 'border-orange-400/30 bg-orange-400/5' : timerPhase === 'done' ? 'border-destructive/30 bg-destructive/5' : 'border-[hsl(var(--gold))]/20';

    return (
        <div className="min-h-screen bg-[#050505] p-4 overflow-hidden flex flex-col" data-testid="live-screen">
            {/* Top Bar: Round + Event Name */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <Zap className="w-6 h-6 text-primary" />
                    <h1 className="text-xl font-black tracking-tight" style={{fontFamily:'Outfit'}}>{event?.name || 'SSNC'}</h1>
                </div>
                <div className="flex items-center gap-4">
                    {event?.status === 'live' && (
                        <span className="bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))] border-0 px-4 py-1 rounded-full text-sm font-bold animate-pulse">LIVE</span>
                    )}
                    {event?.current_round > 0 && (
                        <span className="text-3xl font-black text-primary px-5 py-1 rounded-xl bg-primary/10 border border-primary/20" style={{fontFamily:'Outfit'}} data-testid="current-round">
                            ROUND {event.current_round}
                        </span>
                    )}
                </div>
            </div>

            {/* Main Layout: Timer center, Stats sides */}
            <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 mb-4">
                {/* Left: Total References */}
                <div className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center border border-primary/20">
                    <ArrowUp size={28} className="mb-2 text-primary" />
                    <p className="text-7xl font-black text-primary" style={{fontFamily:'Outfit'}} data-testid="total-references">{stats.total_references}</p>
                    <p className="text-lg text-muted-foreground mt-1 font-medium">Total References</p>
                </div>

                {/* Center: Speaker Timer */}
                <div className={`glass-card rounded-2xl p-6 flex flex-col items-center justify-center border ${timerBg}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Volume2 size={20} className={timerColor} />
                        <p className="text-lg font-bold text-muted-foreground uppercase tracking-widest">
                            {timerPhase === 'idle' ? 'Waiting...' :
                             timerPhase === 'speaking' ? `Speaker ${speakerNum}` :
                             timerPhase === 'concluding' ? `Speaker ${speakerNum} — CONCLUDE` :
                             'Round Complete'}
                        </p>
                    </div>
                    <p className={`text-[8rem] leading-none font-black ${timerColor}`} style={{fontFamily:'Outfit'}} data-testid="speaker-timer">
                        {formatSec(speakerTimeLeft)}
                    </p>
                    {timerPhase === 'concluding' && (
                        <p className="text-xl font-bold text-orange-400 mt-2 animate-pulse">Please wrap up!</p>
                    )}
                    {timerPhase === 'done' && (
                        <p className="text-xl font-bold text-destructive mt-2">Time&apos;s up! Switch speakers.</p>
                    )}
                    {timerPhase === 'speaking' && event?.speaker_time_seconds && (
                        <div className="w-full mt-3 bg-muted rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-[hsl(var(--gold))] rounded-full transition-all duration-500"
                                 style={{width: `${Math.max(0, (speakerTimeLeft / event.speaker_time_seconds) * 100)}%`}} />
                        </div>
                    )}
                </div>

                {/* Right: Attendance */}
                <div className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center border border-[hsl(var(--emerald))]/20">
                    <Users size={28} className="mb-2 text-[hsl(var(--emerald))]" />
                    <p className="text-7xl font-black text-[hsl(var(--emerald))]" style={{fontFamily:'Outfit'}} data-testid="attendance-count">{stats.attendance_count}</p>
                    <p className="text-lg text-muted-foreground mt-1 font-medium">Attendance</p>
                </div>
            </div>

            {/* Leaderboards - Full Width */}
            <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
                {/* Top Givers */}
                <div className="glass-card rounded-2xl p-5 overflow-hidden border border-primary/10">
                    <h3 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2"><ArrowUp size={16} className="text-primary" />Max References Given</h3>
                    <div className="space-y-3 overflow-y-auto" style={{maxHeight: 'calc(100vh - 420px)'}}>
                        {leaderboard.top_givers.map((g, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]' : i === 1 ? 'bg-white/10 text-foreground' : i === 2 ? 'bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))]' : 'bg-white/5 text-muted-foreground'}`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-bold truncate">{g.user.full_name}</p>
                                    <p className="text-sm text-muted-foreground truncate">{g.user.business_name}</p>
                                </div>
                                <span className="text-2xl font-black text-primary" style={{fontFamily:'Outfit'}}>{g.count}</span>
                            </div>
                        ))}
                        {leaderboard.top_givers.length === 0 && <p className="text-lg text-muted-foreground text-center py-6">No data yet</p>}
                    </div>
                </div>

                {/* Top Receivers */}
                <div className="glass-card rounded-2xl p-5 overflow-hidden border border-[hsl(var(--emerald))]/10">
                    <h3 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2"><ArrowDown size={16} className="text-[hsl(var(--emerald))]" />Max References Received</h3>
                    <div className="space-y-3 overflow-y-auto" style={{maxHeight: 'calc(100vh - 420px)'}}>
                        {leaderboard.top_receivers.map((r, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]' : i === 1 ? 'bg-white/10 text-foreground' : i === 2 ? 'bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))]' : 'bg-white/5 text-muted-foreground'}`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-bold truncate">{r.user.full_name}</p>
                                    <p className="text-sm text-muted-foreground truncate">{r.user.business_name}</p>
                                </div>
                                <span className="text-2xl font-black text-[hsl(var(--emerald))]" style={{fontFamily:'Outfit'}}>{r.count}</span>
                            </div>
                        ))}
                        {leaderboard.top_receivers.length === 0 && <p className="text-lg text-muted-foreground text-center py-6">No data yet</p>}
                    </div>
                </div>

                {/* Table Leaderboard */}
                <div className="glass-card rounded-2xl p-5 overflow-hidden border border-[hsl(var(--gold))]/10">
                    <h3 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2"><Trophy size={16} className="text-[hsl(var(--gold))]" />Table Leaderboard</h3>
                    <div className="space-y-3 overflow-y-auto" style={{maxHeight: 'calc(100vh - 420px)'}}>
                        {leaderboard.table_stats.map((t, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="table-badge text-lg w-10 h-10 font-black">{t.table_number}</div>
                                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary to-[hsl(var(--cyan))] rounded-full transition-all duration-500" style={{width: `${Math.min(100, (t.count / Math.max(1, leaderboard.table_stats[0]?.count)) * 100)}%`}} />
                                </div>
                                <span className="text-xl font-black text-[hsl(var(--gold))]" style={{fontFamily:'Outfit'}}>{t.count}</span>
                            </div>
                        ))}
                        {leaderboard.table_stats.length === 0 && <p className="text-lg text-muted-foreground text-center py-6">No data yet</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
