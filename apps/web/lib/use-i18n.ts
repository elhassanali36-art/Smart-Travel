'use client';
import { useParams } from 'next/navigation';
import { dirOf, getDict } from './i18n';

export function useI18n() {
  const { locale = 'en' } = useParams<{ locale: string }>();
  return { locale, t: getDict(locale), dir: dirOf(locale) };
}
