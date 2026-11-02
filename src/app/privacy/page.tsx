import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" }, title: "Privacy" };

/** What the site records, why, and for how long. Plain and short. */
export default function Privacy() {
  return (
    <main className="min-h-screen bg-[#f3f4f6] px-5 py-12 text-[#16181c] sm:px-10">
      <div className="mx-auto max-w-[640px] space-y-4 text-[16px] leading-[1.6] text-black/75">
        <Link href="/" className="text-[14px] text-black/50 hover:text-black">← Back</Link>
        <h1 className="text-[34px] font-medium tracking-[-0.02em] text-black">Privacy</h1>
        <p>
          This is Ghanshyam Paunikar&apos;s personal portfolio. To see who visits and what is useful, it records each
          visit: the time, the page, the site you came from, your device, browser and language, and your approximate
          location (country, region, city) as estimated from your IP address by the hosting provider.
        </p>
        <p>
          Your IP address is stored for 90 days and then deleted automatically. The location and device counts are kept
          as statistics. Questions you type to Elio, the assistant, are recorded with the start of its answer so it can
          be improved. If you tell Elio your name, it is recorded with your visits so Ghanshyam can see who stopped by.
        </p>
        <p>
          Elio remembers your name and what you looked at in your own browser only (local storage), so it can say
          &ldquo;welcome back&rdquo;. Clearing your browser data removes it. Voice input is turned into text by Microsoft
          Azure&apos;s speech service; the recording is not kept.
        </p>
        <p>
          Nothing is sold or shared. Totals by country, city, device and browser are shown publicly on the site&apos;s
          stats page; individual visits, IP addresses and typed questions are visible only to Ghanshyam. To ask what is held about you or to have it
          deleted, email{" "}
          <a className="underline" href="mailto:ghanshyampaunikar@gmail.com">ghanshyampaunikar@gmail.com</a>.
        </p>
      </div>
    </main>
  );
}
