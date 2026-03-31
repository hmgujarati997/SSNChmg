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
    const [branding, setBranding] = useState({});
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
        API.get('/public/branding').then(r => setBranding(r.data)).catch(() => {});
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

    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-6" data-testid="live-auth">
                <div className="w-full max-w-sm rounded-xl p-8 text-center animate-fade-in border border-gray-200 shadow-lg bg-white">
                    <Lock size={40} className="mx-auto mb-4 text-primary" />
                    <h1 className="text-2xl font-bold mb-2 text-gray-900" style={{fontFamily:'Outfit'}}>SSNC Live Screen</h1>
                    <p className="text-sm text-gray-500 mb-6">Enter password to access</p>
                    <form onSubmit={(e) => { e.preventDefault(); authenticate(); }}>
                        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                            className="bg-gray-50 border-gray-300 h-12 mb-4 text-center text-lg text-gray-900" data-testid="live-password-input" />
                        {!paramEventId && events.length > 0 && (
                            <select value={eventId} onChange={e => setEventId(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg h-12 mb-4 text-gray-900 px-3" data-testid="live-event-select">
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

    if (!stats || !leaderboard) return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-3xl">Loading...</div>;

    const timerColor = timerPhase === 'concluding' ? 'text-orange-500' : timerPhase === 'done' ? 'text-red-600' : 'text-amber-600';
    const timerBg = timerPhase === 'concluding' ? 'border-orange-300 bg-orange-50' : timerPhase === 'done' ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50';
    const hasSponsor1 = branding.sponsor_name_1 || branding.sponsor_logo_1;
    const hasSponsor2 = branding.sponsor_name_2 || branding.sponsor_logo_2;
    const hasSponsors = hasSponsor1 || hasSponsor2;

    return (
        <div className="min-h-screen bg-gray-50 p-4 overflow-hidden flex flex-col" data-testid="live-screen">
            {/* Header: Logo+Event | DASHBOARD SPONSORS | LIVE+ROUND */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    {branding.header_logo ? (
                        <img src={`${backendUrl}${branding.header_logo}`} alt="Logo" className="h-9 w-auto object-contain" data-testid="live-header-logo" />
                    ) : (
                        <Zap className="w-6 h-6 text-primary" />
                    )}
                    <h1 className="text-xl font-black tracking-tight text-gray-900" style={{fontFamily:'Outfit'}}>{event?.name || 'SSNC'}</h1>
                </div>
                {hasSponsors && (
                    <span className="text-2xl font-black uppercase tracking-widest text-gray-700" style={{fontFamily:'Outfit'}}>Dashboard Sponsors</span>
                )}
                <div className="flex items-center gap-4">
                    {event?.status === 'live' && (
                        <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-1 rounded-full text-sm font-bold animate-pulse">LIVE</span>
                    )}
                    {event?.current_round > 0 && (
                        <span className="text-3xl font-black text-primary px-5 py-1 rounded-xl bg-primary/10 border border-primary/20" style={{fontFamily:'Outfit'}} data-testid="current-round">
                            ROUND {event.current_round}
                        </span>
                    )}
                </div>
            </div>

            {/* Row 2: Sponsor Boxes */}
            {hasSponsors && (
                <div className="grid grid-cols-2 gap-4 mb-4" data-testid="sponsor-banner">
                    <div className="rounded-2xl p-5 flex items-center justify-center gap-4 border border-gray-200 bg-white shadow-sm" data-testid="sponsor-1-display">
                        {branding.sponsor_logo_1 && (
                            <img src={`${backendUrl}${branding.sponsor_logo_1}`} alt={branding.sponsor_name_1 || 'Sponsor 1'} className="h-16 w-auto object-contain" />
                        )}
                        {branding.sponsor_name_1 && (
                            <span className="text-3xl font-black tracking-tight text-gray-900" style={{fontFamily:'Outfit'}} data-testid="sponsor-name-1-text">{branding.sponsor_name_1}</span>
                        )}
                    </div>
                    <div className="rounded-2xl p-5 flex items-center justify-center gap-4 border border-gray-200 bg-white shadow-sm" data-testid="sponsor-2-display">
                        {branding.sponsor_logo_2 && (
                            <img src={`${backendUrl}${branding.sponsor_logo_2}`} alt={branding.sponsor_name_2 || 'Sponsor 2'} className="h-16 w-auto object-contain" />
                        )}
                        {branding.sponsor_name_2 && (
                            <span className="text-3xl font-black tracking-tight text-gray-900" style={{fontFamily:'Outfit'}} data-testid="sponsor-name-2-text">{branding.sponsor_name_2}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Row 3: Total References | Timer | Attendance */}
            <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 mb-4">
                <div className="rounded-2xl p-5 flex flex-col items-center justify-center border border-primary/20 bg-white shadow-sm">
                    <ArrowUp size={28} className="mb-2 text-primary" />
                    <p className="text-7xl font-black text-primary" style={{fontFamily:'Outfit'}} data-testid="total-references">{stats.total_references}</p>
                    <p className="text-lg text-gray-500 mt-1 font-medium">Total References</p>
                </div>
                <div className={`rounded-2xl p-6 flex flex-col items-center justify-center border bg-white shadow-sm ${timerBg}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Volume2 size={20} className={timerColor} />
                        <p className="text-lg font-bold text-gray-500 uppercase tracking-widest">
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
                        <p className="text-xl font-bold text-orange-500 mt-2 animate-pulse">Please wrap up!</p>
                    )}
                    {timerPhase === 'done' && (
                        <p className="text-xl font-bold text-red-600 mt-2">Time&apos;s up! Switch speakers.</p>
                    )}
                    {timerPhase === 'speaking' && event?.speaker_time_seconds && (
                        <div className="w-full mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                 style={{width: `${Math.max(0, (speakerTimeLeft / event.speaker_time_seconds) * 100)}%`}} />
                        </div>
                    )}
                </div>
                <div className="rounded-2xl p-5 flex flex-col items-center justify-center border border-emerald-200 bg-white shadow-sm">
                    <Users size={28} className="mb-2 text-emerald-600" />
                    <p className="text-7xl font-black text-emerald-600" style={{fontFamily:'Outfit'}} data-testid="attendance-count">{stats.attendance_count}</p>
                    <p className="text-lg text-gray-500 mt-1 font-medium">Attendance</p>
                </div>
            </div>

            {/* Leaderboards - Full Width */}
            <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
                {/* Top Givers */}
                <div className="rounded-2xl p-5 overflow-hidden border border-primary/10 bg-white shadow-sm">
                    <h3 className="text-sm uppercase tracking-widest text-gray-500 font-bold mb-4 flex items-center gap-2"><ArrowUp size={16} className="text-primary" />Max References Given</h3>
                    <div className="space-y-3 overflow-y-auto" style={{maxHeight: 'calc(100vh - 420px)'}}>
                        {leaderboard.top_givers.map((g, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-sky-100 text-sky-700' : 'bg-gray-50 text-gray-400'}`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-bold truncate text-gray-900">{g.user.full_name}</p>
                                    <p className="text-sm text-gray-500 truncate">{g.user.business_name}</p>
                                </div>
                                <span className="text-2xl font-black text-primary" style={{fontFamily:'Outfit'}}>{g.count}</span>
                            </div>
                        ))}
                        {leaderboard.top_givers.length === 0 && <p className="text-lg text-gray-400 text-center py-6">No data yet</p>}
                    </div>
                </div>

                {/* Top Receivers */}
                <div className="rounded-2xl p-5 overflow-hidden border border-emerald-100 bg-white shadow-sm">
                    <h3 className="text-sm uppercase tracking-widest text-gray-500 font-bold mb-4 flex items-center gap-2"><ArrowDown size={16} className="text-emerald-600" />Max References Received</h3>
                    <div className="space-y-3 overflow-y-auto" style={{maxHeight: 'calc(100vh - 420px)'}}>
                        {leaderboard.top_receivers.map((r, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-sky-100 text-sky-700' : 'bg-gray-50 text-gray-400'}`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-bold truncate text-gray-900">{r.user.full_name}</p>
                                    <p className="text-sm text-gray-500 truncate">{r.user.business_name}</p>
                                </div>
                                <span className="text-2xl font-black text-emerald-600" style={{fontFamily:'Outfit'}}>{r.count}</span>
                            </div>
                        ))}
                        {leaderboard.top_receivers.length === 0 && <p className="text-lg text-gray-400 text-center py-6">No data yet</p>}
                    </div>
                </div>

                {/* Table Leaderboard */}
                <div className="rounded-2xl p-5 overflow-hidden border border-amber-100 bg-white shadow-sm">
                    <h3 className="text-sm uppercase tracking-widest text-gray-500 font-bold mb-4 flex items-center gap-2"><Trophy size={16} className="text-amber-600" />Table Leaderboard</h3>
                    <div className="space-y-3 overflow-y-auto" style={{maxHeight: 'calc(100vh - 420px)'}}>
                        {leaderboard.table_stats.map((t, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="table-badge text-lg w-10 h-10 font-black">{t.table_number}</div>
                                <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary to-sky-500 rounded-full transition-all duration-500" style={{width: `${Math.min(100, (t.count / Math.max(1, leaderboard.table_stats[0]?.count)) * 100)}%`}} />
                                </div>
                                <span className="text-xl font-black text-amber-600" style={{fontFamily:'Outfit'}}>{t.count}</span>
                            </div>
                        ))}
                        {leaderboard.table_stats.length === 0 && <p className="text-lg text-gray-400 text-center py-6">No data yet</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
