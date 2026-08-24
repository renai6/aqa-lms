// The BPI and GCash account details shown wherever a student is asked to pay
// offline: checkout, and the additional-payment page. One copy, so the account
// numbers cannot drift apart.
export function PaymentInstructions() {
  return (
    <div className="bg-muted/40 space-y-4 rounded-xl border p-4">
      <div>
        <h2 className="text-foreground text-sm font-semibold">
          Where to send your payment
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Pay via bank transfer or GCash, then upload your proof of payment
          below.
        </p>
      </div>

      <div className="border-primary/25 bg-secondary space-y-1 rounded-lg border p-3">
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">
          BPI
        </p>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Account Name</span>
          <span className="text-foreground text-right font-medium">
            AQA-Online Islamic School
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Account Number</span>
          <span className="text-foreground text-right font-medium tabular-nums">
            2129356823
          </span>
        </div>
      </div>

      <div className="space-y-1 rounded-lg border border-[#2a6fb0]/25 bg-[#e6f0fa] p-3">
        <p className="text-xs font-semibold tracking-wide text-[#1e5a94] uppercase">
          GCash
        </p>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Number</span>
          <span className="text-foreground text-right font-medium tabular-nums">
            09970767501
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="text-foreground text-right font-medium">
            Malihah M.
          </span>
        </div>
      </div>
    </div>
  );
}
