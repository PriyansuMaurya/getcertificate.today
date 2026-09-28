import type { Metadata } from "next";
import { Manrope, Fraunces } from "next/font/google";
import "./globals.css";

// Fonts imported from the Figma design (getcertificate.today, landing-page 6:9)
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "getcertificate.today — Turn YouTube learning into verifiable credentials",
  description:
    "Describe a field of study. Watch educational videos on YouTube. Pass AI-generated assessments tailored to the content, and earn official shareable certificates. Learn Today. Go Further.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Required for pricing table */}
      <script async src="https://js.stripe.com/v3/pricing-table.js"></script>
      <body
        className={`${manrope.variable} ${fraunces.variable} font-manrope antialiased`}
      >
        {children}
        </body>
    </html>
  );
}
