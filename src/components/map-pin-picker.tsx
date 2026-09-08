"use client";

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

/**
 * Lightweight map pin preview (OSM) + manual nudge — no extra map SDK.
 */
export function MapPinPicker({ lat, lng, onChange }: Props) {
  const hasPin = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const la = Number(lat);
  const ln = Number(lng);
  const delta = 0.0008;

  const embed = hasPin
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${ln - 0.01}%2C${la - 0.008}%2C${ln + 0.01}%2C${la + 0.008}&layer=mapnik&marker=${la}%2C${ln}`
    : null;

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-[#E8E4E0] bg-[#F8F6F4] p-3">
      <div className="text-sm font-bold text-[#0a0f1c]">Map pin</div>
      {embed ? (
        <iframe
          title="Service location map"
          src={embed}
          className="h-48 w-full rounded-xl border-0 bg-white"
          loading="lazy"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl bg-white text-sm text-[#64748b]">
          Use current location to drop a pin
        </div>
      )}
      {hasPin ? (
        <>
          <p className="text-xs text-[#64748b]">
            Pin: {la.toFixed(5)}, {ln.toFixed(5)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Nudge label="N" onClick={() => onChange(la + delta, ln)} />
            <Nudge label="S" onClick={() => onChange(la - delta, ln)} />
            <Nudge label="E" onClick={() => onChange(la, ln + delta)} />
            <Nudge label="W" onClick={() => onChange(la, ln - delta)} />
            <a
              href={`https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=17/${la}/${ln}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-full border px-3 text-xs font-bold text-[#C45508]"
            >
              Open full map
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Nudge({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full border bg-white text-xs font-bold"
    >
      {label}
    </button>
  );
}
