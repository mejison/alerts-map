import type { Metadata, Viewport } from 'next';
import { DownloadLanding } from '@/components/download-landing';

export const metadata: Metadata = {
  title: 'ВАРТА для iPhone та Android — завантажити застосунок',
  description: 'Карта повітряних тривог України та сповіщення для вашої області. ВАРТА для iPhone, Android і браузера.',
};

export const viewport: Viewport = { themeColor: '#f7f6f2', colorScheme: 'light' };

export default function DownloadPage() { return <DownloadLanding/>; }
