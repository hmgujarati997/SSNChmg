import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import API from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Zap, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [form, setForm] = useState({
        full_name: '', phone: '', email: '', business_name: '',
        category_id: '', subcategory_id: '', position: '',
        linkedin: '', instagram: '', twitter: '', youtube: '',
        whatsapp: '91', facebook: '', website: ''
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        API.get('/public/categories').then(r => setCategories(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (form.category_id) {
            API.get(`/public/subcategories?category_id=${form.category_id}`).then(r => setSubcategories(r.data)).catch(() => {});
        } else {
            setSubcategories([]);
        }
    }, [form.category_id]);

    const validate = () => {
        const e = {};
        if (!form.full_name.trim()) e.full_name = 'Required';
        if (!form.phone.trim()) e.phone = 'Required';
        if (!form.business_name.trim()) e.business_name = 'Required';
        if (!form.category_id) e.category_id = 'Required';
        if (!form.subcategory_id) e.subcategory_id = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) {
            toast.error('Please fill all required fields');
            return;
        }
        setLoading(true);
        try {
            await login('/auth/user/register', form);
            toast.success('Account created successfully!');
            navigate('/user');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Registration failed');
        }
        setLoading(false);
    };

    const u = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const FieldError = ({ field }) => errors[field] ? (
        <span className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle size={10} />{errors[field]}</span>
    ) : null;

    return (
        <div className="min-h-screen bg-background p-6 pb-20" data-testid="register-page">
            <div className="max-w-lg mx-auto animate-fade-in">
                <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6" data-testid="back-to-login">
                    <ArrowLeft size={18} /> Back to Login
                </Link>

                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight" style={{fontFamily:'Outfit'}}>Create Account</h1>
                </div>
                <p className="text-muted-foreground mb-8 ml-[52px]">Join the SSNC Speed Networking community</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="glass-card rounded-xl p-6 space-y-4">
                        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Personal Info</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-muted-foreground">Full Name <span className="text-destructive">*</span></Label>
                                <Input value={form.full_name} onChange={e => u('full_name', e.target.value)} placeholder="John Doe" className={`bg-muted/50 border-border h-11 mt-1 ${errors.full_name ? 'border-destructive' : ''}`} data-testid="reg-name-input" />
                                <FieldError field="full_name" />
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Phone Number <span className="text-destructive">*</span></Label>
                                <Input value={form.phone} onChange={e => u('phone', e.target.value)} placeholder="9876543210" className={`bg-muted/50 border-border h-11 mt-1 ${errors.phone ? 'border-destructive' : ''}`} data-testid="reg-phone-input" />
                                <FieldError field="phone" />
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Email</Label>
                                <Input value={form.email} onChange={e => u('email', e.target.value)} placeholder="john@example.com" className="bg-muted/50 border-border h-11 mt-1" data-testid="reg-email-input" />
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Position</Label>
                                <Input value={form.position} onChange={e => u('position', e.target.value)} placeholder="CEO, Director..." className="bg-muted/50 border-border h-11 mt-1" data-testid="reg-position-input" />
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-xl p-6 space-y-4">
                        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Business Info <span className="text-destructive">*</span></h3>
                        <div>
                            <Label className="text-sm text-muted-foreground">Business Name <span className="text-destructive">*</span></Label>
                            <Input value={form.business_name} onChange={e => u('business_name', e.target.value)} placeholder="Your Company" className={`bg-muted/50 border-border h-11 mt-1 ${errors.business_name ? 'border-destructive' : ''}`} data-testid="reg-business-input" />
                            <FieldError field="business_name" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-muted-foreground">Business Category <span className="text-destructive">*</span></Label>
                                <Select value={form.category_id} onValueChange={v => { u('category_id', v); u('subcategory_id', ''); }}>
                                    <SelectTrigger className={`bg-muted/50 border-border h-11 mt-1 ${errors.category_id ? 'border-destructive' : ''}`} data-testid="reg-category-trigger">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError field="category_id" />
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Sub Category <span className="text-destructive">*</span></Label>
                                <Select value={form.subcategory_id} onValueChange={v => u('subcategory_id', v)}>
                                    <SelectTrigger className={`bg-muted/50 border-border h-11 mt-1 ${errors.subcategory_id ? 'border-destructive' : ''}`} data-testid="reg-subcategory-trigger">
                                        <SelectValue placeholder="Select sub-category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subcategories.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError field="subcategory_id" />
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-xl p-6 space-y-4">
                        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Social Links (Optional)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><Label className="text-sm text-muted-foreground">LinkedIn</Label><Input value={form.linkedin} onChange={e => u('linkedin', e.target.value)} placeholder="linkedin.com/in/..." className="bg-muted/50 border-border h-11 mt-1" /></div>
                            <div><Label className="text-sm text-muted-foreground">Website</Label><Input value={form.website} onChange={e => u('website', e.target.value)} placeholder="www.example.com" className="bg-muted/50 border-border h-11 mt-1" /></div>
                            <div><Label className="text-sm text-muted-foreground">WhatsApp</Label>
                                <div className="flex mt-1">
                                    <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0 border-border bg-black/50 text-muted-foreground text-xs">+</span>
                                    <Input value={form.whatsapp} onChange={e => u('whatsapp', e.target.value.replace(/[^0-9]/g, ''))} placeholder="919876543210" className="bg-muted/50 border-border h-11 rounded-l-none" data-testid="register-whatsapp-input" />
                                </div>
                            </div>
                            <div><Label className="text-sm text-muted-foreground">Instagram</Label><Input value={form.instagram} onChange={e => u('instagram', e.target.value)} placeholder="@username" className="bg-muted/50 border-border h-11 mt-1" /></div>
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-12 text-base font-semibold tracking-wide bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all duration-200" disabled={loading} data-testid="register-submit-btn">
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">Your phone number will be your default password</p>
                </form>
            </div>
        </div>
    );
}
