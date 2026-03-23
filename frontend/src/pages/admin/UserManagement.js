import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users } from 'lucide-react';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        API.get('/admin/users').then(r => setUsers(r.data)).catch(() => {});
    }, []);

    const filtered = users.filter(u =>
        (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.phone || '').includes(search) ||
        (u.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.category_name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div data-testid="user-management">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Users</h2>
                <Badge variant="outline" className="text-sm">{users.length} total</Badge>
            </div>

            <div className="relative mb-6">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, business, category..." className="bg-black/30 border-white/10 h-11 pl-10" data-testid="user-search-input" />
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-white/5">
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold">Name</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden sm:table-cell">Phone</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden md:table-cell">Business</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden lg:table-cell">Category</th>
                            <th className="text-left p-3 text-xs text-muted-foreground uppercase font-bold hidden lg:table-cell">Position</th>
                        </tr></thead>
                        <tbody>{filtered.map(u => (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                            {(u.full_name || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{u.full_name}</p>
                                            <p className="text-xs text-muted-foreground sm:hidden">{u.phone}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3 text-muted-foreground hidden sm:table-cell">{u.phone}</td>
                                <td className="p-3 text-muted-foreground hidden md:table-cell">{u.business_name}</td>
                                <td className="p-3 hidden lg:table-cell"><Badge variant="outline" className="text-xs">{u.category_name || '-'}</Badge></td>
                                <td className="p-3 text-muted-foreground hidden lg:table-cell">{u.position}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
                {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground"><Users size={32} className="mx-auto mb-3 opacity-30" /><p>No users found</p></div>}
            </div>
        </div>
    );
}
