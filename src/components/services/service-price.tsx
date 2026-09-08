import {
  getServicePriceDisplay,
  type ServicePriceDisplay,
} from "@/lib/services/pricing";
import type { ServiceDoc } from "@/lib/booking/types";

export function ServicePrice({
  service,
  layout = "stacked",
  className = "",
}: {
  service: ServiceDoc;
  layout?: "stacked" | "badge";
  className?: string;
}) {
  const pricing = getServicePriceDisplay(service);
  if (!pricing.label) return null;

  if (layout === "badge") {
    return (
      <div className={`shrink-0 text-right ${className}`}>
        <div className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-[#f96316]">
          {pricing.label}
        </div>
        {pricing.optionsLabel ? (
          <div className="mt-1 text-[0.7rem] font-medium text-[#64748b]">
            {pricing.optionsLabel}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="text-base font-bold text-[#f96316]">{pricing.label}</div>
      {pricing.optionsLabel ? (
        <div className="mt-0.5 text-xs font-medium text-[#64748b]">
          {pricing.optionsLabel}
        </div>
      ) : null}
    </div>
  );
}

export function ServicePriceFromDisplay({
  pricing,
  layout = "stacked",
  className = "",
}: {
  pricing: ServicePriceDisplay;
  layout?: "stacked" | "badge";
  className?: string;
}) {
  if (!pricing.label) return null;

  if (layout === "badge") {
    return (
      <div className={`shrink-0 text-right ${className}`}>
        <div className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-[#f96316]">
          {pricing.label}
        </div>
        {pricing.optionsLabel ? (
          <div className="mt-1 text-[0.7rem] font-medium text-[#64748b]">
            {pricing.optionsLabel}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="text-base font-bold text-[#f96316]">{pricing.label}</div>
      {pricing.optionsLabel ? (
        <div className="mt-0.5 text-xs font-medium text-[#64748b]">
          {pricing.optionsLabel}
        </div>
      ) : null}
    </div>
  );
}
