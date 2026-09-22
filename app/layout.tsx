import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://spacemit-developer-lucky-2026.briny-melon-4297.chatgpt.site'),
  title: '进迭时空开发者大会 2026 · 幸运抽奖',
  description: 'Open Source, Build Things。进迭时空开发者大会现场幸运抽奖。',
  openGraph: { title: '进迭时空开发者大会 2026 · 幸运抽奖', description: '灵感在此相遇，幸运即刻发生。', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', images: ['/og.png'], title: '进迭时空开发者大会 2026 · 幸运抽奖' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
