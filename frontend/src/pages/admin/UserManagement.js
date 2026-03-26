import { useState, useEffect, useRef } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Users, Plus, Upload, Trash2, FileSpreadsheet, Download } from 'lucide-react';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [events, setEvents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [showAddUser, setShowAddUser] = useState(false);
    const [showUploadCSV, setShowUploadCSV] = useState(false);
    const [csvEventId, setCsvEventId] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);
    const [form, setForm] = useState({
        full_name: '', phone: '', email: '', business_name: '',
        category_id: '', subcategory_id: '', position: '', event_id: ''
    });

    const load = () => { API.get('/admin/users').then(r => setUsers(r.data)).catch(() => {}); };
    useEffect(() => {
        load();
        API.get('/admin/events').then(r => setEvents(r.data)).catch(() => {});
        API.get('/admin/categories').then(r => setCategories(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (form.category_id) {
            API.get(`/admin/subcategories?category_id=${form.category_id}`).then(r => setSubcategories(r.data)).catch(() => {});
        } else { setSubcategories([]); }
    }, [form.category_id]);

    const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const addUser = async () => {
        if (!form.full_name || !form.phone) { toast.error('Name and phone required'); return; }
        try {
            const r = await API.post('/admin/users', form);
            toast.success(`User created${r.data.registered_for_event ? ' and registered for event' : ''}`);
            setShowAddUser(false);
            setForm({ full_name: '', phone: '', email: '', business_name: '', category_id: '', subcategory_id: '', position: '', event_id: '' });
            load();
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const deleteUser = async (id) => {
        try { await API.delete(`/admin/users/${id}`); toast.success('Deleted'); load(); } catch {}
    };

    const handleCSVUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        const url = csvEventId ? `/admin/users/upload-csv?event_id=${csvEventId}` : '/admin/users/upload-csv';
        try {
            const r = await API.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(`Created: ${r.data.created}, Skipped: ${r.data.skipped}${r.data.registered ? `, Registered: ${r.data.registered}` : ''}`, { duration: 5000 });
            setShowUploadCSV(false);
            load();
        } catch (err) { toast.error(err.response?.data?.detail || 'CSV upload failed'); }
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const downloadSampleCSV = () => {
        const csv = `full_name,phone,email,business_name,category,subcategory,position\nJohn Doe,9876543210,john@example.com,ABC Corp,IT Services,Web Development,Director\nJane Smith,9876543211,jane@example.com,XYZ Ltd,Real Estate,Commercial,Manager`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'sample_users.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const filtered = users.filter(u =>
        (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.phone || '').includes(search) ||
        (u.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.category_name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div data-testid="user-management">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Users</h2>
                <div className="flex gap-2">
                    <Dialog open={showUploadCSV} onOpenChange={setShowUploadCSV}>
                        <DialogTrigger asChild>
                            <Button variant="outline" data-testid="upload-users-csv-btn"><Upload size={16} className="mr-2" />Upload CSV</Button>
                        </DialogTrigger>
                        <DialogContent className="bg-background border-border">
                            <DialogHeader><DialogTitle>Upload Users CSV</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <div className="text-xs text-muted-foreground bg-card rounded-lg p-3">
                                    <p className="text-foreground font-medium mb-1">CSV Columns:</p>
                                    <code>full_name, phone, email, business_name, category, subcategory, position</code>
                                    <p className="mt-2">Password defaults to phone number. Category/subcategory matched by name.</p>
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground">Register for Event (optional)</Label>
                                    <Select value={csvEventId} onValueChange={setCsvEventId}>
                                        <SelectTrigger className="bg-muted/50 border-border h-11 mt-1" data-testid="csv-event-select">
                                            <SelectValue placeholder="No event (just add users)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No event</SelectItem>
                                            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" onClick={downloadSampleCSV} className="w-full" data-testid="download-sample-users-csv-btn">
                                    <Download size={16} className="mr-2" />Download Sample CSV
                                </Button>
                                <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={handleCSVUpload} />
                                <Button onClick={() => fileRef.current?.click()} className="w-full" disabled={uploading} data-testid="upload-csv-file-btn">
                                    <FileSpreadsheet size={16} className="mr-2" />{uploading ? 'Uploading...' : 'Choose CSV File'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary" data-testid="add-user-btn"><Plus size={16} className="mr-2" />Add User</Button>
                        </DialogTrigger>
                        <DialogContent className="bg-background border-border max-w-lg max-h-[85vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => u('full_name', e.target.value)} placeholder="John Doe" className="bg-muted/50 border-border h-10 mt-1" data-testid="add-user-name" /></div>
                                    <div><Label>Phone *</Label><Input value={form.phone} onChange={e => u('phone', e.target.value)} placeholder="9876543210" className="bg-muted/50 border-border h-10 mt-1" data-testid="add-user-phone" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Email</Label><Input value={form.email} onChange={e => u('email', e.target.value)} placeholder="email@example.com" className="bg-muted/50 border-border h-10 mt-1" /></div>
                                    <div><Label>Position</Label><Input value={form.position} onChange={e => u('position', e.target.value)} placeholder="CEO, Director" className="bg-muted/50 border-border h-10 mt-1" /></div>
                                </div>
                                <div><Label>Business Name</Label><Input value={form.business_name} onChange={e => u('business_name', e.target.value)} placeholder="Company Name" className="bg-muted/50 border-border h-10 mt-1" data-testid="add-user-business" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Category</Label>
                                        <Select value={form.category_id} onValueChange={v => { u('category_id', v); u('subcategory_id', ''); }}>
                                            <SelectTrigger className="bg-muted/50 border-border h-10 mt-1" data-testid="add-user-category"><SelectValue placeholder="Select" /></SelectTrigger>
                                            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Sub Category</Label>
                                        <Select value={form.subcategory_id} onValueChange={v => u('subcategory_id', v)}>
                                            <SelectTrigger className="bg-muted/50 border-border h-10 mt-1" data-testid="add-user-subcategory"><SelectValue placeholder="Select" /></SelectTrigger>
                                            <SelectContent>{subcategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <Label>Register for Event (optional)</Label>
                                    <Select value={form.event_id} onValueChange={v => u('event_id', v)}>
                                        <SelectTrigger className="bg-muted/50 border-border h-10 mt-1" data-testid="add-user-event"><SelectValue placeholder="No event" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No event</SelectItem>
                                            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted-foreground">Password defaults to phone number</p>
                                <Button onClick={addUser} className="w-full" data-testid="save-user-btn">Save User</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, business, category..." className="bg-muted/50 border-border h-11 pl-10" data-testid="user-search-input" />
                </div>
                <Badge variant="outline" className="whitespace-nowrap">{users.length} total</Badge>
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-border">
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold">Name</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden sm:table-cell">Phone</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden md:table-cell">Business</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden lg:table-cell">Category / Sub</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden lg:table-cell">Position</th>
                            <th className="text-right p-3 text-xs text-muted-foreground uppercase font-bold w-10"></th>
                        </tr></thead>
                        <tbody>{filtered.map(u => (
                            <tr key={u.id} className="border-b border-border hover:bg-white/5 transition-colors">
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                            {(u.full_name || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">{u.full_name}</p>
                                            <p className="text-xs text-muted-foreground sm:hidden">{u.phone}</p>
                                            <p className="text-xs text-muted-foreground md:hidden">{u.business_name}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3 text-muted-foreground hidden sm:table-cell">{u.phone}</td>
                                <td className="p-3 text-muted-foreground hidden md:table-cell">{u.business_name || <span className="text-destructive/60 text-xs">Missing</span>}</td>
                                <td className="p-3 hidden lg:table-cell">
                                    {u.category_name ? (
                                        <div>
                                            <Badge variant="outline" className="text-xs">{u.category_name}</Badge>
                                            {u.subcategory_name && <span className="text-xs text-muted-foreground ml-1">/ {u.subcategory_name}</span>}
                                        </div>
                                    ) : <span className="text-destructive/60 text-xs">Missing</span>}
                                </td>
                                <td className="p-3 text-muted-foreground hidden lg:table-cell">{u.position}</td>
                                <td className="p-3 text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteUser(u.id)}>
                                        <Trash2 size={14} className="text-destructive" />
                                    </Button>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
                {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground"><Users size={32} className="mx-auto mb-3 opacity-30" /><p>No users found</p></div>}
            </div>
        </div>
    );
}
