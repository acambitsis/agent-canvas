import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Canvas',
  description: 'AI Agent Workflow Visualization and Configuration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                'convex/browser': 'https://esm.sh/convex@1.31.4/browser',
              },
            }),
          }}
        />
      </head>
      <body className="app-layout">{children}</body>
    </html>
  );
}
