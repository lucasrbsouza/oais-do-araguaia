import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const SITE_URL = "https://oasisaraguaia.com.br";
const SITE_DESCRIPTION =
  "Gestão do condomínio de chalés: reservas, compras, rateio e pagamentos.";

export const metadata: Metadata = {
  // Base absoluta para o preview de link (WhatsApp, redes) resolver o og:image;
  // sem isso o Next emite caminho relativo e o crawler não acha a imagem.
  metadataBase: new URL(SITE_URL),
  title: "Oásis do Araguaia",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Oásis do Araguaia",
    title: "Oásis do Araguaia",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "pt_BR",
    images: [
      {
        url: "/logo-sem-fundo.png",
        width: 500,
        height: 500,
        alt: "Logo Oásis do Araguaia",
      },
    ],
  },
  twitter: {
    // Card quadrado: combina com a logo 500x500 (o large_image cortaria).
    card: "summary",
    title: "Oásis do Araguaia",
    description: SITE_DESCRIPTION,
    images: ["/logo-sem-fundo.png"],
  },
};

// Sem maximumScale/userScalable: bloquear o zoom quebra a acessibilidade.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff385c",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
