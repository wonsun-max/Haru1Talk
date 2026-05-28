import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * SEO & Search Engine indexing configuration.
 * 
 * WHY: Adheres to SEO best practices by defining a descriptive, localized title tag
 * and a meta description tailored to capture primary traffic looking for automated AI diaries.
 */
export const metadata: Metadata = {
  title: '하루 톡 (Haru Talk) | 대화하는 AI 감성 일기장',
  description: '쓰는 일기에서, 대화하는 일기로. 밤하늘 속 나만의 AI 친구와 주고받는 음성/텍스트 대화로 손쉽고 아름다운 감성 일기장을 자동으로 완성해 보세요.',
  keywords: ['하루톡', '대화형 일기', 'AI 일기장', '감정 분석', 'Whisper STT', 'Next.js 일기', 'Supabase 일기'],
  authors: [{ name: 'Haru Talk Team' }],
  openGraph: {
    title: '하루 톡 (Haru Talk) | 대화하는 AI 감성 일기장',
    description: '친구와 카톡하듯 대화하면 AI가 기승전결이 있는 한 편의 예쁜 일기를 써 줍니다.',
    type: 'website',
    locale: 'ko_KR',
  },
};

/**
 * Mobile-first device scaling configuration.
 * 
 * WHY: Crucial for webview containers and mobile browsers to prevent zooming bugs
 * and support 100dvh dynamic layouts cleanly without clipping.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

/**
 * Root Application Shell.
 * 
 * WHY: Declares Korean language standard, incorporates premium Pretendard web fonts,
 * and sets base styles for dark mode canvas to ensure zero flicker during navigations.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* Pretendard CDN for high-performance Korean typography */}
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
