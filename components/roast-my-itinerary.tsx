"use client"
import React, { useState, useTransition, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import {
  Flame,
  Sparkles,
  Trash2,
  PlusCircle,
  Sheet,
  Loader2,
  Lightbulb,
  AlertTriangle,
  Send,
  Mic,
  AudioWaveform,
} from "lucide-react" // Added AudioWaveform
import { roastItineraryAction, roastGoogleSheetAction, roastVoiceNoteAction } from "@/app/actions" // Added roastVoiceNoteAction
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { CodePenFireOverlay } from "./codepen-fire-overlay"
import { ROAST_CHARACTERS, DEFAULT_CHARACTER_ID } from "@/lib/characters"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"

interface CustomSpeechRecognition extends SpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

interface Day {
  id: number
  details: string
}

export function RoastMyItinerary() {
  const [isPending, startTransition] = useTransition()
  const [days, setDays] = useState<Day[]>([{ id: 1, details: "" }])
  const [sheetUrl, setSheetUrl] = useState<string>("")
  const [voiceNoteText, setVoiceNoteText] = useState<string>("") // State for voice note tab
  const [roastItems, setRoastItems] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("manual")
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(DEFAULT_CHARACTER_ID)
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = React.useState(
    ROAST_CHARACTERS.findIndex((c) => c.id === DEFAULT_CHARACTER_ID),
  )

  const [listeningDayId, setListeningDayId] = useState<number | null>(null)
  const [isListeningVoiceNote, setIsListeningVoiceNote] = useState<boolean>(false) // State for voice note listening
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null)
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false)

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognitionAPI) {
      setSpeechRecognitionSupported(true)
      const recognitionInstance = new SpeechRecognitionAPI() as CustomSpeechRecognition
      recognitionInstance.continuous = true // Keep listening even after pauses
      recognitionInstance.interimResults = true // Get results as they come
      recognitionInstance.lang = "en-US"
      recognitionRef.current = recognitionInstance
    } else {
      console.warn("Speech Recognition API not supported in this browser.")
    }
  }, [])

  useEffect(() => {
    if (!carouselApi) {
      return
    }
    const initialIndex = ROAST_CHARACTERS.findIndex((c) => c.id === DEFAULT_CHARACTER_ID)
    if (initialIndex !== -1) {
      carouselApi.scrollTo(initialIndex, true)
      setCurrentSlide(initialIndex)
    }

    const onSelect = () => {
      const selectedIndex = carouselApi.selectedScrollSnap()
      setCurrentSlide(selectedIndex)
    }

    carouselApi.on("select", onSelect)
    return () => {
      carouselApi.off("select", onSelect)
    }
  }, [carouselApi])

  const handleDayListen = (dayId: number) => {
    const recognition = recognitionRef.current
    if (!recognition) return

    if (listeningDayId === dayId) {
      recognition.stop()
      setListeningDayId(null)
      return
    }
    if (isListeningVoiceNote) recognition.stop() // Stop voice note if active

    setListeningDayId(dayId)
    setIsListeningVoiceNote(false)

    recognition.onresult = (event) => {
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
      }
      if (finalTranscript) {
        setDays((prevDays) =>
          prevDays.map((d) =>
            d.id === dayId
              ? { ...d, details: d.details ? `${d.details} ${finalTranscript.trim()}` : finalTranscript.trim() }
              : d,
          ),
        )
      }
    }
    recognition.onend = () => setListeningDayId(null)
    recognition.onerror = (event) => {
      console.error("Speech recognition error (day):", event.error)
      recognition.stop()
      setListeningDayId(null)

      const friendly =
        event.error === "network"
          ? "Speech-to-text temporarily lost its connection. Please check your internet and try again."
          : event.error === "not-allowed"
            ? "Microphone access denied. Please allow mic access in your browser settings."
            : `Speech recognition error: ${event.error}`

      setError(friendly)
    }
    recognition.start()
  }

  const handleVoiceNoteListen = () => {
    const recognition = recognitionRef.current
    if (!recognition) return

    if (isListeningVoiceNote) {
      recognition.stop()
      setIsListeningVoiceNote(false)
      return
    }
    if (listeningDayId !== null) recognition.stop() // Stop day listening if active

    setIsListeningVoiceNote(true)
    setListeningDayId(null)

    recognition.onresult = (event) => {
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
      }
      if (finalTranscript) {
        setVoiceNoteText((prev) => (prev ? `${prev} ${finalTranscript.trim()}` : finalTranscript.trim()))
      }
    }
    recognition.onend = () => setIsListeningVoiceNote(false)
    recognition.onerror = (event) => {
      console.error("Speech recognition error (voice note):", event.error)

      // Stop the current recognition session cleanly.
      recognition.stop()

      // Reset local listening state so the UI updates instantly.
      setIsListeningVoiceNote(false)
      setListeningDayId(null)

      // Convert common errors to friendlier messages.
      const friendly =
        event.error === "network"
          ? "Speech-to-text temporarily lost its connection. Please check your internet and try again."
          : event.error === "not-allowed"
            ? "Microphone access denied. Please allow mic access in your browser settings."
            : `Speech recognition error: ${event.error}`

      setError(friendly)
    }
    recognition.start()
  }

  const handleAddDay = () => setDays([...days, { id: days.length + 1, details: "" }])
  const handleRemoveDay = (id: number) => setDays(days.filter((day) => day.id !== id))
  const handleDayChange = (id: number, details: string) =>
    setDays(days.map((day) => (day.id === id ? { ...day, details } : day)))

  const processRoastResult = (result: { roastItems?: string[]; error?: string }) => {
    if (result.error) setError(result.error)
    else setRoastItems(result.roastItems || null)
    if (!result.roastItems && !result.error) setError("Could not generate a roast. Try again!")
  }

  const handleSubmitCurrentForm = () => {
    const currentCharacterIdToSubmit = ROAST_CHARACTERS[currentSlide]?.id || DEFAULT_CHARACTER_ID
    setError(null)
    setRoastItems(null) // Clear previous results

    if (activeTab === "manual") {
      if (days.every((day) => !day.details.trim())) {
        setError("Please enter some itinerary details for at least one day.")
        return
      }
      startTransition(async () => processRoastResult(await roastItineraryAction(days, currentCharacterIdToSubmit)))
    } else if (activeTab === "sheet") {
      if (!sheetUrl.trim()) {
        setError("Please enter a Google Sheet URL.")
        return
      }
      startTransition(async () =>
        processRoastResult(await roastGoogleSheetAction(sheetUrl, currentCharacterIdToSubmit)),
      )
    } else if (activeTab === "voice") {
      if (!voiceNoteText.trim()) {
        setError("Please dictate or type some itinerary details for your voice note.")
        return
      }
      startTransition(async () =>
        processRoastResult(await roastVoiceNoteAction(voiceNoteText, currentCharacterIdToSubmit)),
      )
    }
  }

  const activeCharacter = ROAST_CHARACTERS[currentSlide] || ROAST_CHARACTERS.find((c) => c.id === DEFAULT_CHARACTER_ID)

  return (
    <>
      {isPending && <CodePenFireOverlay />}
      <div className="w-full space-y-10 md:space-y-12">
        <header className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Get Your Itinerary Roasted by
            <br />
            <span className="text-primary-glow transition-all duration-300 ease-in-out">
              {activeCharacter?.name || "a Mystery Guest"}
            </span>
          </h1>
          {activeCharacter && (
            <p className="text-md md:text-lg text-muted-foreground max-w-xl mx-auto italic transition-opacity duration-300 ease-in-out">
              "{activeCharacter.description}"
            </p>
          )}
        </header>

        <section className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-semibold text-center">
            Swipe to Choose Your <span className="text-primary">Roaster</span>
          </h2>
          <Carousel
            setApi={setCarouselApi}
            opts={{ align: "center", loop: true }}
            className="w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto"
          >
            <CarouselContent className="-ml-1">
              {ROAST_CHARACTERS.map((character, index) => (
                <CarouselItem key={character.id} className="pl-1 md:basis-1/2 lg:basis-1/3">
                  <div className="p-1">
                    <Card
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out aspect-[3/4]",
                        currentSlide === index
                          ? "ring-2 ring-primary shadow-xl"
                          : "opacity-60 scale-90 hover:opacity-80",
                      )}
                    >
                      <CardContent className="flex aspect-square items-center justify-center p-0 relative">
                        <Image
                          src={character.imageUrl || "/placeholder.svg"}
                          alt={character.name}
                          width={300}
                          height={400}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                        {currentSlide !== index && (
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors"></div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Selected: <span className="font-semibold text-foreground">{activeCharacter?.name}</span>
          </p>
        </section>

        <section className="space-y-6">
          <Tabs defaultValue="manual" className="w-full max-w-2xl mx-auto" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg mb-6">
              {" "}
              {/* Changed to grid-cols-3 */}
              <TabsTrigger
                value="manual"
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md py-2.5"
              >
                <Flame className="w-4 h-4 mr-2" /> Manual
              </TabsTrigger>
              <TabsTrigger
                value="sheet"
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md py-2.5"
              >
                <Sheet className="w-4 h-4 mr-2" /> Sheet
              </TabsTrigger>
              <TabsTrigger
                value="voice"
                className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md py-2.5"
              >
                <AudioWaveform className="w-4 h-4 mr-2" /> Voice
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual">
              <Card className="shadow-lg border bg-card/90 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Enter Your Itinerary Details</CardTitle>
                  <CardDescription>The more detail, the better (and funnier) the roast.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[calc(100vh-500px)] md:max-h-[400px] overflow-y-auto p-4 md:p-6">
                  {days.map((day, index) => (
                    <div key={day.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor={`day-${day.id}`} className="text-sm font-medium">
                          Day {index + 1}
                        </Label>
                        <div className="flex items-center space-x-2">
                          {speechRecognitionSupported && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDayListen(day.id)}
                              className={cn(
                                "h-7 w-7 text-muted-foreground hover:text-primary",
                                listeningDayId === day.id && "text-red-500 animate-pulse",
                              )}
                              title={listeningDayId === day.id ? "Stop dictation" : "Start dictation"}
                            >
                              <Mic className="w-4 h-4" />
                            </Button>
                          )}
                          {days.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveDay(day.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only">Remove day</span>
                            </Button>
                          )}
                        </div>
                      </div>
                      <Textarea
                        id={`day-${day.id}`}
                        placeholder={`e.g., "Woke up late, missed my flight, cried over a croissant."`}
                        value={day.details}
                        onChange={(e) => handleDayChange(day.id, e.target.value)}
                        className="min-h-[70px] text-sm focus-visible:ring-primary/50 bg-background/70"
                      />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full mt-4" onClick={handleAddDay}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Another Day
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="sheet">
              {/* Sheet content remains the same */}
              <Card className="shadow-lg border bg-card/90 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Import from Google Sheets</CardTitle>
                  <CardDescription>
                    Paste the link to your **publicly shared** Google Sheet. We'll analyze the first sheet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 md:p-6">
                  <div>
                    <Label htmlFor="sheet-url" className="text-sm font-medium">
                      Google Sheet URL
                    </Label>
                    <Input
                      id="sheet-url"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="mt-1 bg-background/70"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Make sure your sheet is shared: "Anyone with the link can view".
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="voice">
              <Card className="shadow-lg border bg-card/90 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Dictate Your Itinerary</CardTitle>
                  <CardDescription>
                    {speechRecognitionSupported
                      ? "Click the microphone to start and stop dictating your travel plans."
                      : "Speech recognition is not supported in your browser. Please type your itinerary."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 md:p-6">
                  <Textarea
                    id="voice-note-textarea"
                    placeholder="Describe your trip... e.g., 'Day one, I plan to visit the Eiffel Tower, then grab some croissants. Day two, Louvre museum all day...'"
                    value={voiceNoteText}
                    onChange={(e) => setVoiceNoteText(e.target.value)}
                    className="min-h-[150px] md:min-h-[200px] text-sm focus-visible:ring-primary/50 bg-background/70"
                    disabled={!speechRecognitionSupported && listeningDayId !== null} // Disable if not supported and not listening to a day
                  />
                  {speechRecognitionSupported && (
                    <Button
                      type="button"
                      onClick={handleVoiceNoteListen}
                      className={cn(
                        "w-full py-3 text-base",
                        isListeningVoiceNote
                          ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground",
                      )}
                    >
                      <Mic className="w-5 h-5 mr-2" />
                      {isListeningVoiceNote ? "Stop Dictation" : "Start Dictation"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="text-center mt-8">
            <Button
              type="button"
              onClick={handleSubmitCurrentForm}
              className="w-full max-w-xs mx-auto text-lg py-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-lg hover:shadow-primary/40 transition-all duration-300 transform hover:scale-105"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Roasting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Roast My Itinerary!
                </>
              )}
            </Button>
          </div>
        </section>

        {(roastItems || error) && !isPending && (
          <section className="mt-12 md:mt-16">
            <Card className="shadow-xl border bg-card/90 backdrop-blur-sm max-w-3xl mx-auto">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center text-2xl md:text-3xl text-primary">
                  <Sparkles className="w-7 h-7 mr-3" />
                  The Verdict from {activeCharacter?.name || "The Critic"}
                </CardTitle>
                <CardDescription>Your itinerary, judged with fire (and a little advice).</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3 max-h-[500px] overflow-y-auto">
                {error && (
                  <Card className="bg-red-100 border-2 border-red-500 text-red-700 p-4 shadow-md">
                    <CardHeader className="p-0 mb-2 flex flex-row items-center space-x-2">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                      <CardTitle className="text-lg font-semibold text-red-700">Roast Failed</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 text-sm">
                      <p className="font-medium">{error}</p>
                    </CardContent>
                  </Card>
                )}
                {roastItems &&
                  roastItems.length > 0 &&
                  roastItems.map((item, index) => {
                    const isAdvice = item.startsWith("Real Talk:")
                    const content = isAdvice ? item.substring("Real Talk: ".length) : item
                    return (
                      <Card
                        key={index}
                        className={cn(
                          "p-3 shadow-md border rounded-lg",
                          isAdvice
                            ? "bg-sky-100 border-sky-300 text-sky-800"
                            : "bg-orange-100 border-orange-300 text-orange-800",
                        )}
                      >
                        <div className="flex items-start space-x-3">
                          {isAdvice ? (
                            <Lightbulb className="w-5 h-5 mt-0.5 text-sky-600 flex-shrink-0" />
                          ) : (
                            <Flame className="w-5 h-5 mt-0.5 text-orange-600 flex-shrink-0" />
                          )}
                          <p className="text-sm font-medium">{content}</p>
                        </div>
                      </Card>
                    )
                  })}
              </CardContent>
            </Card>
          </section>
        )}
        {!roastItems && !error && !isPending && (
          <div className="text-center text-muted-foreground py-10 mt-8">
            <Flame className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p className="text-lg">Submit your itinerary to get it roasted!</p>
          </div>
        )}
      </div>
    </>
  )
}
