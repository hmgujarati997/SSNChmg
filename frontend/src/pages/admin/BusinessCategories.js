import { useState, useEffect, useRef } from 'react';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Tags, ChevronDown, ChevronRight, Upload, FileSpreadsheet, AlertCircle, Download } from 'lucide-react';

export default function BusinessCategories() {
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState({});
    const [catName, setCatName] = useState('');
    const [subName, setSubName] = useState('');
    const [selectedCatId, setSelectedCatId] = useState(null);
    const [expandedCat, setExpandedCat] = useState(null);
    const [showAddCat, setShowAddCat] = useState(false);
    const [showAddSub, setShowAddSub] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);

    const loadCategories = async () => {
        try {
            const r = await API.get('/admin/categories');
            // Sort A-Z on frontend as well (backend also sorts)
            const sorted = [...r.data].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            setCategories(sorted);
        } catch {}
    };

    const loadSubcategories = async (catId) => {
        try {
            const r = await API.get(`/admin/subcategories?category_id=${catId}`);
            // Sort A-Z
            const sorted = [...r.data].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            setSubcategories(prev => ({ ...prev, [catId]: sorted }));
        } catch {}
    };

    useEffect(() => { loadCategories(); }, []);

    const addCategory = async () => {
        if (!catName.trim()) return;
        try {
            await API.post('/admin/categories', { name: catName, collaborates_with: [] });
            toast.success('Category added');
            setCatName('');
            setShowAddCat(false);
            loadCategories();
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const deleteCategory = async (id) => {
        try { await API.delete(`/admin/categories/${id}`); toast.success('Deleted'); loadCategories(); } catch {}
    };

    const addSubcategory = async () => {
        if (!subName.trim() || !selectedCatId) return;
        try {
            await API.post('/admin/subcategories', { name: subName, category_id: selectedCatId });
            toast.success('Subcategory added');
            setSubName('');
            setShowAddSub(false);
            loadSubcategories(selectedCatId);
            loadCategories(); // refresh counts
        } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
    };

    const deleteSubcategory = async (id, catId) => {
        try {
            await API.delete(`/admin/subcategories/${id}`);
            toast.success('Deleted');
            loadSubcategories(catId);
            loadCategories();
        } catch {}
    };

    const toggleExpand = (catId) => {
        if (expandedCat === catId) { setExpandedCat(null); }
        else { setExpandedCat(catId); loadSubcategories(catId); }
    };

    const downloadSampleCSV = () => {
        const csv = `IT Services,Real Estate,Finance\nWeb Development,Residential,Banking\nMobile Apps,Commercial,Insurance\nCloud Computing,Land,Investment`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'sample_categories.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const handleCSVUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const r = await API.post('/admin/categories/upload-csv', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const d = r.data;
            toast.success(
                `Done! Categories: ${d.categories_created} new, ${d.categories_skipped} existing. Subcategories: ${d.subcategories_created} new, ${d.subcategories_skipped} existing.`,
                { duration: 6000 }
            );
            loadCategories();
            // Refresh any expanded subcategories
            if (expandedCat) loadSubcategories(expandedCat);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'CSV upload failed');
        }
        setUploading(false);
        // Reset file input so same file can be re-uploaded
        if (fileRef.current) fileRef.current.value = '';
    };

    return (
        <div data-testid="business-categories">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold tracking-tight" style={{fontFamily:'Outfit'}}>Business Categories</h2>
                <div className="flex gap-2">
                    <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={handleCSVUpload} />
                    <Button variant="outline" onClick={downloadSampleCSV} data-testid="download-sample-categories-csv-btn">
                        <Download size={16} className="mr-2" />Sample CSV
                    </Button>
                    <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="upload-csv-categories-btn">
                        <Upload size={16} className="mr-2" />{uploading ? 'Uploading...' : 'Upload CSV'}
                    </Button>
                    <Dialog open={showAddCat} onOpenChange={setShowAddCat}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary" data-testid="add-category-btn"><Plus size={16} className="mr-2" />Add Category</Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#121212] border-border">
                            <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <div><Label>Category Name</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g., IT Services" className="bg-muted/50 border-border h-11 mt-1" data-testid="category-name-input" onKeyDown={e => e.key === 'Enter' && addCategory()} /></div>
                                <Button onClick={addCategory} className="w-full" data-testid="save-category-btn">Save Category</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* CSV format hint */}
            <div className="glass-card rounded-xl p-4 mb-6 flex items-start gap-3" data-testid="csv-format-hint">
                <FileSpreadsheet size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="text-muted-foreground">
                        <span className="text-foreground font-medium">CSV Format:</span> Each column header is a <span className="text-primary">Business Category</span>, rows below are its <span className="text-[hsl(var(--emerald))]">Subcategories</span>. Duplicates are automatically skipped. Everything is sorted A-Z.
                    </p>
                    <div className="mt-2 bg-card rounded-lg p-3 font-mono text-xs overflow-x-auto">
                        <table className="text-muted-foreground">
                            <thead><tr className="text-primary">
                                <th className="pr-6 text-left">IT Services</th>
                                <th className="pr-6 text-left">Real Estate</th>
                                <th className="pr-6 text-left">Finance</th>
                            </tr></thead>
                            <tbody className="text-[hsl(var(--emerald))]">
                                <tr><td className="pr-6">Web Development</td><td className="pr-6">Residential</td><td className="pr-6">Banking</td></tr>
                                <tr><td className="pr-6">Mobile Apps</td><td className="pr-6">Commercial</td><td className="pr-6">Insurance</td></tr>
                                <tr><td className="pr-6">Cloud Computing</td><td className="pr-6">Land</td><td className="pr-6">Investment</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Category list */}
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
                            <div className="border-t border-border p-4 pl-12 space-y-2">
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
                {categories.length === 0 && (
                    <div className="text-center text-muted-foreground p-12 glass-card rounded-xl">
                        <FileSpreadsheet size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="mb-1">No categories yet</p>
                        <p className="text-sm">Upload a CSV or add categories manually</p>
                    </div>
                )}
            </div>

            <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
                <DialogContent className="bg-[#121212] border-border">
                    <DialogHeader><DialogTitle>Add Subcategory</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label>Subcategory Name</Label><Input value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g., Web Development" className="bg-muted/50 border-border h-11 mt-1" data-testid="subcategory-name-input" onKeyDown={e => e.key === 'Enter' && addSubcategory()} /></div>
                        <Button onClick={addSubcategory} className="w-full" data-testid="save-subcategory-btn">Save Subcategory</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
