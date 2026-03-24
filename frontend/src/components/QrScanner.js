import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrScanner({ onScan, onError }) {
    const scannerRef = useRef(null);
    const html5QrRef = useRef(null);
    const [active, setActive] = useState(false);
    const processedRef = useRef(false);

    const startScanner = async () => {
        if (html5QrRef.current) return;
        processedRef.current = false;
        const scannerId = 'qr-scanner-region';

        try {
            const html5Qr = new Html5Qrcode(scannerId);
            html5QrRef.current = html5Qr;
            setActive(true);

            await html5Qr.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                (decodedText) => {
                    if (processedRef.current) return;
                    processedRef.current = true;
                    onScan(decodedText);
                    stopScanner();
                },
                () => {}
            );
        } catch (err) {
            setActive(false);
            html5QrRef.current = null;
            if (onError) onError(err?.message || 'Camera access denied');
        }
    };

    const stopScanner = async () => {
        if (html5QrRef.current) {
            try { await html5QrRef.current.stop(); } catch {}
            try { html5QrRef.current.clear(); } catch {}
            html5QrRef.current = null;
        }
        setActive(false);
    };

    useEffect(() => {
        return () => { stopScanner(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-3">
            <div
                ref={scannerRef}
                id="qr-scanner-region"
                className="w-full rounded-xl overflow-hidden bg-black/50"
                style={{ minHeight: active ? 300 : 0 }}
                data-testid="qr-scanner-viewport"
            />
            {!active ? (
                <button
                    onClick={startScanner}
                    className="w-full h-12 rounded-xl bg-[hsl(var(--emerald))]/20 text-[hsl(var(--emerald))] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(var(--emerald))]/30 transition-colors"
                    data-testid="start-camera-btn"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                    Open Camera to Scan
                </button>
            ) : (
                <button
                    onClick={stopScanner}
                    className="w-full h-10 rounded-xl bg-destructive/20 text-destructive font-semibold text-sm flex items-center justify-center gap-2 hover:bg-destructive/30 transition-colors"
                    data-testid="stop-camera-btn"
                >
                    Stop Camera
                </button>
            )}
        </div>
    );
}
