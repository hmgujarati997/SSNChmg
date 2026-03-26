import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { Calendar, MapPin, Clock, QrCode, ArrowRightLeft, ChevronRight } from 'lucide-react';

export default function UserDashboard() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [myTables, setMyTables] = useState([]);
    const [activeEvent, setActiveEvent] = useState(null);
    const [showQR, setShowQR] = useState(false);
    const frontendUrl = window.location.origin;

    useEffect(() => {
        API.get('/user/events').then(r => {
            setEvents(r.data);
            const registered = r.data.find(e => e.is_registered);
            if (registered) {
                setActiveEvent(registered);
                API.get(`/user/events/${registered.id}/my-tables`).then(t => setMyTables(t.data)).catch(() => {});
            }
        }).catch(() => {});
    }, []);

    const registerForEvent = async (eventId) => {
        try {
            const r = await API.post(`/user/events/${eventId}/register`);
            toast.success('Registered successfully!');
            if (r.data.payment_type === 'payment_link' && r.data.payment_link) {
                window.open(r.data.payment_link, '_blank');
            }
            // Refresh
            const ev = await API.get('/user/events');
            setEvents(ev.data);
            const reg = ev.data.find(e => e.is_registered);
            if (reg) setActiveEvent(reg);
        } catch (err) { toast.error(err.response?.data?.detail || 'Registration failed'); }
    };

    return (
        <div className="space-y-6 animate-fade-in" data-testid="user-dashboard">
            <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Welcome, {user?.full_name?.split(' ')[0]}</h1>
                <p className="text-sm text-muted-foreground mt-1">Speed Networking Conclave</p>
            </div>

            {/* QR Code Section */}
            {user && (
                <div className="glass-card rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2"><QrCode size={18} className="text-primary" />My QR Code</h3>
                        <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)} data-testid="toggle-qr-btn">
                            {showQR ? 'Hide' : 'Show'}
                        </Button>
                    </div>
                    {showQR && (
                        <div className="flex justify-center p-6 bg-white rounded-lg">
                            <QRCode value={`${frontendUrl}/profile/${user.id}`} size={180} data-testid="user-qr-code" />
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3 text-center">Scan to view your digital business card</p>
                </div>
            )}

            {/* Active Event */}
            {activeEvent && (
                <div className="glass-card rounded-xl p-5 border-primary/20">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <Badge className="mb-2 bg-primary/20 text-primary border-0">Registered</Badge>
                            <h3 className="text-lg font-bold">{activeEvent.name}</h3>
                        </div>
                        {activeEvent.status === 'live' && <Badge className="bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))] border-0 pulse-live">LIVE</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1"><Calendar size={14} />{activeEvent.date}</span>
                        <span className="flex items-center gap-1"><Clock size={14} />{activeEvent.time}</span>
                        <span className="flex items-center gap-1"><MapPin size={14} />{activeEvent.venue}</span>
                    </div>

                    {/* Table Assignments */}
                    {myTables.length > 0 && (
                        <div>
                            <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Your Table Assignments</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {myTables.map(t => (
                                    <div key={t.id} className="bg-muted rounded-lg p-3 text-center">
                                        <p className="text-xs text-muted-foreground">Round {t.round_number}</p>
                                        <p className="text-2xl font-black text-primary mt-1" style={{fontFamily:'Outfit'}}>{t.table_number}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Link to="/user/references" className="flex items-center justify-between mt-4 p-3 rounded-lg bg-muted hover:bg-white/5 transition-colors" data-testid="go-to-references">
                        <span className="flex items-center gap-2 text-sm font-medium"><ArrowRightLeft size={16} className="text-primary" />Punch References</span>
                        <ChevronRight size={16} className="text-muted-foreground" />
                    </Link>
                </div>
            )}

            {/* Available Events */}
            {events.filter(e => !e.is_registered && e.registration_open).length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Available Events</h3>
                    {events.filter(e => !e.is_registered && e.registration_open).map(e => (
                        <div key={e.id} className="glass-card rounded-xl p-5 mb-3">
                            <h4 className="font-semibold mb-1">{e.name}</h4>
                            <div className="flex gap-3 text-sm text-muted-foreground mb-3">
                                <span>{e.date}</span><span>{e.venue}</span><span className="text-[hsl(var(--gold))]">INR {e.registration_fee}</span>
                            </div>
                            <Button onClick={() => registerForEvent(e.id)} className="w-full" data-testid={`register-event-${e.id}`}>Register Now</Button>
                        </div>
                    ))}
                </div>
            )}

            {events.length === 0 && !activeEvent && (
                <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
                    <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                    <p>No events available right now</p>
                </div>
            )}
        </div>
    );
}
