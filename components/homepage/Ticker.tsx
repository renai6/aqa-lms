const ITEMS = [
  "Marhalah Mutawassitah",
  "Qur'an Tahseen & Tahfidh",
  "Kids Online Program",
  "Early Childhood Education",
  "Arabic Language",
  "Islamic Studies",
  "Saudi Ministry Curriculum",
  "Online & Onsite",
];

export default function Ticker() {
  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = [...ITEMS, ...ITEMS];

  return (
    <div className="bg-gold overflow-hidden py-3.5 whitespace-nowrap">
      <div className="animate-ticker inline-block">
        {loop.map((item, i) => (
          <span key={i} className="inline-flex items-center">
            <span className="text-primary px-9 text-[10px] font-bold tracking-[0.3em] uppercase">
              {item}
            </span>
            <span className="text-primary/30 text-sm">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
