import { ShieldCheck } from "lucide-react";
export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><ShieldCheck className="size-4" /></span>
      <span>FINANCIAL <span className="text-primary">IQ</span></span>
    </div>
  );
}
