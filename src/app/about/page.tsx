import { Container } from "@/components/container";
import Link from "next/link";
import { 
  Target, 
  Handshake, 
  Clock, 
  Award, 
  Sparkles, 
  ArrowRight 
} from "lucide-react";

export const metadata = {
  title: "About Us | Repair Series",
  description: "Learn about Repair Series and our mission to deliver trusted appliance repair across Gurugram, Hyderabad & Aligarh.",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-white font-sans text-[#1e293b]">
      
      {/* Page Header */}
      <section className="bg-[#f8fafc] py-20 text-center sm:py-28">
        <Container className="max-w-[800px]">
          <span className="mb-4 inline-block rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold tracking-wide text-[#f96316] shadow-sm">
            Our Story
          </span>
          <h1 className="mb-6 text-balance text-4xl font-bold tracking-tight text-[#0a0f1c] sm:text-5xl lg:text-6xl">
            Fixing the Appliance Repair Industry, <br className="hidden md:block" />
            <span className="text-[#f96316]">One Home at a Time.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#64748b]">
            We started Repair Series because finding a trustworthy, skilled, and transparent appliance technician should not be a hassle — whether you are in Gurugram, Hyderabad, or Aligarh.
          </p>
        </Container>
      </section>

      {/* The Problem & Mission Section */}
      <section className="py-20 sm:py-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="pr-0 lg:pr-8">
              <h2 className="mb-6 text-3xl font-bold tracking-tight text-[#0a0f1c] sm:text-4xl">
                The Problem We Are Solving
              </h2>
              <p className="mb-4 text-lg text-[#64748b]">
                For years, the local appliance repair market has been plagued by unverified technicians, hidden charges, and poor-quality spare parts that break down within weeks.
              </p>
              <p className="mb-8 text-lg text-[#64748b]">
                <strong className="font-semibold text-[#0a0f1c]">Repair Series</strong> was built to change this. We act as a bridge between highly skilled, background-verified technicians and households that need urgent, reliable help. By standardizing pricing and providing a strict 30-day warranty, we ensure peace of mind for every customer.
              </p>

              {/* Mission Box */}
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[#f8fafc] p-5 shadow-sm">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-[#f96316] shadow-sm">
                  <Target className="size-6" />
                </div>
                <div>
                  <h6 className="font-bold text-[#0a0f1c]">Our Mission</h6>
                  <p className="text-sm text-[#64748b]">
                    To become India&apos;s most trusted and customer-centric home service brand.
                  </p>
                </div>
              </div>
            </div>

            {/* Image with Floating Badge */}
            <div className="relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
              <img
                src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&q=80&w=800"
                alt="Repair Series Technicians"
                className="h-[450px] w-full rounded-[2rem] object-cover shadow-2xl"
              />
              <div className="absolute -left-6 bottom-12 flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:-left-10">
                <h2 className="text-4xl font-bold text-[#f96316]">10+</h2>
                <p className="text-sm font-bold leading-tight text-[#0a0f1c]">
                  Years of<br />Expertise
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Stats Section */}
      <section className="bg-[#0a0f1c] py-16 text-white">
        <Container>
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4 md:gap-4">
            <div>
              <h2 className="mb-2 text-4xl font-bold text-[#f96316] sm:text-5xl">5k+</h2>
              <p className="font-medium text-[#94a3b8]">Repairs Completed</p>
            </div>
            <div>
              <h2 className="mb-2 text-4xl font-bold text-[#f96316] sm:text-5xl">50+</h2>
              <p className="font-medium text-[#94a3b8]">Verified Experts</p>
            </div>
            <div>
              <h2 className="mb-2 text-4xl font-bold text-[#f96316] sm:text-5xl">4.8</h2>
              <p className="font-medium text-[#94a3b8]">Average Rating</p>
            </div>
            <div>
              <h2 className="mb-2 text-4xl font-bold text-[#f96316] sm:text-5xl">100%</h2>
              <p className="font-medium text-[#94a3b8]">Transparent Pricing</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Core Values */}
      <section className="bg-[#f8fafc] py-20 sm:py-24">
        <Container>
          <div className="mx-auto mb-16 max-w-[700px] text-center">
            <h2 className="mb-4 text-3xl font-bold text-[#0a0f1c] sm:text-4xl">Our Core Values</h2>
            <p className="text-lg text-[#64748b]">
              The principles that guide our technicians every time they step into your home.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-transparent bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-[#f96316]/20 hover:shadow-lg">
              <Handshake className="mx-auto mb-4 size-10 text-[#f96316]" />
              <h5 className="mb-3 text-lg font-bold text-[#0a0f1c]">Integrity</h5>
              <p className="text-sm leading-relaxed text-[#64748b]">
                We never suggest unnecessary part replacements just to increase the bill.
              </p>
            </div>
            <div className="rounded-2xl border border-transparent bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-[#f96316]/20 hover:shadow-lg">
              <Clock className="mx-auto mb-4 size-10 text-[#f96316]" />
              <h5 className="mb-3 text-lg font-bold text-[#0a0f1c]">Punctuality</h5>
              <p className="text-sm leading-relaxed text-[#64748b]">
                Your time is valuable. Our technicians aim to reach you within the 90-minute slot.
              </p>
            </div>
            <div className="rounded-2xl border border-transparent bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-[#f96316]/20 hover:shadow-lg">
              <Award className="mx-auto mb-4 size-10 text-[#f96316]" />
              <h5 className="mb-3 text-lg font-bold text-[#0a0f1c]">Quality First</h5>
              <p className="text-sm leading-relaxed text-[#64748b]">
                We source only 100% genuine and OEM-certified spare parts for your appliances.
              </p>
            </div>
            <div className="rounded-2xl border border-transparent bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-[#f96316]/20 hover:shadow-lg">
              <Sparkles className="mx-auto mb-4 size-10 text-[#f96316]" />
              <h5 className="mb-3 text-lg font-bold text-[#0a0f1c]">Cleanliness</h5>
              <p className="text-sm leading-relaxed text-[#64748b]">
                We leave your home exactly as we found it. No mess left behind after the repair.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Leadership / Founder Section */}
      <section className="py-20 sm:py-24">
        <Container>
          <div className="grid items-center gap-10 rounded-[2rem] border border-gray-100 bg-white p-8 shadow-sm sm:p-12 lg:grid-cols-12 lg:gap-16">
            <div className="text-center lg:col-span-4">
              <img
                src="https://www.repairseries.in/assets/Devesh-founder-of-repairseries.png" // Ensure this image exists in your public folder
                alt="Devesh Kumar - Founder"
                className="mx-auto h-[300px] w-[250px] rounded-3xl object-cover shadow-lg"
              />
            </div>
            <div className="text-center lg:col-span-8 lg:text-left">
              <span className="mb-4 inline-block rounded-full border border-gray-200 bg-[#f8fafc] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#f96316] shadow-sm">
                Leadership
              </span>
              <h2 className="mb-1 text-3xl font-bold text-[#0a0f1c] sm:text-4xl">Devesh Kumar</h2>
              <h6 className="mb-6 font-medium text-[#f96316]">Founder, Repair Series</h6>
              
              <blockquote className="mb-6 border-l-4 border-[#f96316] pl-4 text-left text-lg font-medium italic leading-relaxed text-[#64748b]">
                "The vision behind Repair Series was simple: to bring trust, professionalism, and absolute transparency back into the home service industry. I saw too many families struggling with unverified technicians and hidden charges."
              </blockquote>
              
              <p className="text-[#64748b] leading-relaxed">
                With a deep commitment to high-quality service and customer satisfaction, Devesh leads the team to ensure that every repair is handled with integrity. His goal is to make Repair Series the standard for appliance care across our service cities.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="bg-[#f8fafc] py-20 text-center sm:py-24">
        <Container className="max-w-[700px]">
          <h2 className="mb-8 text-3xl font-bold tracking-tight text-[#0a0f1c] sm:text-4xl">
            Experience the Repair Series Difference Today
          </h2>
          <Link
            href="/contact"
            className="inline-flex h-14 items-center justify-center rounded-full bg-[#f96316] px-10 text-base font-bold text-white shadow-[0_8px_20px_rgba(249,99,22,0.25)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#ea580c] hover:shadow-[0_10px_25px_rgba(249,99,22,0.35)]"
          >
            Book a Service <ArrowRight className="ml-2 size-5" />
          </Link>
        </Container>
      </section>

    </div>
  );
}

