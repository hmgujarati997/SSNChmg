import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        if (sessionStorage.getItem('pwa-dismissed')) return;

        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
        window.addEventListener('beforeinstallprompt', handler);

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const install = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
        setDismissed(true);
    };

    const dismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('pwa-dismissed', '1');
    };

    if (dismissed || !deferredPrompt) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up sm:left-auto sm:right-4 sm:max-w-sm" data-testid="pwa-install-prompt">
            <div className="glass-card rounded-2xl p-4 border border-primary/20 shadow-2xl shadow-primary/10">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Download className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">Install SSNC App</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Add to home screen for quick access</p>
                    </div>
                    <button onClick={dismiss} className="text-muted-foreground hover:text-white transition-colors p-1" data-testid="pwa-dismiss-btn">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex gap-2 mt-3">
                    <Button onClick={install} size="sm" className="flex-1 h-9 text-xs bg-primary" data-testid="pwa-install-btn">
                        <Download size={14} className="mr-1.5" />Install
                    </Button>
                    <Button onClick={dismiss} variant="outline" size="sm" className="h-9 text-xs" data-testid="pwa-later-btn">Later</Button>
                </div>
            </div>
        </div>
    );
}
