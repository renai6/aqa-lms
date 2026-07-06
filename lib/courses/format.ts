import type { PaymentFrequency } from "@prisma/client";

const FREQUENCY_SUFFIX: Record<PaymentFrequency, string> = {
  MONTHLY: "/ month",
  YEARLY: "/ year",
  ONE_TIME: "one-time",
};

export function priceSuffix(freq: PaymentFrequency | null): string {
  return freq ? FREQUENCY_SUFFIX[freq] : "";
}
