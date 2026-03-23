import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Tags, ChevronDown, ChevronRight } from 'lucide-react';

export default function BusinessCategories() {
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState({});
    const [catName, setCatName] = useState('');
    const [subName, setSubName] = useState('');
    const [selectedCatId, setSelectedCatId] = useState(null);
    const [expandedCat, setExpandedCat] = useState(null);
    const [showAddCat, setShowAddCat] = useState(false);
    const [showAddSub, setShowAddSub] = useState(false);
    const [editCat, setEditCat] = useState(null);

    const loadCategories = async () => {
        try { const r = await API.get('/admin/categories'); setCategories(r.data); } catch {}
    };

    const loadSubcategories = async (catId) => {
        try {
            const r = await API.get(`/admin/subcategories?category_id=${catId}`);
            setSubcategories(prev => ({ ...prev, [catId]: r.data }));
        } catch {}
    };

    useEffect(() => { loadCategories(); }, []);

    const addCategory = async () => {
        if (!catName.trim()) return;
        try {
            await API.post('/admin/categories', { name: catName, collaborates_with: [] });
            toast.success('Category added'); setCatName(''); setShowAddCat(false); loadCategories();
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const deleteCategory = async (id) => {
        try { await API.delete(`/admin/categories/${id}`); toast.success('Deleted'); loadCategories(); } catch {}
    };

    const addSubcategory = async () => {
        if (!subName.trim() || !selectedCatId) return;
        try {
            await API.post('/admin/subcategories', { name: subName, category_id: selectedCatId });
            toast.success('Subcategory added'); setSubName(''); setShowAddSub(false); loadSubcategories(selectedCatId);
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const deleteSubcategory = async (id, catId) => {
        try { await API.delete(`/admin/subcategories/${id}`); toast.success('Deleted'); loadSubcategories(catId); } catch {}
    };

    const toggleExpand = (catId) => {
        if (expandedCat === catId) { setExpandedCat(null); }
        else { setExpandedCat(catId); loadSubcategories(catId); }
    };

    return (
        <div data-testid="business-categories">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Business Categories</h2>
                <Dialog open={showAddCat} onOpenChange={setShowAddCat}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary" data-testid="add-category-btn"><Plus size={16} className="mr-2" />Add Category</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#121212] border-white/10">
                        <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div><Label>Category Name</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g., IT Services" className="bg-black/30 border-white/10 h-11 mt-1" data-testid="category-name-input" /></div>
                            <Button onClick={addCategory} className="w-full" data-testid="save-category-btn">Save Category</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-2">
                {categories.map(cat => (
                    <div key={cat.id} className="glass-card rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => toggleExpand(cat.id)}>
                            <div className="flex items-center gap-3">
                                {expandedCat === cat.id ? <ChevronDown size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
                                <Tags size={18} className="text-primary" />
                                <span className="font-medium">{cat.name}</span>
                                <Badge variant="outline" className="text-xs">{cat.subcategory_count} sub</Badge>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedCatId(cat.id); setShowAddSub(true); }} data-testid={`add-sub-${cat.id}`}>
                                    <Plus size={14} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}>
                                    <Trash2 size={14} className="text-destructive" />
                                </Button>
                            </div>
                        </div>
                        {expandedCat === cat.id && (
                            <div className="border-t border-white/5 p-4 pl-12 space-y-2">
                                {(subcategories[cat.id] || []).map(sub => (
                                    <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <span className="text-sm text-muted-foreground">{sub.name}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSubcategory(sub.id, cat.id)}>
                                            <Trash2 size={12} className="text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                {(!subcategories[cat.id] || subcategories[cat.id].length === 0) && (
                                    <p className="text-sm text-muted-foreground">No subcategories</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {categories.length === 0 && <div className="text-center text-muted-foreground p-12 glass-card rounded-xl">No categories yet. Add your first business category!</div>}
            </div>

            <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
                <DialogContent className="bg-[#121212] border-white/10">
                    <DialogHeader><DialogTitle>Add Subcategory</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label>Subcategory Name</Label><Input value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g., Web Development" className="bg-black/30 border-white/10 h-11 mt-1" data-testid="subcategory-name-input" /></div>
                        <Button onClick={addSubcategory} className="w-full" data-testid="save-subcategory-btn">Save Subcategory</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
