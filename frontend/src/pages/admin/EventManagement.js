import { useState, useEffect, useRef } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Upload, Play, Square, Users, TableProperties, Crown, Trash2, ArrowLeft, Download, MessageCircle, RefreshCw, CheckCircle, XCircle, Loader2, UserPlus, Lock, Unlock, Shuffle, Pencil, Hash } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

function EventForm({ onCreated }) {
    const [form, setForm] = useState({ name: '', date: '', time: '', venue: '', registration_fee: 500, payment_type: 'manual', payment_link: '' });
    const [loading, setLoading] = useState(false);
    const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try { await API.post('/admin/events', form); toast.success('Event created!'); onCreated(); }
        catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
        setLoading(false);
    };
    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Event Name *</Label><Input value={form.name} onChange={e => u('name', e.target.value)} placeholder="SBC Speed Networking 2026" className="bg-muted/50 border-border h-11 mt-1" data-testid="event-name-input" /></div>
                <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => u('date', e.target.value)} className="bg-muted/50 border-border h-11 mt-1" data-testid="event-date-input" /></div>
                <div><Label>Time</Label><Input value={form.time} onChange={e => u('time', e.target.value)} placeholder="9:00 AM" className="bg-muted/50 border-border h-11 mt-1" data-testid="event-time-input" /></div>
                <div><Label>Venue</Label><Input value={form.venue} onChange={e => u('venue', e.target.value)} placeholder="SIECC Sarthana Surat" className="bg-muted/50 border-border h-11 mt-1" data-testid="event-venue-input" /></div>
                <div><Label>Reg. Fee (INR)</Label><Input type="number" value={form.registration_fee} onChange={e => u('registration_fee', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" /></div>
                <div><Label>Payment Type</Label>
                    <Select value={form.payment_type} onValueChange={v => u('payment_type', v)}>
                        <SelectTrigger className="bg-muted/50 border-border h-11 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="payment_link">Payment Link</SelectItem>
                            <SelectItem value="razorpay">Razorpay</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {form.payment_type === 'payment_link' && <div className="sm:col-span-2"><Label>Payment Link</Label><Input value={form.payment_link} onChange={e => u('payment_link', e.target.value)} className="bg-muted/50 border-border h-11 mt-1" /></div>}
            </div>
            <p className="text-xs text-muted-foreground">Table & round configuration can be set after creating the event.</p>
            <Button type="submit" className="w-full h-11" disabled={loading} data-testid="create-event-btn">{loading ? 'Creating...' : 'Create Event'}</Button>
        </form>
    );
}

