import Image from "next/image";

/**
 * Fanned-out strip of event photos, largest in the middle.
 * Swap the real photos by editing this array.
 */
const PHOTOS = [
  { src: "/home/event-1.png", alt: "AQA students at a recognition day" },
  { src: "/home/event-2.jpeg", alt: "AQA families at an Eid celebration" },
  { src: "/home/event-3.jpeg", alt: "AQA quarterly recognition and Eid-ul-Adha celebration" },
  { src: "/home/event-4.png", alt: "AQA pupils receiving their awards" },
  { src: "/home/event-5.png", alt: "An AQA parent and pupil on recognition day" },
];

/** Rotation and vertical offset per photo, outermost tilted the most. */
const LAYOUT = [
  { rotate: -11, translateY: 28 },
  { rotate: -6, translateY: 10 },
  { rotate: 0, translateY: 0 },
  { rotate: 6, translateY: 10 },
  { rotate: 11, translateY: 28 },
];

export default function PhotoStrip() {
  return (
    <div className="flex items-center justify-center -space-x-4 sm:-space-x-6">
      {PHOTOS.map((photo, i) => {
        const { rotate, translateY } = LAYOUT[i];
        const isCenter = i === 2;
        return (
          <div
            key={photo.src}
            className={[
              "relative shrink-0 overflow-hidden rounded-[10px] bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]",
              // The outermost pair is dropped on small screens so the
              // strip still reads as a fan rather than a scrum.
              i === 0 || i === 4 ? "hidden md:block" : "",
              isCenter
                ? "z-10 w-[140px] sm:w-[230px] lg:w-[285px]"
                : "w-[96px] sm:w-[150px] lg:w-[181px]",
            ].join(" ")}
            style={{ transform: `rotate(${rotate}deg) translateY(${translateY}px)` }}
          >
            <div
              className={[
                "relative overflow-hidden rounded-[6px]",
                isCenter ? "aspect-[4/3]" : "aspect-[4/5]",
              ].join(" ")}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 640px) 40vw, 285px"
                className="object-cover"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
