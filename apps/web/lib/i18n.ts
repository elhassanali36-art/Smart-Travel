import { en } from '../locales/en';
import type { Dictionary } from '../locales/en';
import { ar } from '../locales/ar';

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (v: string): v is Locale => (locales as readonly string[]).includes(v);
export const getDict = (locale: string): Dictionary => (locale === 'ar' ? ar : en);
export const dirOf = (locale: string): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');
// "{n} guests" -> fmt(template, { n: 3 }). Unknown placeholders are left untouched.
export const fmt = (template: string, vars: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
export type { Dictionary };
