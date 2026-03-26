import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, UserCheck, Phone, Mail } from 'lucide-react';

export default function VolunteerManagement() {
    const [volunteers, setVolunteers] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });

    const load = () => { API.get('/admin/volunteers').then(r => setVolunteers(r.data)).catch(() => {}); };
    useEffect(() => { load(); }, []);

    const addVolunteer = async () => {
        if (!form.name || !form.phone || !form.password) { toast.error('Name, phone and password required'); return; }
        try {
            await API.post('/admin/volunteers', form);
            toast.success('Volunteer added'); setShowAdd(false); setForm({ name: '', phone: '', email: '', password: '' }); load();
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const deleteVolunteer = async (id) => {
        try { await API.delete(`/admin/volunteers/${id}`); toast.success('Deleted'); load(); } catch {}
    };

    return (
        <div data-testid="volunteer-management">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Volunteers</h2>
                <Dialog open={showAdd} onOpenChange={setShowAdd}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary" data-testid="add-volunteer-btn"><Plus size={16} className="mr-2" />Add Volunteer</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#121212] border-border">
                        <DialogHeader><DialogTitle>Add Volunteer</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" className="bg-muted/50 border-border h-11 mt-1" data-testid="volunteer-name-input" /></div>
                            <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="9876543210" className="bg-muted/50 border-border h-11 mt-1" data-testid="volunteer-phone-input" /></div>
                            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="bg-muted/50 border-border h-11 mt-1" /></div>
                            <div><Label>Password *</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Set password" className="bg-muted/50 border-border h-11 mt-1" data-testid="volunteer-password-input" /></div>
                            <Button onClick={addVolunteer} className="w-full" data-testid="save-volunteer-btn">Save Volunteer</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-3">
                {volunteers.map(v => (
                    <div key={v.id} className="glass-card rounded-xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[hsl(var(--emerald))]/20 flex items-center justify-center">
                                <UserCheck size={18} className="text-[hsl(var(--emerald))]" />
                            </div>
                            <div>
                                <p className="font-medium text-white">{v.name}</p>
                                <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                                    <span className="flex items-center gap-1"><Phone size={10} />{v.phone}</span>
                                    {v.email && <span className="flex items-center gap-1"><Mail size={10} />{v.email}</span>}
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteVolunteer(v.id)} data-testid={`delete-volunteer-${v.id}`}>
                            <Trash2 size={16} className="text-destructive" />
                        </Button>
                    </div>
                ))}
                {volunteers.length === 0 && <div className="text-center text-muted-foreground p-12 glass-card rounded-xl">No volunteers yet. Add your first volunteer!</div>}
            </div>
        </div>
    );
}
