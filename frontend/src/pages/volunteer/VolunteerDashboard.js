import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { QrCode, CheckCircle, AlertCircle, MapPin, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QrScanner from '@/components/QrScanner';
import { ThemeToggle, InstallButton, HeaderLogo } from '@/components/AppBranding';

export default function VolunteerDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState('');
    const [manualId, setManualId] = useState('');
    const [scanResult, setScanResult] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [mode, setMode] = useState('camera'); // 'camera' or 'manual'

    useEffect(() => {
        API.get('/volunteer/events').then(r => {
            setEvents(r.data);
            if (r.data.length === 1) setSelectedEvent(r.data[0].id);
        }).catch(() => {});
    }, []);

    const handleScan = async (userId) => {
        if (!selectedEvent) { toast.error('Select an event first'); return; }
        if (!userId) return;
        setScanning(true);
        try {
            const r = await API.post('/volunteer/scan', { user_id: userId, event_id: selectedEvent });
            setScanResult(r.data);
            toast.success(r.data.already_checked_in ? 'Already checked in' : 'Check-in successful!');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Scan failed');
            setScanResult(null);
        }
        setScanning(false);
    };

    const handleManualScan = () => {
        if (manualId.trim()) {
            let userId = manualId.trim();
            const match = userId.match(/\/profile\/([a-f0-9-]+)/);
            if (match) userId = match[1];
            handleScan(userId);
        }
    };

    const handleQrScan = (decodedText) => {
        let userId = decodedText;
        const match = decodedText.match(/\/profile\/([a-f0-9-]+)/);
        if (match) userId = match[1];
        handleScan(userId);
    };

    return (
        <div className="min-h-screen bg-background" data-testid="volunteer-dashboard">
            <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <HeaderLogo />
                    <Badge variant="outline" className="text-xs">Volunteer</Badge>
                </div>
                <div className="flex items-center gap-2">
                    <InstallButton />
                    <ThemeToggle />
                    <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }} data-testid="volunteer-logout-btn"><LogOut size={18} /></Button>
                </div>
            </header>

            <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6 animate-fade-in">
                <h1 className="text-2xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>QR Scanner</h1>

                <div className="glass-card rounded-xl p-5 space-y-4">
                    <div>
                        <Label className="text-xs text-muted-foreground">Select Event</Label>
                        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                            <SelectTrigger className="bg-muted/50 border-border h-11 mt-1" data-testid="volunteer-event-select">
                                <SelectValue placeholder="Choose event" />
                            </SelectTrigger>
                            <SelectContent>
                                {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex rounded-lg bg-muted/50 p-1 gap-1" data-testid="scan-mode-toggle">
                        <button
                            onClick={() => setMode('camera')}
                            className={`flex-1 h-9 rounded-md text-xs font-medium transition-all ${mode === 'camera' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                            data-testid="mode-camera-btn"
                        >
                            Camera Scan
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`flex-1 h-9 rounded-md text-xs font-medium transition-all ${mode === 'manual' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                            data-testid="mode-manual-btn"
                        >
                            Manual Entry
                        </button>
                    </div>

                    {mode === 'camera' ? (
                        <QrScanner
                            onScan={handleQrScan}
                            onError={(msg) => toast.error(msg)}
                        />
                    ) : (
                        <div>
                            <Label className="text-xs text-muted-foreground">Enter User ID or QR URL</Label>
                            <div className="flex gap-2 mt-1">
                                <Input value={manualId} onChange={e => setManualId(e.target.value)} placeholder="Paste QR URL or User ID"
                                    className="bg-muted/50 border-border h-11" data-testid="volunteer-scan-input"
                                    onKeyDown={e => e.key === 'Enter' && handleManualScan()} />
                                <Button onClick={handleManualScan} disabled={scanning} className="bg-primary h-11 px-6" data-testid="volunteer-scan-btn">
                                    <QrCode size={16} className="mr-2" />{scanning ? '...' : 'Scan'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {scanResult && (
                    <div className="glass-card rounded-xl p-5 space-y-4 animate-slide-up border-[hsl(var(--emerald))]/20" data-testid="scan-result">
                        {/* Badge Number - Big & Prominent */}
                        {scanResult.badge_number && (
                            <div className="text-center py-3 rounded-xl bg-primary/10 border border-primary/20" data-testid="badge-number">
                                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">ID Card Number</p>
                                <p className="text-6xl font-black text-primary" style={{fontFamily:'Outfit'}}>#{scanResult.badge_number}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            {scanResult.already_checked_in ?
                                <AlertCircle size={24} className="text-[hsl(var(--gold))]" /> :
                                <CheckCircle size={24} className="text-[hsl(var(--emerald))]" />
                            }
                            <div>
                                <p className="font-bold text-lg">{scanResult.user.full_name}</p>
                                <p className="text-sm text-muted-foreground">{scanResult.user.business_name} - {scanResult.user.position}</p>
                            </div>
                        </div>

                        <Badge className={scanResult.already_checked_in ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]' : 'bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))]'}>
                            {scanResult.already_checked_in ? 'Already Marked Present' : 'Checked In Successfully'}
                        </Badge>
                        {scanResult.already_checked_in && scanResult.checked_in_at && (
                            <p className="text-xs text-muted-foreground">Checked in at: {new Date(scanResult.checked_in_at).toLocaleTimeString()}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {scanResult.user.category_name && (
                                <Badge variant="outline" className="text-xs">{scanResult.user.category_name}</Badge>
                            )}
                            {scanResult.user.subcategory_name && (
                                <Badge variant="outline" className="text-xs">{scanResult.user.subcategory_name}</Badge>
                            )}
                        </div>

                        {scanResult.table_assignments.length > 0 && (
                            <div>
                                <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-1"><MapPin size={12} />Table Assignments</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {scanResult.table_assignments.map((t, i) => (
                                        <div key={i} className="bg-muted rounded-lg p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Round {t.round}</p>
                                            <p className="text-xl font-black text-primary" style={{fontFamily:'Outfit'}}>{t.table}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 text-xs text-muted-foreground">
                            {scanResult.user.phone && <span>Phone: {scanResult.user.phone}</span>}
                            {scanResult.user.email && <span>Email: {scanResult.user.email}</span>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
