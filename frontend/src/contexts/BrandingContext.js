import { createContext, useContext, useState, useEffect } from 'react';
import API from '@/lib/api';

const BrandingContext = createContext({});

export function BrandingProvider({ children }) {
    const [branding, setBranding] = useState({});

    useEffect(() => {
        API.get('/public/branding').then(r => setBranding(r.data)).catch(() => {});
    }, []);

    return (
        <BrandingContext.Provider value={branding}>
            {children}
        </BrandingContext.Provider>
    );
}

export const useBranding = () => useContext(BrandingContext);
