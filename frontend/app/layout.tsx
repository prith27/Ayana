import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ayana',
  description: 'Explore the world in 3D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-black" suppressHydrationWarning>
        {/*
         * v=alpha required for Photorealistic 3D Maps.
         * Do NOT add libraries=maps3d — load on demand via importLibrary.
         * loading=async is required by the new Maps JS API loading pattern.
         */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_MAPS_API_KEY}&v=alpha&loading=async`}
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  )
}
