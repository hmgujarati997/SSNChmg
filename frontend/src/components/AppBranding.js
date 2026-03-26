import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle({ className = '' }) {
    const { theme, toggleTheme } = useTheme();
    return (
        <Button variant="ghost" size="icon" onClick={toggleTheme} className={className} data-testid="theme-toggle-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
    );
}

export function AppLogo({ size = 'md' }) {
    const sizes = { sm: 'h-7', md: 'h-9', lg: 'h-12' };
    return (
        <div className="flex items-center gap-2" data-testid="app-logo">
            <img src="/sbc_logo.png" alt="SBC" className={`${sizes[size]} w-auto object-contain`} />
        </div>
    );
}
