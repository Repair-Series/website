import Link from "next/link";
import { Container } from "@/components/container";
import { Wrench } from "lucide-react";
import { getCityPath, SERVICE_CITIES } from "@/lib/seo/site";

// Inline SVG for the Instagram icon
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

// Inline SVG for the Google Play Store icon
function PlayStoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-[#f3f4f6] pt-12 pb-8 text-black">
      <Container>
        {/* Top Logo Section */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-semibold  text-black"
          >
            <div className="flex size-8 items-center justify-center rounded bg-black text-white">
              <img src="/web-app-manifest-192x192.png" alt="Repair Series" className="size-8" />
            </div>
            <span>Repair Series</span>
          </Link>
        </div>

        {/* 4 Column Grid */}
        <div className="mb-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          
          {/* Column 1: Company */}
          <div>
            <h5 className="mb-5 text-[1.1rem] font-semibold text-black">
              Company
            </h5>
            <ul className="space-y-3.5">
              {[
                { label: "About us", href: "/about" },
                { label: "Terms & conditions", href: "/terms" },
                { label: "Privacy policy", href: "/privacy-policy" },
                { label: "Refund policy", href: "/refund" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[0.95rem] text-gray-600 transition-colors hover:text-black"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: For customers */}
          <div>
            <h5 className="mb-5 text-[1.1rem] font-semibold text-black">
              For customers
            </h5>
            <ul className="space-y-3.5">
              {[
                { label: "Categories near you", href: "/services" },
                ...SERVICE_CITIES.map((city) => ({
                  label: `Services in ${city}`,
                  href: getCityPath(city),
                })),
                { label: "RS Reviews", href: "https://www.google.com/maps/place/Repair+Series/@28.4012186,76.9557952,17z/data=!4m8!3m7!1s0x390d3d26e8925053:0x7fb0e356f61ef7c4!8m2!3d28.4012186!4d76.9557952!9m1!1b1!16s%2Fg%2F11yzq3gt89?entry=ttu&g_ep=EgoyMDI2MDYyNC4wIKXMDSoASAFQAw%3D%3D" },
                { label: "Contact us", href: "/contact" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[0.95rem] text-gray-600 transition-colors hover:text-black"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: For professionals */}
          <div>
            <h5 className="mb-5 text-[1.1rem] font-semibold text-black">
              For professionals
            </h5>
            <ul className="space-y-3.5">
              <li>
                <Link
                  href="/partner"
                  className="text-[0.95rem] text-gray-600 transition-colors hover:text-black"
                >
                  Register as a professional
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Social links & Apps */}
          <div>
            <h5 className="mb-5 text-[1.1rem] font-semibold text-black">
              Social links
            </h5>
            
            {/* Social Icons (Rounded) */}
            <div className="mb-6 flex gap-3">
              <a
                href="https://www.instagram.com/repairseries/"
                target="_blank"
                rel="noreferrer"
                className="flex size-[42px] items-center justify-center rounded-full border border-gray-300 bg-white text-black transition-colors hover:bg-gray-100"
                aria-label="Instagram"
              >
                <InstagramIcon className="size-5" />
              </a>
              {/* You can duplicate the <a> tag above for Twitter/Facebook/LinkedIn icons if needed */}
            </div>

            {/* App Badges */}
            <div className="flex flex-col gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=com.repairseries.user"
                className="inline-flex h-[42px] w-[140px] items-center gap-2 rounded bg-black px-3 py-1 text-white transition-opacity hover:opacity-85"
              >
                <PlayStoreIcon className="size-6 text-white" />
                <div className="flex flex-col items-start justify-center">
                  <span className="text-[8px] font-medium uppercase tracking-wide text-white/80">
                    Get it on
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-white">
                    Google Play
                  </span>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Footer Bottom (Copyright Line) */}
        <div className="border-t border-gray-300 pt-6 text-[0.85rem] text-gray-500">
          <p>
            &copy; Copyright {new Date().getFullYear()} Repair Series. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}