function EventDetail({ eventId, onBack }) {
    const [event, setEvent] = useState(null);
    const [regs, setRegs] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [captains, setCaptains] = useState([]);
    const [users, setUsers] = useState([]);
    const [captainForm, setCaptainForm] = useState({ user_id: '', table_number: 1 });
    const [config, setConfig] = useState(null);
    const [savingConfig, setSavingConfig] = useState(false);
    const [captainSearch, setCaptainSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const fileRef = useRef(null);
    const [waStatus, setWaStatus] = useState(null);
    const [waSendingWelcome, setWaSendingWelcome] = useState(false);
    const [waSendingAssign, setWaSendingAssign] = useState(false);
    const [welcomeJob, setWelcomeJob] = useState(null);
    const [assignJob, setAssignJob] = useState(null);
    const welcomePollingRef = useRef(null);
    const assignPollingRef = useRef(null);

    // Day of Event state
    const [dayOfStatus, setDayOfStatus] = useState(null);
    const [spotForm, setSpotForm] = useState({ full_name: '', phone: '', business_name: '', category_id: '', subcategory_id: '', position: '' });
    const [spotSubcats, setSpotSubcats] = useState([]);
    const [spotLoading, setSpotLoading] = useState(false);
    const [reallocating, setReallocating] = useState(false);
    const [categories, setCategories] = useState([]);
    const [editSpot, setEditSpot] = useState(null);
    const [editSpotForm, setEditSpotForm] = useState({});
    const [editSpotSubcats, setEditSpotSubcats] = useState([]);
    const [savingSpot, setSavingSpot] = useState(false);

    const load = async () => {
        try {
            const [ev, rg, as, cp, us] = await Promise.all([
                API.get(`/admin/events/${eventId}`), API.get(`/admin/events/${eventId}/registrations`),
                API.get(`/admin/events/${eventId}/assignments`), API.get(`/admin/table-captains/${eventId}`),
                API.get('/admin/users')
            ]);
            setEvent(ev.data); setRegs(rg.data); setAssignments(as.data); setCaptains(cp.data); setUsers(us.data);
            API.get(`/admin/whatsapp/status/${eventId}`).then(r => setWaStatus(r.data)).catch(() => {});
            API.get(`/admin/events/${eventId}/day-of-status`).then(r => setDayOfStatus(r.data)).catch(() => {});
            API.get('/admin/categories').then(r => setCategories(r.data)).catch(() => {});
            // Find first available table number (fills gaps)
            const usedTables = new Set(cp.data.map(c => c.table_number));
            let nextTable = null;
            for (let i = 1; i <= (ev.data.total_tables || 10); i++) {
                if (!usedTables.has(i)) { nextTable = i; break; }
            }
            setCaptainForm(p => ({ ...p, table_number: nextTable }));
            setConfig({
                total_tables: ev.data.total_tables || 10,
                chairs_per_table: ev.data.chairs_per_table || 8,
                total_rounds: ev.data.total_rounds || 3,
                vacant_seats_per_table: ev.data.vacant_seats_per_table || 1,
                round_duration_minutes: ev.data.round_duration_minutes || 10,
                speaker_time_seconds: ev.data.speaker_time_seconds || 180,
                conclusion_time_seconds: ev.data.conclusion_time_seconds || 60
            });
        } catch {}
    };
    useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (welcomePollingRef.current) clearInterval(welcomePollingRef.current);
            if (assignPollingRef.current) clearInterval(assignPollingRef.current);
        };
    }, []);

    // Spot form subcategory loading
    useEffect(() => {
        if (spotForm.category_id) {
            API.get(`/admin/subcategories?category_id=${spotForm.category_id}`).then(r => setSpotSubcats(r.data)).catch(() => {});
        } else { setSpotSubcats([]); }
    }, [spotForm.category_id]);

    // Edit spot subcategory loading
    useEffect(() => {
        if (editSpotForm.category_id) {
            API.get(`/admin/subcategories?category_id=${editSpotForm.category_id}`).then(r => setEditSpotSubcats(r.data)).catch(() => {});
        } else { setEditSpotSubcats([]); }
    }, [editSpotForm.category_id]);

    const startPolling = (jobId, type) => {
        const ref = type === 'welcome' ? welcomePollingRef : assignPollingRef;
        const setJob = type === 'welcome' ? setWelcomeJob : setAssignJob;
        const setSending = type === 'welcome' ? setWaSendingWelcome : setWaSendingAssign;
        if (ref.current) clearInterval(ref.current);
        ref.current = setInterval(async () => {
            try {
                const r = await API.get(`/admin/whatsapp/job/${jobId}`);
                setJob(r.data);
                if (r.data.status === 'completed' || r.data.status === 'not_found') {
                    clearInterval(ref.current);
                    ref.current = null;
                    setSending(false);
                    // Refresh delivery status
                    API.get(`/admin/whatsapp/status/${eventId}`).then(r2 => setWaStatus(r2.data)).catch(() => {});
                }
            } catch {
                clearInterval(ref.current);
                ref.current = null;
                setSending(false);
            }
        }, 1500);
    };

    const uploadCSV = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const fd = new FormData(); fd.append('file', file);
        try { const r = await API.post(`/admin/events/${eventId}/upload-csv`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(`Created: ${r.data.created}, Registered: ${r.data.registered}, Skipped: ${r.data.skipped}`); load();
        } catch (err) { toast.error('CSV upload failed'); }
    };

    const downloadSampleCSV = () => {
        const csv = `full_name,phone,email,business_name,category,subcategory,position\nJohn Doe,9876543210,john@example.com,ABC Corp,IT Services,Web Development,Director\nJane Smith,9876543211,jane@example.com,XYZ Ltd,Real Estate,Commercial,Manager`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'sample_event_users.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const [assigningTables, setAssigningTables] = useState(false);
    const [assignProgress, setAssignProgress] = useState({ progress: 0, message: '' });
    const assignTables = async () => {
        if (assignments.length > 0 && !window.confirm('This will delete existing table assignments and create new ones. Continue?')) return;
        try {
            setAssigningTables(true);
            setAssignProgress({ progress: 0, message: 'Starting...' });
            const r = await API.post(`/admin/events/${eventId}/assign-tables`);
            const jobId = r.data.job_id;
            // Poll for completion
            const poll = setInterval(async () => {
                try {
                    const status = await API.get(`/admin/events/${eventId}/assign-tables/status/${jobId}`);
                    setAssignProgress({ progress: status.data.progress || 0, message: status.data.message || '' });
                    if (status.data.status === 'completed') {
                        clearInterval(poll);
                        setAssigningTables(false);
                        if (status.data.warning) {
                            toast.warning(status.data.warning);
                        } else {
                            toast.success(`Tables assigned! ${status.data.total_users} users across ${status.data.rounds} rounds.`);
                        }
                        load();
                    } else if (status.data.status === 'error') {
                        clearInterval(poll);
                        setAssigningTables(false);
                        toast.error(status.data.message || 'Assignment failed');
                    }
                } catch { /* keep polling */ }
            }, 2000);
        } catch (err) {
            setAssigningTables(false);
            toast.error(err.response?.data?.detail || 'Assignment failed');
        }
    };

    const downloadSeatingCSV = () => {
        const rows = [['Round', 'Table', 'Role', 'Name', 'Phone', 'Email', 'Position', 'Business', 'Category', 'Sub Category']];
        const rounds = [...new Set(assignments.map(a => a.round_number))].sort();
        for (const round of rounds) {
            const tables = assignments.filter(a => a.round_number === round).sort((a, b) => a.table_number - b.table_number);
            for (const t of tables) {
                if (t.captain) {
                    const c = t.captain;
                    rows.push([round, t.table_number, 'Captain', c.full_name || '', c.phone || '', c.email || '', c.position || '', c.business_name || '', c.category_name || '', c.subcategory_name || '']);
                }
                for (const u of (t.users || [])) {
                    rows.push([round, t.table_number, 'Member', u.full_name || '', u.phone || '', u.email || '', u.position || '', u.business_name || '', u.category_name || '', u.subcategory_name || '']);
                }
            }
        }
        const esc = v => { const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
        const csv = rows.map(r => r.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${event?.name || 'seating'}_seating_plan.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const roundControl = async (action, roundNumber) => {
        try { await API.post(`/admin/events/${eventId}/round-control`, { action, round_number: roundNumber || 0 });
            toast.success(`Round ${action}ed`); load();
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const toggleReg = async () => {
        try { const r = await API.post(`/admin/events/${eventId}/toggle-registration`);
            toast.success(r.data.registration_open ? 'Registration opened' : 'Registration closed'); load();
        } catch {}
    };

    const addCaptain = async () => {
        if (!captainForm.user_id) return;
        try { await API.post('/admin/table-captains', { event_id: eventId, ...captainForm });
            toast.success(`Captain assigned to Table ${captainForm.table_number}`); load(); setCaptainForm(p => ({ ...p, user_id: '' }));
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const removeCaptain = async (id) => {
        try { await API.delete(`/admin/table-captains/${id}`); toast.success('Removed'); load(); } catch {}
    };

    const uc = (k, v) => setConfig(p => ({ ...p, [k]: v }));
    const saveConfig = async () => {
        setSavingConfig(true);
        try {
            await API.put(`/admin/events/${eventId}`, config);
            toast.success('Configuration saved');
            load();
        } catch (err) { toast.error(err.response?.data?.detail || 'Error saving config'); }
        setSavingConfig(false);
    };

    const deleteEvent = async () => {
        if (!window.confirm('Delete this event? Users will NOT be deleted.')) return;
        try { await API.delete(`/admin/events/${eventId}`); toast.success('Event deleted'); onBack(); }
        catch { toast.error('Delete failed'); }
    };

    if (!event) return <div className="p-4 text-muted-foreground">Loading...</div>;

    const regUserIds = new Set(regs.map(r => r.user_id));
    const unregisteredUsers = users.filter(u => !regUserIds.has(u.id));

    return (
        <div className="animate-fade-in" data-testid="event-detail">
            <Button variant="ghost" onClick={onBack} className="mb-4 text-muted-foreground" data-testid="back-to-events"><ArrowLeft size={18} className="mr-2" />Back to Events</Button>
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold" style={{fontFamily:'Outfit'}}>{event.name}</h2>
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{event.date}</span><span>{event.time}</span><span>{event.venue}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant={event.registration_open ? 'default' : 'destructive'}>{event.registration_open ? 'Open' : 'Closed'}</Badge>
                    <Badge variant="outline">{event.status}</Badge>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="glass-card rounded-lg p-4 text-center"><p className="text-2xl font-bold text-primary">{event.registration_count}</p><p className="text-xs text-muted-foreground">Registered</p></div>
                <div className="glass-card rounded-lg p-4 text-center"><p className="text-2xl font-bold text-[hsl(var(--emerald))]">{event.attendance_count}</p><p className="text-xs text-muted-foreground">Attended</p></div>
                <div className="glass-card rounded-lg p-4 text-center"><p className="text-2xl font-bold text-[hsl(var(--gold))]">{event.total_tables}</p><p className="text-xs text-muted-foreground">Tables</p></div>
                <div className="glass-card rounded-lg p-4 text-center"><p className="text-2xl font-bold text-[hsl(var(--cyan))]">{event.total_rounds}</p><p className="text-xs text-muted-foreground">Rounds</p></div>
            </div>

            <Tabs defaultValue="registrations" className="w-full">
                <TabsList className="bg-muted mb-6 flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="registrations">Registrations ({regs.length})</TabsTrigger>
                    <TabsTrigger value="config" data-testid="config-tab">Configuration</TabsTrigger>
                    <TabsTrigger value="captains">Table Captains</TabsTrigger>
                    <TabsTrigger value="seating">Seating</TabsTrigger>
                    <TabsTrigger value="controls">Controls</TabsTrigger>
                    <TabsTrigger value="dayof" data-testid="dayof-tab"><UserPlus size={14} className="mr-1" />Day Of Event</TabsTrigger>
                    <TabsTrigger value="whatsapp" data-testid="whatsapp-tab"><MessageCircle size={14} className="mr-1" />WhatsApp</TabsTrigger>
                </TabsList>

                <TabsContent value="registrations">
                    <div className="flex gap-3 mb-4 flex-wrap">
                        <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={uploadCSV} />
                        <Button variant="outline" onClick={downloadSampleCSV} data-testid="download-sample-event-csv-btn"><Download size={16} className="mr-2" />Sample CSV</Button>
                        <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="upload-csv-btn"><Upload size={16} className="mr-2" />Upload CSV</Button>
                        <Button variant="outline" onClick={toggleReg} data-testid="toggle-reg-btn">{event.registration_open ? 'Close Registration' : 'Open Registration'}</Button>
                        <Button variant="outline" onClick={async () => {
                            try {
                                const r = await API.post(`/admin/events/${event.id}/assign-badges`);
                                toast.success(r.data.message);
                                const rg = await API.get(`/admin/events/${event.id}/registrations`);
                                setRegs(rg.data);
                            } catch (err) { toast.error(err.response?.data?.detail || 'Error assigning badges'); }
                        }} data-testid="assign-badges-btn"><Hash size={16} className="mr-2" />Assign Badges</Button>
                        <Button variant="outline" onClick={() => {
                            const baseUrl = window.location.origin;
                            const rows = [['Badge #', 'Name', 'Phone', 'Email', 'Business', 'Category', 'Subcategory', 'Position', 'Public URL', 'QR PNG URL']];
                            regs.forEach(r => {
                                const u = r.user || {};
                                rows.push([
                                    r.badge_number || '', u.full_name || '', u.phone || '', u.email || '',
                                    u.business_name || '', u.category_name || '', u.subcategory_name || '', u.position || '',
                                    `${baseUrl}/profile/${r.user_id}`,
                                    `${baseUrl}/api/uploads/qr/${r.user_id}.png`
                                ]);
                            });
                            const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                            a.download = `registrations_${event.name || 'event'}.csv`; a.click();
                        }} data-testid="download-regs-csv-btn"><Download size={16} className="mr-2" />Download Registrations CSV</Button>
                        <Button variant="outline" onClick={async () => {
                            try {
                                toast.info('Generating QR codes ZIP...');
                                const r = await API.get(`/admin/events/${eventId}/download-qr-codes`, { responseType: 'blob' });
                                const url = URL.createObjectURL(new Blob([r.data]));
                                const a = document.createElement('a');
                                a.href = url; a.download = `qr_codes_${event.name || 'event'}.zip`; a.click();
                                URL.revokeObjectURL(url);
                                toast.success('QR codes downloaded');
                            } catch (err) { toast.error(err.response?.data?.detail || 'Download failed'); }
                        }} data-testid="download-qr-codes-btn"><Download size={16} className="mr-2" />Download All QR Codes</Button>
                        <Button variant="outline" onClick={async () => {
                            try {
                                const r = await API.get(`/admin/events/${eventId}/badge-print-csv`, { responseType: 'blob' });
                                const url = URL.createObjectURL(new Blob([r.data]));
                                const a = document.createElement('a');
                                a.href = url; a.download = `badge_print_${event.name || 'event'}.csv`; a.click();
                                URL.revokeObjectURL(url);
                            } catch (err) { toast.error('Download failed'); }
                        }} data-testid="download-badge-print-csv-btn"><Download size={16} className="mr-2" />Badge Print CSV</Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">CSV format: full_name, phone, email, business_name, category, subcategory, position</p>
                    <div className="glass-card rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-border">
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase w-16">Badge #</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase">Name</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase hidden sm:table-cell">Phone</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase hidden md:table-cell">Business</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase hidden lg:table-cell">Category / Sub</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase">Status</th>
                            </tr></thead>
                            <tbody>{regs.map(r => (
                                <tr key={r.id} className="border-b border-border hover:bg-white/5 transition-colors">
                                    <td className="p-3 font-bold text-primary" data-testid={`badge-${r.user_id}`}>{r.badge_number || '—'}</td>
                                    <td className="p-3 font-medium">{r.user?.full_name || 'N/A'}</td>
                                    <td className="p-3 text-muted-foreground hidden sm:table-cell">{r.user?.phone}</td>
                                    <td className="p-3 text-muted-foreground hidden md:table-cell">{r.user?.business_name || <span className="text-destructive/60 text-xs">Missing</span>}</td>
                                    <td className="p-3 hidden lg:table-cell">{r.user?.category_name ? <><Badge variant="outline" className="text-xs">{r.user.category_name}</Badge>{r.user.subcategory_name && <span className="text-xs text-muted-foreground ml-1">/ {r.user.subcategory_name}</span>}</> : <span className="text-destructive/60 text-xs">Missing</span>}</td>
                                    <td className="p-3"><Badge variant={r.payment_status === 'paid' ? 'default' : 'outline'} className="text-xs">{r.payment_status}</Badge></td>
                                </tr>
                            ))}</tbody>
                        </table>
                        </div>
                        {regs.length === 0 && <p className="p-6 text-center text-muted-foreground">No registrations yet</p>}
                    </div>
                </TabsContent>

                <TabsContent value="config">
                    {config && (
                        <div className="glass-card rounded-xl p-6 space-y-5" data-testid="event-config-section">
                            <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Table & Round Configuration</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div><Label>Tables</Label><Input type="number" min={1} value={config.total_tables} onChange={e => uc('total_tables', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" data-testid="config-tables-input" /></div>
                                <div><Label>Chairs/Table</Label><Input type="number" min={1} value={config.chairs_per_table} onChange={e => uc('chairs_per_table', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" data-testid="config-chairs-input" /></div>
                                <div><Label>Rounds</Label><Input type="number" min={1} value={config.total_rounds} onChange={e => uc('total_rounds', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" data-testid="config-rounds-input" /></div>
                                <div><Label>Total Vacant Seats</Label><Input type="number" min={0} value={config.vacant_seats_per_table} onChange={e => uc('vacant_seats_per_table', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" data-testid="config-vacant-input" /></div>
                                <div><Label>Round Duration (min)</Label><Input type="number" min={1} value={config.round_duration_minutes} onChange={e => uc('round_duration_minutes', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" data-testid="config-duration-input" /></div>
                                <div><Label>Speaker Time (sec)</Label><Input type="number" min={1} value={config.speaker_time_seconds} onChange={e => uc('speaker_time_seconds', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" data-testid="config-speaker-input" /></div>
                                <div><Label>Conclusion Time (sec)</Label><Input type="number" min={1} value={config.conclusion_time_seconds} onChange={e => uc('conclusion_time_seconds', Number(e.target.value))} className="bg-muted/50 border-border h-11 mt-1" data-testid="config-conclusion-input" /></div>
                            </div>
                            <Button onClick={saveConfig} disabled={savingConfig} className="bg-primary" data-testid="save-config-btn">
                                {savingConfig ? 'Saving...' : 'Save Configuration'}
                            </Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="captains">
                    {(() => {
                        const allTablesFilled = captainForm.table_number === null;
                        const availableUsers = regs.filter(r => r.user && !captains.some(c => c.user_id === r.user_id));
                        const filteredAvailable = userSearch ? availableUsers.filter(r => r.user.full_name.toLowerCase().includes(userSearch.toLowerCase()) || (r.user.business_name || '').toLowerCase().includes(userSearch.toLowerCase())) : availableUsers;
                        const filteredCaptains = captainSearch ? captains.filter(c => (c.user?.full_name || '').toLowerCase().includes(captainSearch.toLowerCase()) || (c.user?.business_name || '').toLowerCase().includes(captainSearch.toLowerCase()) || String(c.table_number).includes(captainSearch)) : captains;
                        return (<>
                            <div className="glass-card rounded-xl p-6 mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold">Assign Table Captain</h4>
                                    <span className="text-xs text-muted-foreground">{captains.length} / {event.total_tables} tables assigned</span>
                                </div>
                                {allTablesFilled ? (
                                    <p className="text-sm text-[hsl(var(--emerald))]">All {event.total_tables} tables have captains assigned.</p>
                                ) : (
                                    <>
                                        <div className="flex gap-3 items-end flex-wrap">
                                            <div className="flex-1 min-w-[200px]">
                                                <Label className="text-xs">Search & Select User</Label>
                                                <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Type to search..." className="bg-muted/50 border-border h-10 mt-1 mb-1" data-testid="captain-user-search" />
                                                <Select value={captainForm.user_id} onValueChange={v => { setCaptainForm(p => ({ ...p, user_id: v })); setUserSearch(''); }}>
                                                    <SelectTrigger className="bg-muted/50 border-border h-10"><SelectValue placeholder={`${availableUsers.length} users available`} /></SelectTrigger>
                                                    <SelectContent>{filteredAvailable.map(r => (
                                                        <SelectItem key={r.user_id} value={r.user_id}>{r.user.full_name} — {r.user.business_name || 'N/A'}</SelectItem>
                                                    ))}
                                                    {filteredAvailable.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">No matching users</div>}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="w-24">
                                                <Label className="text-xs">Table #</Label>
                                                <Input type="number" value={captainForm.table_number || ''} readOnly className="bg-muted/50 border-border h-10 mt-1 opacity-60" />
                                            </div>
                                            <Button onClick={addCaptain} disabled={!captainForm.user_id} data-testid="assign-captain-btn"><Crown size={16} className="mr-2" />Assign</Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Table number auto-fills to the next open slot. Already assigned users are excluded.</p>
                                    </>
                                )}
                            </div>
                            <div className="mb-3 flex gap-3 items-center">
                                <Input value={captainSearch} onChange={e => setCaptainSearch(e.target.value)} placeholder="Search assigned captains by name, business, or table #..." className="bg-muted/50 border-border h-10 flex-1" data-testid="captain-list-search" />
                                {captains.length > 0 && (
                                    <Button variant="outline" onClick={() => {
                                        const rows = [['Table #', 'Name', 'Phone', 'Email', 'Business', 'Category', 'Subcategory']];
                                        captains.sort((a, b) => a.table_number - b.table_number).forEach(c => {
                                            const u = c.user || {};
                                            rows.push([c.table_number, u.full_name || '', u.phone || '', u.email || '', u.business_name || '', u.category_name || '', u.subcategory_name || '']);
                                        });
                                        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                                        const blob = new Blob([csv], { type: 'text/csv' });
                                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                                        a.download = 'table_captains.csv'; a.click();
                                    }} data-testid="download-captains-csv-btn"><Download size={16} className="mr-2" />Download CSV</Button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {filteredCaptains.sort((a, b) => a.table_number - b.table_number).map(c => (
                                    <div key={c.id} className="glass-card rounded-lg p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="table-badge">{c.table_number}</div>
                                            <div><p className="font-medium">{c.user?.full_name}</p><p className="text-xs text-muted-foreground">{c.user?.business_name}</p></div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeCaptain(c.id)}><Trash2 size={16} className="text-destructive" /></Button>
                                    </div>
                                ))}
                                {filteredCaptains.length === 0 && <p className="text-center text-muted-foreground p-6">{captainSearch ? 'No matching captains' : 'No table captains assigned'}</p>}
                            </div>
                        </>);
                    })()}
                </TabsContent>

                <TabsContent value="seating">
                    <div className="flex gap-3 mb-4">
                        <Button onClick={assignTables} disabled={assigningTables} className="bg-primary" data-testid="assign-tables-btn">
                            {assigningTables ? <><Loader2 size={16} className="mr-2 animate-spin" />Assigning...</> : <><TableProperties size={16} className="mr-2" />Assign Tables</>}
                        </Button>
                        {assignments.length > 0 && (
                            <Button variant="outline" onClick={() => downloadSeatingCSV()} data-testid="download-seating-csv-btn"><Download size={16} className="mr-2" />Download CSV</Button>
                        )}
                    </div>
                    {assigningTables && (
                        <div className="mt-1 mb-4 space-y-1" data-testid="assign-progress">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{assignProgress.message}</span>
                                <span>{assignProgress.progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${assignProgress.progress}%` }} />
                            </div>
                        </div>
                    )}
                    {assignments.length > 0 && (() => {
                        const allUserIdsInSeating = new Set();
                        const round1 = assignments.filter(a => a.round_number === 1);
                        round1.forEach(a => {
                            (a.users || []).forEach(u => allUserIdsInSeating.add(u.id));
                            if (a.captain) allUserIdsInSeating.add(a.captain.id);
                        });
                        const regCount = regs.length;
                        const seatedCount = allUserIdsInSeating.size;
                        const missedCount = regCount - seatedCount;
                        return (
                            <div className={`glass-card rounded-xl p-4 mb-4 flex items-center justify-between ${missedCount > 0 ? 'border-destructive/50' : 'border-[hsl(var(--emerald))]/30'}`} data-testid="seating-verification">
                                <div className="flex items-center gap-6 text-sm">
                                    <span>Registered: <strong>{regCount}</strong></span>
                                    <span>Seated (Round 1): <strong>{seatedCount}</strong></span>
                                    <span>Captains: <strong>{captains.length}</strong></span>
                                </div>
                                {missedCount > 0 ? (
                                    <Badge variant="destructive" className="text-xs" data-testid="missed-users-badge">{missedCount} user(s) not assigned</Badge>
                                ) : (
                                    <Badge className="bg-[hsl(var(--emerald))] text-xs" data-testid="all-assigned-badge">All users assigned</Badge>
                                )}
                            </div>
                        );
                    })()}
                    {assignments.length > 0 ? (
                        <div className="space-y-6">{[...new Set(assignments.map(a => a.round_number))].sort().map(round => (
                            <div key={round}>
                                <h4 className="text-lg font-semibold mb-3" style={{fontFamily:'Outfit'}}>Round {round}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {assignments.filter(a => a.round_number === round).sort((a,b) => a.table_number - b.table_number).map(a => (
                                        <div key={a.id} className="glass-card rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="table-badge text-sm">{a.table_number}</div>
                                                <span className="text-xs text-muted-foreground">{(a.users?.length || 0) + (a.captain ? 1 : 0)} people</span>
                                            </div>
                                            {a.captain && (
                                                <div className="mb-2 pb-2 border-b border-border">
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <Crown size={10} className="text-[hsl(var(--gold))]" />
                                                        <span className="font-semibold text-[hsl(var(--gold))]">{a.captain.full_name}</span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground ml-4">{a.captain.category_name}{a.captain.subcategory_name ? ` / ${a.captain.subcategory_name}` : ''}</p>
                                                </div>
                                            )}
                                            <div className="space-y-1.5">{(a.users || []).map(u => (
                                                <div key={u.id} className="text-xs">
                                                    <span className="text-foreground">{u.full_name}</span>
                                                    <p className="text-[10px] text-muted-foreground">{u.category_name}{u.subcategory_name ? ` / ${u.subcategory_name}` : ''}</p>
                                                </div>
                                            ))}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}</div>
                    ) : <p className="text-center text-muted-foreground p-6">No seating assignments yet. Click "Assign Tables" to generate.</p>}
                </TabsContent>

                <TabsContent value="controls">
                    <div className="glass-card rounded-xl p-6 space-y-4">
                        <h4 className="text-lg font-semibold">Round Controls</h4>
                        <div className="flex items-center gap-4 flex-wrap">
                            <p className="text-sm text-muted-foreground">Current Round: <span className="text-foreground font-bold">{event.current_round || 'Not started'}</span></p>
                            <p className="text-sm text-muted-foreground">Status: <span className="text-foreground font-bold">{event.status}</span></p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            {event.status !== 'completed' && (
                                <>
                                    <Button onClick={() => roundControl('start')} className="bg-[hsl(var(--emerald))] hover:bg-[hsl(var(--emerald))]/80" data-testid="start-round-btn"><Play size={16} className="mr-2" />Start Next Round</Button>
                                    {event.round_start_time && <Button onClick={() => roundControl('end')} variant="outline" data-testid="end-round-btn"><Square size={16} className="mr-2" />End Current Round</Button>}
                                    <Button onClick={() => roundControl('finish')} variant="destructive" data-testid="finish-event-btn">Finish Event</Button>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Live screen URL: <code className="bg-muted px-2 py-1 rounded text-primary">/live/{eventId}</code></p>
                        <div className="border-t border-border pt-4 mt-4">
                            <Button variant="destructive" onClick={deleteEvent} data-testid="delete-event-btn"><Trash2 size={16} className="mr-2" />Delete Event</Button>
                            <p className="text-xs text-muted-foreground mt-2">This will delete the event, registrations, seating, and references. Users will not be deleted.</p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="dayof">
                    <div className="space-y-6">
                        {/* Status Cards */}
                        {dayOfStatus && (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                    { label: 'Registered', val: dayOfStatus.total_registered, color: 'text-primary' },
                                    { label: 'Attended', val: dayOfStatus.total_attended, color: 'text-green-500' },
                                    { label: 'Absent', val: dayOfStatus.total_absent, color: 'text-destructive' },
                                    { label: 'Spot Registered', val: dayOfStatus.total_spot, color: 'text-yellow-500' },
                                    { label: 'Needing Seats', val: dayOfStatus.spot_needing_seats, color: 'text-orange-500' },
                                ].map(s => (
                                    <div key={s.label} className="glass-card rounded-xl p-4 text-center">
                                        <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                                        <p className="text-xs text-muted-foreground">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Spot Registration Form */}
                        <div className="glass-card rounded-xl p-5">
                            <h3 className="font-semibold mb-3">Spot Registration</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><Label className="text-xs text-muted-foreground">Full Name *</Label><Input value={spotForm.full_name} onChange={e => setSpotForm(p => ({...p, full_name: e.target.value}))} placeholder="Full Name" className="bg-muted/50 border-border h-10 mt-1" data-testid="spot-name" /></div>
                                <div><Label className="text-xs text-muted-foreground">Phone *</Label><Input value={spotForm.phone} onChange={e => setSpotForm(p => ({...p, phone: e.target.value}))} placeholder="Phone Number" className="bg-muted/50 border-border h-10 mt-1" data-testid="spot-phone" /></div>
                                <div><Label className="text-xs text-muted-foreground">Business Name *</Label><Input value={spotForm.business_name} onChange={e => setSpotForm(p => ({...p, business_name: e.target.value}))} placeholder="Company Name" className="bg-muted/50 border-border h-10 mt-1" data-testid="spot-business" /></div>
                                <div><Label className="text-xs text-muted-foreground">Position *</Label><Input value={spotForm.position} onChange={e => setSpotForm(p => ({...p, position: e.target.value}))} placeholder="CEO, Director" className="bg-muted/50 border-border h-10 mt-1" data-testid="spot-position" /></div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Category *</Label>
                                    <Select value={spotForm.category_id} onValueChange={v => setSpotForm(p => ({...p, category_id: v, subcategory_id: ''}))}>
                                        <SelectTrigger className="bg-muted/50 border-border h-10 mt-1" data-testid="spot-category"><SelectValue placeholder="Select Category" /></SelectTrigger>
                                        <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Sub Category *</Label>
                                    <Select value={spotForm.subcategory_id} onValueChange={v => setSpotForm(p => ({...p, subcategory_id: v}))}>
                                        <SelectTrigger className="bg-muted/50 border-border h-10 mt-1" data-testid="spot-subcategory"><SelectValue placeholder="Select Sub Category" /></SelectTrigger>
                                        <SelectContent>{spotSubcats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button className="mt-4 w-full sm:w-auto" disabled={spotLoading} onClick={async () => {
                                if (!spotForm.full_name || !spotForm.phone || !spotForm.business_name || !spotForm.position || !spotForm.category_id || !spotForm.subcategory_id) { toast.error('All fields are required'); return; }
                                setSpotLoading(true);
                                try {
                                    const r = await API.post(`/admin/events/${eventId}/spot-register`, spotForm);
                                    toast.success(r.data.message);
                                    setSpotForm({ full_name: '', phone: '', business_name: '', category_id: '', subcategory_id: '', position: '' });
                                    API.get(`/admin/events/${eventId}/day-of-status`).then(r2 => setDayOfStatus(r2.data));
                                    load();
                                } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                                setSpotLoading(false);
                            }} data-testid="spot-register-btn">
                                <UserPlus size={16} className="mr-2" />{spotLoading ? 'Registering...' : 'Spot Register'}
                            </Button>
                        </div>

                        {/* Close Entry + Reallocate */}
                        <div className="glass-card rounded-xl p-5">
                            <h3 className="font-semibold mb-3">Entry & Reallocation</h3>
                            <div className="flex flex-wrap gap-3 mb-4">
                                {dayOfStatus?.entry_closed ? (
                                    <Button variant="outline" onClick={async () => {
                                        try {
                                            await API.post(`/admin/events/${eventId}/reopen-entry`);
                                            toast.success('Entry reopened');
                                            API.get(`/admin/events/${eventId}/day-of-status`).then(r => setDayOfStatus(r.data));
                                        } catch { toast.error('Failed'); }
                                    }} data-testid="reopen-entry-btn">
                                        <Unlock size={16} className="mr-2" />Reopen Entry
                                    </Button>
                                ) : (
                                    <Button variant="destructive" onClick={async () => {
                                        if (!window.confirm('Close entry? Absent users will be identified based on current attendance.')) return;
                                        try {
                                            await API.post(`/admin/events/${eventId}/close-entry`);
                                            toast.success('Entry closed. You can now reallocate tables.');
                                            API.get(`/admin/events/${eventId}/day-of-status`).then(r => setDayOfStatus(r.data));
                                        } catch { toast.error('Failed'); }
                                    }} data-testid="close-entry-btn">
                                        <Lock size={16} className="mr-2" />Close Entry
                                    </Button>
                                )}
                                <Button className="bg-green-600 hover:bg-green-700" disabled={reallocating} onClick={async () => {
                                    if (!window.confirm('Reallocate tables? This will remove absent users from their seats and place spot registrations into available seats.')) return;
                                    setReallocating(true);
                                    try {
                                        const r = await API.post(`/admin/events/${eventId}/reallocate`);
                                        toast.success(r.data.message, { duration: 6000 });
                                        API.get(`/admin/events/${eventId}/day-of-status`).then(r2 => setDayOfStatus(r2.data));
                                        load();
                                    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                                    setReallocating(false);
                                }} data-testid="reallocate-btn">
                                    <Shuffle size={16} className="mr-2" />{reallocating ? 'Reallocating...' : 'Reallocate Tables'}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => API.get(`/admin/events/${eventId}/day-of-status`).then(r => setDayOfStatus(r.data))} data-testid="refresh-dayof-btn">
                                    <RefreshCw size={14} className="mr-1" />Refresh
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {dayOfStatus?.entry_closed ? '🔒 Entry is closed.' : '🔓 Entry is open — volunteers are scanning attendees.'}
                                {' '}Reallocate will remove absent users from tables and place spot registrations into freed + vacant seats without disturbing present users.
                            </p>
                        </div>

                        {/* Absent Users List */}
                        {dayOfStatus?.absent_users?.length > 0 && (
                            <div className="glass-card rounded-xl p-5">
                                <h3 className="font-semibold mb-3 text-destructive">Absent Users ({dayOfStatus.absent_users.length})</h3>
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                    {dayOfStatus.absent_users.map(u => (
                                        <div key={u.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded bg-muted/30" data-testid={`absent-${u.id}`}>
                                            <div className="flex items-center gap-2">
                                                <XCircle size={12} className="text-destructive" />
                                                <span className="font-medium">{u.full_name}</span>
                                                <span className="text-muted-foreground">{u.phone}</span>
                                            </div>
                                            <span className="text-muted-foreground">{u.business_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Spot Registrations List */}
                        {dayOfStatus?.spot_users?.length > 0 && (
                            <div className="glass-card rounded-xl p-5">
                                <h3 className="font-semibold mb-3 text-yellow-500">Spot Registrations ({dayOfStatus.spot_users.length})</h3>
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                    {dayOfStatus.spot_users.map(u => (
                                        <div key={u.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded bg-muted/30" data-testid={`spot-${u.id}`}>
                                            <div className="flex items-center gap-2">
                                                <UserPlus size={12} className="text-yellow-500" />
                                                <span className="font-medium">{u.full_name}</span>
                                                <span className="text-muted-foreground">{u.phone}</span>
                                                <span className="text-muted-foreground">{u.business_name}</span>
                                                <Badge className="bg-green-600 text-white text-[10px] px-1.5">Paid</Badge>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                                    setEditSpot(u);
                                                    setEditSpotForm({ full_name: u.full_name, phone: u.phone, business_name: u.business_name || '', category_id: '', subcategory_id: '', position: '' });
                                                }} data-testid={`edit-spot-${u.id}`}><Pencil size={12} className="text-primary" /></Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                                                    if (!window.confirm(`Remove spot registration for ${u.full_name}? This will also remove them from any assigned tables.`)) return;
                                                    try {
                                                        await API.delete(`/admin/events/${eventId}/spot-register/${u.id}`);
                                                        toast.success(`${u.full_name} removed`);
                                                        API.get(`/admin/events/${eventId}/day-of-status`).then(r => setDayOfStatus(r.data));
                                                        load();
                                                    } catch { toast.error('Remove failed'); }
                                                }} data-testid={`delete-spot-${u.id}`}><Trash2 size={12} className="text-destructive" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Edit Spot Registration Dialog */}
                        <Dialog open={!!editSpot} onOpenChange={(open) => { if (!open) setEditSpot(null); }}>
                            <DialogContent className="bg-background border-border max-w-lg">
                                <DialogHeader><DialogTitle>Edit Spot Registration</DialogTitle></DialogHeader>
                                {editSpot && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><Label className="text-xs">Full Name</Label><Input value={editSpotForm.full_name} onChange={e => setEditSpotForm(p => ({...p, full_name: e.target.value}))} className="bg-muted/50 border-border h-10 mt-1" data-testid="edit-spot-name" /></div>
                                            <div><Label className="text-xs">Phone</Label><Input value={editSpotForm.phone} onChange={e => setEditSpotForm(p => ({...p, phone: e.target.value}))} className="bg-muted/50 border-border h-10 mt-1" data-testid="edit-spot-phone" /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><Label className="text-xs">Business Name</Label><Input value={editSpotForm.business_name} onChange={e => setEditSpotForm(p => ({...p, business_name: e.target.value}))} className="bg-muted/50 border-border h-10 mt-1" /></div>
                                            <div><Label className="text-xs">Position</Label><Input value={editSpotForm.position} onChange={e => setEditSpotForm(p => ({...p, position: e.target.value}))} className="bg-muted/50 border-border h-10 mt-1" /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-xs">Category</Label>
                                                <Select value={editSpotForm.category_id} onValueChange={v => setEditSpotForm(p => ({...p, category_id: v, subcategory_id: ''}))}>
                                                    <SelectTrigger className="bg-muted/50 border-border h-10 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Sub Category</Label>
                                                <Select value={editSpotForm.subcategory_id} onValueChange={v => setEditSpotForm(p => ({...p, subcategory_id: v}))}>
                                                    <SelectTrigger className="bg-muted/50 border-border h-10 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                                    <SelectContent>{editSpotSubcats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Button className="w-full" disabled={savingSpot} onClick={async () => {
                                            setSavingSpot(true);
                                            try {
                                                await API.put(`/admin/events/${eventId}/spot-register/${editSpot.id}`, editSpotForm);
                                                toast.success('Spot registration updated');
                                                setEditSpot(null);
                                                API.get(`/admin/events/${eventId}/day-of-status`).then(r => setDayOfStatus(r.data));
                                            } catch (err) { toast.error(err.response?.data?.detail || 'Update failed'); }
                                            setSavingSpot(false);
                                        }} data-testid="save-edit-spot-btn">{savingSpot ? 'Saving...' : 'Save Changes'}</Button>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                    </div>
                </TabsContent>

                <TabsContent value="whatsapp">
                    <div className="space-y-6">
                        {/* Send Welcome */}
                        <div className="glass-card rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold">Welcome Messages</h3>
                                    <p className="text-xs text-muted-foreground">Send welcome message to registered users</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={async () => {
                                        setWaSendingWelcome(true);
                                        setWelcomeJob(null);
                                        try {
                                            const settings = await API.get('/admin/settings');
                                            const tmpl = settings.data.wa_template_welcome;
                                            const camp = settings.data.wa_campaign_welcome;
                                            if (!tmpl) { toast.error('Set welcome template in Settings first'); setWaSendingWelcome(false); return; }
                                            if (!camp) { toast.error('Set welcome campaign name in Settings first'); setWaSendingWelcome(false); return; }
                                            const r = await API.post(`/admin/whatsapp/send-welcome/${eventId}?template_name=${tmpl}&campaign_name=${camp}`);
                                            toast.success(`Broadcasting to ${r.data.total} users (${r.data.already_sent} already sent)`);
                                            setWelcomeJob({ status: 'running', total: r.data.total, sent: 0, failed: 0, processed: 0, skipped: r.data.already_sent || 0 });
                                            startPolling(r.data.job_id, 'welcome');
                                        } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); setWaSendingWelcome(false); }
                                    }} disabled={waSendingWelcome} className="bg-green-600 hover:bg-green-700" data-testid="send-welcome-btn">
                                        {waSendingWelcome ? <Loader2 size={16} className="mr-2 animate-spin" /> : <MessageCircle size={16} className="mr-2" />}
                                        {waSendingWelcome ? 'Sending...' : 'Send New'}
                                    </Button>
                                    <Button variant="outline" onClick={async () => {
                                        if (!window.confirm('This will resend welcome messages to ALL users, including those who already received it. Continue?')) return;
                                        setWaSendingWelcome(true);
                                        setWelcomeJob(null);
                                        try {
                                            const settings = await API.get('/admin/settings');
                                            const tmpl = settings.data.wa_template_welcome;
                                            const camp = settings.data.wa_campaign_welcome;
                                            if (!tmpl) { toast.error('Set welcome template in Settings first'); setWaSendingWelcome(false); return; }
                                            if (!camp) { toast.error('Set welcome campaign name in Settings first'); setWaSendingWelcome(false); return; }
                                            const r = await API.post(`/admin/whatsapp/send-welcome/${eventId}?template_name=${tmpl}&campaign_name=${camp}&force=true`);
                                            toast.success(`Resending to ALL ${r.data.total} users`);
                                            setWelcomeJob({ status: 'running', total: r.data.total, sent: 0, failed: 0, processed: 0, skipped: 0 });
                                            startPolling(r.data.job_id, 'welcome');
                                        } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); setWaSendingWelcome(false); }
                                    }} disabled={waSendingWelcome} data-testid="resend-welcome-btn">
                                        <RefreshCw size={16} className="mr-2" />Resend All
                                    </Button>
                                </div>
                            </div>
                            {/* Welcome Progress Bar */}
                            {welcomeJob && welcomeJob.status === 'running' && (
                                <div className="mt-3 space-y-2" data-testid="welcome-progress">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Processing: {welcomeJob.processed} / {welcomeJob.total}</span>
                                        <span>{welcomeJob.total > 0 ? Math.round((welcomeJob.processed / welcomeJob.total) * 100) : 0}%</span>
                                    </div>
                                    <Progress value={welcomeJob.total > 0 ? (welcomeJob.processed / welcomeJob.total) * 100 : 0} className="h-2.5" />
                                    <div className="flex gap-4 text-xs">
                                        <span className="text-green-500">Sent: {welcomeJob.sent}</span>
                                        <span className="text-yellow-500">Skipped: {welcomeJob.skipped || 0}</span>
                                        <span className="text-destructive">Failed: {welcomeJob.failed}</span>
                                    </div>
                                </div>
                            )}
                            {welcomeJob && welcomeJob.status === 'completed' && (
                                <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20" data-testid="welcome-completed">
                                    <div className="flex items-center gap-2 text-sm text-green-500 font-medium mb-1">
                                        <CheckCircle size={14} /> Broadcast Complete
                                    </div>
                                    <div className="flex gap-4 text-xs text-muted-foreground">
                                        <span>Total: {welcomeJob.total}</span>
                                        <span className="text-green-500">Sent: {welcomeJob.sent}</span>
                                        <span className="text-yellow-500">Skipped: {welcomeJob.skipped || 0}</span>
                                        <span className="text-destructive">Failed: {welcomeJob.failed}</span>
                                    </div>
                                </div>
                            )}
                            {/* Welcome Delivery List */}
                            {waStatus?.welcome && waStatus.welcome.total > 0 && (
                                <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Delivery Log ({waStatus.welcome.total})</h4>
                                        <div className="flex gap-3 text-xs">
                                            <span className="text-green-500">Sent: {waStatus.welcome.sent}</span>
                                            <span className="text-destructive">Failed: {waStatus.welcome.failed}</span>
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                        {waStatus.welcome.messages.map((m, i) => (
                                            <div key={m.id || i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded bg-muted/30" data-testid={`wa-welcome-msg-${i}`}>
                                                <div className="flex items-center gap-2">
                                                    {m.status === 'sent' ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-destructive" />}
                                                    <span className="font-medium">{m.user_name}</span>
                                                    <span className="text-muted-foreground">{m.user_phone}</span>
                                                </div>
                                                <Badge variant={m.status === 'sent' ? 'default' : 'destructive'} className="text-[10px] px-1.5">{m.status}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Send Table Assignments */}
                        <div className="glass-card rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold">Table Assignment Messages</h3>
                                    <p className="text-xs text-muted-foreground">Send table assignments with QR codes to all assigned users</p>
                                </div>
                                <Button onClick={async () => {
                                    setWaSendingAssign(true);
                                    setAssignJob(null);
                                    try {
                                        const settings = await API.get('/admin/settings');
                                        const tmpl = settings.data.wa_template_assignment;
                                        const camp = settings.data.wa_campaign_assignment;
                                        if (!tmpl) { toast.error('Set assignment template in Settings first'); setWaSendingAssign(false); return; }
                                        if (!camp) { toast.error('Set assignment campaign name in Settings first'); setWaSendingAssign(false); return; }
                                        const r = await API.post(`/admin/whatsapp/send-assignments/${eventId}?template_name=${tmpl}&campaign_name=${camp}`);
                                        toast.success(`Broadcasting assignments to ${r.data.total} users`);
                                        setAssignJob({ status: 'running', total: r.data.total, sent: 0, failed: 0, processed: 0 });
                                        startPolling(r.data.job_id, 'assignment');
                                    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); setWaSendingAssign(false); }
                                }} disabled={waSendingAssign || assignments.length === 0} className="bg-green-600 hover:bg-green-700" data-testid="send-assignments-btn">
                                    {waSendingAssign ? <Loader2 size={16} className="mr-2 animate-spin" /> : <MessageCircle size={16} className="mr-2" />}
                                    {waSendingAssign ? 'Sending...' : 'Send Assignments'}
                                </Button>
                            </div>
                            {assignments.length === 0 && <p className="text-xs text-destructive">Assign tables first before sending assignment messages.</p>}
                            {/* Assignment Progress Bar */}
                            {assignJob && assignJob.status === 'running' && (
                                <div className="mt-3 space-y-2" data-testid="assign-progress">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Processing: {assignJob.processed} / {assignJob.total}</span>
                                        <span>{assignJob.total > 0 ? Math.round((assignJob.processed / assignJob.total) * 100) : 0}%</span>
                                    </div>
                                    <Progress value={assignJob.total > 0 ? (assignJob.processed / assignJob.total) * 100 : 0} className="h-2.5" />
                                    <div className="flex gap-4 text-xs">
                                        <span className="text-green-500">Sent: {assignJob.sent}</span>
                                        <span className="text-destructive">Failed: {assignJob.failed}</span>
                                    </div>
                                </div>
                            )}
                            {assignJob && assignJob.status === 'completed' && (
                                <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20" data-testid="assign-completed">
                                    <div className="flex items-center gap-2 text-sm text-green-500 font-medium mb-1">
                                        <CheckCircle size={14} /> Broadcast Complete
                                    </div>
                                    <div className="flex gap-4 text-xs text-muted-foreground">
                                        <span>Total: {assignJob.total}</span>
                                        <span className="text-green-500">Sent: {assignJob.sent}</span>
                                        <span className="text-destructive">Failed: {assignJob.failed}</span>
                                    </div>
                                </div>
                            )}
                            {/* Assignment Delivery List */}
                            {waStatus?.assignment && waStatus.assignment.total > 0 && (
                                <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Delivery Log ({waStatus.assignment.total})</h4>
                                        <div className="flex gap-3 text-xs">
                                            <span className="text-green-500">Sent: {waStatus.assignment.sent}</span>
                                            <span className="text-destructive">Failed: {waStatus.assignment.failed}</span>
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                        {waStatus.assignment.messages.map((m, i) => (
                                            <div key={m.id || i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded bg-muted/30" data-testid={`wa-assign-msg-${i}`}>
                                                <div className="flex items-center gap-2">
                                                    {m.status === 'sent' ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-destructive" />}
                                                    <span className="font-medium">{m.user_name}</span>
                                                    <span className="text-muted-foreground">{m.user_phone}</span>
                                                </div>
                                                <Badge variant={m.status === 'sent' ? 'default' : 'destructive'} className="text-[10px] px-1.5">{m.status}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Retry & Refresh Controls */}
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={async () => {
                                try {
                                    const settings = await API.get('/admin/settings');
                                    const tmpl = settings.data.wa_template_welcome || 'welcome';
                                    const camp = settings.data.wa_campaign_welcome || 'ssnc';
                                    const r = await API.post(`/admin/whatsapp/retry-failed/${eventId}?message_type=welcome&template_name=${tmpl}&campaign_name=${camp}`);
                                    toast.success(`Retry started: ${r.data.total} failed messages`);
                                    if (r.data.job_id) {
                                        setWaSendingWelcome(true);
                                        setWelcomeJob({ status: 'running', total: r.data.total, sent: 0, failed: 0, processed: 0, skipped: 0 });
                                        startPolling(r.data.job_id, 'welcome');
                                    }
                                } catch (err) { toast.error('Retry failed'); }
                            }} data-testid="retry-failed-btn">
                                <RefreshCw size={14} className="mr-1" />Retry Failed
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => API.get(`/admin/whatsapp/status/${eventId}`).then(r => setWaStatus(r.data))} data-testid="refresh-status-btn">
                                <RefreshCw size={14} className="mr-1" />Refresh
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function EventManagement() {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);

    const load = () => { API.get('/admin/events').then(r => setEvents(r.data)).catch(() => {}); };
    useEffect(() => { load(); }, []);

    const deleteEvent = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this event? Users will NOT be deleted.')) return;
        try { await API.delete(`/admin/events/${id}`); toast.success('Event deleted'); load(); }
        catch { toast.error('Delete failed'); }
    };

    if (selectedEventId) return <EventDetail eventId={selectedEventId} onBack={() => { setSelectedEventId(null); load(); }} />;

    return (
        <div data-testid="event-management">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Events</h2>
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary" data-testid="new-event-btn"><Plus size={16} className="mr-2" />New Event</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-background border-border max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
                        <EventForm onCreated={() => { setShowCreate(false); load(); }} />
                    </DialogContent>
                </Dialog>
            </div>
            <div className="space-y-3">
                {events.map(e => (
                    <div key={e.id} onClick={() => setSelectedEventId(e.id)} className="glass-card rounded-xl p-5 cursor-pointer group hover:border-primary/30 transition-colors" data-testid={`event-card-${e.id}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{e.name}</h3>
                                <div className="flex gap-4 mt-1 text-sm text-muted-foreground"><span>{e.date}</span><span>{e.venue}</span></div>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Badge variant="outline">{e.registration_count} registered</Badge>
                                <Badge variant={e.status === 'live' ? 'default' : 'outline'}>{e.status}</Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(ev) => deleteEvent(ev, e.id)} data-testid={`delete-event-${e.id}`}>
                                    <Trash2 size={16} className="text-destructive" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
                {events.length === 0 && <div className="text-center text-muted-foreground p-12 glass-card rounded-xl">No events yet. Create your first event!</div>}
            </div>
        </div>
    );
}
