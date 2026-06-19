export default function Footer() {
  return (
    <footer className="bg-zinc-950 py-4">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} Al-Qur&apos;an Academy International. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
