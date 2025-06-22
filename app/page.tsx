import { RoastMyItinerary } from "@/components/roast-my-itinerary"

export default function Home() {
  return (
    // Removed bg-gray-50 dark:bg-gray-900 as body now has the background
    <main className="min-h-screen w-full flex flex-col items-center py-12 md:py-16 lg:py-20">
      <div className="container max-w-5xl px-4">
        {" "}
        {/* Max width adjusted */}
        <RoastMyItinerary />
      </div>
    </main>
  )
}
