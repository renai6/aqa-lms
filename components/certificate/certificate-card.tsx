import Image from "next/image";

type Props = {
  studentName: string;
  courseTitle: string;
  average: number;
  certificateNo?: string;
  issuedAt?: string;
};

// Presentational certificate of completion. All sizing is expressed in
// container-query width units (cqw), so the exact same design renders as a
// full-size sheet on the certificate page and as a mini preview on the course
// page - it always fills, and scales to, whatever width its container has.
// The footer (certificate number + issue date) only renders once the
// certificate has actually been issued; the mini preview omits it.
export function CertificateCard({
  studentName,
  courseTitle,
  average,
  certificateNo,
  issuedAt,
}: Props) {
  return (
    <div className="@container aspect-[297/210] w-full bg-white">
      <div className="relative h-full w-full">
        {/* Border frame */}
        <div className="border-primary/70 absolute inset-[1.6cqw] border-[0.2cqw]" />
        <div className="border-primary/30 absolute inset-[2.6cqw] border-[0.1cqw]" />

        <div className="relative flex h-full flex-col items-center justify-center px-[9cqw] text-center">
          <Image
            src="/aqa-logo.png"
            alt="Al-Qur'an Academy"
            width={72}
            height={72}
            className="mb-[1.6cqw] h-[8cqw] w-[8cqw] object-contain"
          />
          <p className="text-primary text-[1.3cqw] font-semibold tracking-[0.35em] uppercase">
            Al-Qur&apos;an Academy
          </p>

          <h1 className="font-heading text-foreground mt-[2.5cqw] text-[3.6cqw] font-bold tracking-tight">
            Certificate of Completion
          </h1>

          <p className="text-muted-foreground mt-[2.5cqw] text-[1.5cqw]">
            This certifies that
          </p>
          <p className="text-foreground mt-[0.8cqw] text-[2.8cqw] font-semibold">
            {studentName}
          </p>

          <p className="text-muted-foreground mt-[1.6cqw] max-w-[64cqw] text-[1.6cqw] leading-relaxed">
            has successfully completed{" "}
            <span className="text-foreground font-semibold">{courseTitle}</span>{" "}
            with a final average of{" "}
            <span className="text-primary font-semibold">{average}%</span>.
          </p>

          {certificateNo && issuedAt && (
            <div className="mt-[4cqw] flex w-[64cqw] items-end justify-between text-left">
              <div>
                <p className="text-muted-foreground text-[1.1cqw] tracking-[0.2em] uppercase">
                  Certificate No.
                </p>
                <p className="text-foreground text-[1.5cqw] font-medium">
                  {certificateNo}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-[1.1cqw] tracking-[0.2em] uppercase">
                  Issued
                </p>
                <p className="text-foreground text-[1.5cqw] font-medium">
                  {issuedAt}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
