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
import { Plus, Upload, Play, Square, Users, TableProperties, Crown, Trash2, ArrowLeft, Download } from 'lucide-react';

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
                <div><Label>Event Name *</Label><Input value={form.name} onChange={e => u('name', e.target.value)} placeholder="SBC Speed Networking 2026" className="bg-black/30 border-white/10 h-11 mt-1" data-testid="event-name-input" /></div>
                <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => u('date', e.target.value)} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="event-date-input" /></div>
                <div><Label>Time</Label><Input value={form.time} onChange={e => u('time', e.target.value)} placeholder="9:00 AM" className="bg-black/30 border-white/10 h-11 mt-1" data-testid="event-time-input" /></div>
                <div><Label>Venue</Label><Input value={form.venue} onChange={e => u('venue', e.target.value)} placeholder="SIECC Sarthana Surat" className="bg-black/30 border-white/10 h-11 mt-1" data-testid="event-venue-input" /></div>
                <div><Label>Reg. Fee (INR)</Label><Input type="number" value={form.registration_fee} onChange={e => u('registration_fee', Number(e.target.value))} className="bg-black/30 border-white/10 h-11 mt-1" /></div>
                <div><Label>Payment Type</Label>
                    <Select value={form.payment_type} onValueChange={v => u('payment_type', v)}>
                        <SelectTrigger className="bg-black/30 border-white/10 h-11 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="payment_link">Payment Link</SelectItem>
                            <SelectItem value="razorpay">Razorpay</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {form.payment_type === 'payment_link' && <div className="sm:col-span-2"><Label>Payment Link</Label><Input value={form.payment_link} onChange={e => u('payment_link', e.target.value)} className="bg-black/30 border-white/10 h-11 mt-1" /></div>}
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

    const load = async () => {
        try {
            const [ev, rg, as, cp, us] = await Promise.all([
                API.get(`/admin/events/${eventId}`), API.get(`/admin/events/${eventId}/registrations`),
                API.get(`/admin/events/${eventId}/assignments`), API.get(`/admin/table-captains/${eventId}`),
                API.get('/admin/users')
            ]);
            setEvent(ev.data); setRegs(rg.data); setAssignments(as.data); setCaptains(cp.data); setUsers(us.data);
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
                speaker_time_seconds: ev.data.speaker_time_seconds || 60
            });
        } catch {}
    };
    useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const assignTables = async () => {
        try { const r = await API.post(`/admin/events/${eventId}/assign-tables`);
            toast.success(`Tables assigned! ${r.data.total_users} users across ${r.data.rounds} rounds`); load();
        } catch (err) { toast.error(err.response?.data?.detail || 'Assignment failed'); }
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
                <TabsList className="bg-[#171717] mb-6 flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="registrations">Registrations ({regs.length})</TabsTrigger>
                    <TabsTrigger value="config" data-testid="config-tab">Configuration</TabsTrigger>
                    <TabsTrigger value="captains">Table Captains</TabsTrigger>
                    <TabsTrigger value="seating">Seating</TabsTrigger>
                    <TabsTrigger value="controls">Controls</TabsTrigger>
                </TabsList>

                <TabsContent value="registrations">
                    <div className="flex gap-3 mb-4 flex-wrap">
                        <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={uploadCSV} />
                        <Button variant="outline" onClick={downloadSampleCSV} data-testid="download-sample-event-csv-btn"><Download size={16} className="mr-2" />Sample CSV</Button>
                        <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="upload-csv-btn"><Upload size={16} className="mr-2" />Upload CSV</Button>
                        <Button variant="outline" onClick={toggleReg} data-testid="toggle-reg-btn">{event.registration_open ? 'Close Registration' : 'Open Registration'}</Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">CSV format: full_name, phone, email, business_name, category, subcategory, position</p>
                    <div className="glass-card rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/5">
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase">Name</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase hidden sm:table-cell">Phone</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase hidden md:table-cell">Business</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase hidden lg:table-cell">Category / Sub</th>
                                <th className="text-left p-3 text-xs text-muted-foreground uppercase">Status</th>
                            </tr></thead>
                            <tbody>{regs.map(r => (
                                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
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
                                <div><Label>Tables</Label><Input type="number" min={1} value={config.total_tables} onChange={e => uc('total_tables', Number(e.target.value))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="config-tables-input" /></div>
                                <div><Label>Chairs/Table</Label><Input type="number" min={1} value={config.chairs_per_table} onChange={e => uc('chairs_per_table', Number(e.target.value))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="config-chairs-input" /></div>
                                <div><Label>Rounds</Label><Input type="number" min={1} value={config.total_rounds} onChange={e => uc('total_rounds', Number(e.target.value))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="config-rounds-input" /></div>
                                <div><Label>Total Vacant Seats</Label><Input type="number" min={0} value={config.vacant_seats_per_table} onChange={e => uc('vacant_seats_per_table', Number(e.target.value))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="config-vacant-input" /></div>
                                <div><Label>Round Duration (min)</Label><Input type="number" min={1} value={config.round_duration_minutes} onChange={e => uc('round_duration_minutes', Number(e.target.value))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="config-duration-input" /></div>
                                <div><Label>Speaker Time (sec)</Label><Input type="number" min={1} value={config.speaker_time_seconds} onChange={e => uc('speaker_time_seconds', Number(e.target.value))} className="bg-black/30 border-white/10 h-11 mt-1" data-testid="config-speaker-input" /></div>
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
                                                <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Type to search..." className="bg-black/30 border-white/10 h-10 mt-1 mb-1" data-testid="captain-user-search" />
                                                <Select value={captainForm.user_id} onValueChange={v => { setCaptainForm(p => ({ ...p, user_id: v })); setUserSearch(''); }}>
                                                    <SelectTrigger className="bg-black/30 border-white/10 h-10"><SelectValue placeholder={`${availableUsers.length} users available`} /></SelectTrigger>
                                                    <SelectContent>{filteredAvailable.map(r => (
                                                        <SelectItem key={r.user_id} value={r.user_id}>{r.user.full_name} — {r.user.business_name || 'N/A'}</SelectItem>
                                                    ))}
                                                    {filteredAvailable.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">No matching users</div>}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="w-24">
                                                <Label className="text-xs">Table #</Label>
                                                <Input type="number" value={captainForm.table_number || ''} readOnly className="bg-black/30 border-white/10 h-10 mt-1 opacity-60" />
                                            </div>
                                            <Button onClick={addCaptain} disabled={!captainForm.user_id} data-testid="assign-captain-btn"><Crown size={16} className="mr-2" />Assign</Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Table number auto-fills to the next open slot. Already assigned users are excluded.</p>
                                    </>
                                )}
                            </div>
                            <div className="mb-3">
                                <Input value={captainSearch} onChange={e => setCaptainSearch(e.target.value)} placeholder="Search assigned captains by name, business, or table #..." className="bg-black/30 border-white/10 h-10" data-testid="captain-list-search" />
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
                    <div className="flex gap-3 mb-6">
                        <Button onClick={assignTables} className="bg-primary" data-testid="assign-tables-btn"><TableProperties size={16} className="mr-2" />Assign Tables</Button>
                    </div>
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
                                                <div className="mb-2 pb-2 border-b border-white/5">
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <Crown size={10} className="text-[hsl(var(--gold))]" />
                                                        <span className="font-semibold text-[hsl(var(--gold))]">{a.captain.full_name}</span>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground ml-4">{a.captain.category_name}{a.captain.subcategory_name ? ` / ${a.captain.subcategory_name}` : ''}</p>
                                                </div>
                                            )}
                                            <div className="space-y-1.5">{(a.users || []).map(u => (
                                                <div key={u.id} className="text-xs">
                                                    <span className="text-white">{u.full_name}</span>
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
                            <p className="text-sm text-muted-foreground">Current Round: <span className="text-white font-bold">{event.current_round || 'Not started'}</span></p>
                            <p className="text-sm text-muted-foreground">Status: <span className="text-white font-bold">{event.status}</span></p>
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
                        <p className="text-xs text-muted-foreground">Live screen URL: <code className="bg-[#171717] px-2 py-1 rounded text-primary">/live/{eventId}</code></p>
                        <div className="border-t border-white/5 pt-4 mt-4">
                            <Button variant="destructive" onClick={deleteEvent} data-testid="delete-event-btn"><Trash2 size={16} className="mr-2" />Delete Event</Button>
                            <p className="text-xs text-muted-foreground mt-2">This will delete the event, registrations, seating, and references. Users will not be deleted.</p>
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
                    <DialogContent className="bg-[#121212] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
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
