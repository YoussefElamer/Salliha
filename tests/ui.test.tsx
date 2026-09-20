import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from '../src/app/App';
import { defaultSettings } from '../src/settings/defaults';

describe('UI shell', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('salliha:settings:v1', JSON.stringify({ ...defaultSettings, onboardingComplete: true, theme: 'dark' }));
  });

  it('renders RTL app with accessible navigation and dark mode', async () => {
    render(<App />);
    expect(await screen.findByText('الصلاة القادمة')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeInTheDocument();
  });
});
