import type { Metadata } from 'next';
import './globals.css';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/rewards';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'),
  icons: { icon: `${basePath}/favicon.svg` },
  title: '进迭时空开发者大会 2026 · 幸运抽奖',
  description: 'Open Source, Build Things。进迭时空开发者大会现场幸运抽奖。',
  openGraph: { title: '进迭时空开发者大会 2026 · 幸运抽奖', description: '灵感在此相遇，幸运即刻发生。', images: [`${basePath}/og.png`] },
  twitter: { card: 'summary_large_image', images: [`${basePath}/og.png`], title: '进迭时空开发者大会 2026 · 幸运抽奖' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
