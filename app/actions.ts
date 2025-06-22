"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { ROAST_CHARACTERS, DEFAULT_CHARACTER_ID } from "@/lib/characters"

interface Day {
  id: number
  details: string
}

interface RoastResult {
  roastItems?: string[]
  error?: string
}

function stripMarkdownCodeFences(text: string): string {
  const regex = /^```(?:json)?\s*([\s\S]*?)\s*```$/
  const match = text.trim().match(regex)
  if (match && match[1]) {
    return match[1].trim()
  }
  return text.trim()
}

function getCharacterPersona(characterId?: string): string {
  const character = ROAST_CHARACTERS.find((c) => c.id === characterId)
  return character
    ? character.personaPrompt
    : ROAST_CHARACTERS.find((c) => c.id === DEFAULT_CHARACTER_ID)!.personaPrompt
}

export async function roastItineraryAction(days: Day[], characterId: string): Promise<RoastResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { error: "OpenAI API key is not configured." }
  }

  const itineraryText = days.map((day, index) => `Day ${index + 1}: ${day.details}`).join("\n")

  if (!itineraryText.trim()) {
    return { error: "Itinerary is empty. Please provide some details." }
  }

  const characterPersona = getCharacterPersona(characterId)

  const prompt = `
    ${characterPersona}
    Your job is to roast the user's structured travel itinerary based on this persona.
    The output MUST be a JSON array of strings.
    Each string in the array should be a short, punchy statement (max 1-2 sentences) reflecting your character.
    Include 3-4 of these roast statements.
    After the roast statements, include 1-2 strings in the array that are genuinely useful pieces of advice. Start these with "Real Talk: ". These advice lines should be neutral and not necessarily in character.
    Do NOT include any other text, preamble, or sign-off outside of the JSON array.

    Example output format:
    [
      "Your Day 1 sounds less like a vacation and more like a cry for help.",
      "Did you plan this with a blindfold and a dartboard?",
      "Real Talk: Consider adding some downtime on Day 3, you're not a robot."
    ]

    Here is the structured itinerary to roast:
    ---
    ${itineraryText}
    ---
  `
  return getRoastFromAI(prompt)
}

export async function roastGoogleSheetAction(sheetUrl: string, characterId: string): Promise<RoastResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { error: "OpenAI API key is not configured." }
  }
  if (!sheetUrl || !sheetUrl.startsWith("https://docs.google.com/spreadsheets/d/")) {
    return { error: "Invalid Google Sheet URL provided." }
  }

  const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (!sheetIdMatch || !sheetIdMatch[1]) {
    return { error: "Could not extract Sheet ID from URL." }
  }
  const sheetId = sheetIdMatch[1]
  const gid = "0"
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

  try {
    const response = await fetch(csvUrl)
    if (!response.ok) {
      return {
        error: `Could not fetch sheet (Status: ${response.status}) ${csvUrl}. Make sure it's shared publicly ("Anyone with the link can view") and the link is correct.`,
      }
    }
    const rawSheetText = await response.text()

    if (!rawSheetText.trim()) {
      return { error: "The first sheet of your Google Sheet appears to be empty or could not be read." }
    }

    const characterPersona = getCharacterPersona(characterId)

    const sheetPrompt = `
      ${characterPersona}
      Your first task is to interpret the raw text content from a user's spreadsheet to understand their travel itinerary. The content might be messy or unstructured. Do your best to make sense of it and identify daily plans or distinct activities.
      Once you've inferred the itinerary, your second task is to roast it based on your character persona.
      Your final output MUST be a JSON array of strings.
      Each string in the array should be a short, punchy statement (max 1-2 sentences) reflecting your character.
      Include 3-4 of these roast statements based on the itinerary you inferred.
      After the roast statements, include 1-2 strings in the array that are genuinely useful pieces of advice related to the inferred itinerary. Start these with "Real Talk: ". These advice lines should be neutral and not necessarily in character.
      Do NOT include any other text, preamble, or sign-off outside of the JSON array.

      Example output format if the sheet contained "Paris Day 1: Eiffel Tower, Day 2: Louvre":
      [
        "Interpreting your spreadsheet was an adventure in itself. So, Eiffel Tower on day one, huh? Groundbreaking.",
        "The Louvre on Day 2? Hope you enjoy crowds and getting lost.",
        "Real Talk: Pre-book tickets for popular attractions like the Eiffel Tower and Louvre to save time.",
        "Real Talk: Wear comfortable shoes; you'll be doing a lot of walking."
      ]

      Here is the raw spreadsheet content to interpret and then roast:
      ---
      ${rawSheetText}
      ---
    `
    return getRoastFromAI(prompt)
  } catch (e) {
    console.error("Error processing Google Sheet:", e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    return { error: `Failed to process Google Sheet. ${errorMessage}` }
  }
}

// New action for voice notes
export async function roastVoiceNoteAction(voiceNoteText: string, characterId: string): Promise<RoastResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { error: "OpenAI API key is not configured." }
  }

  if (!voiceNoteText.trim()) {
    return { error: "Voice note is empty. Please provide some details." }
  }

  const characterPersona = getCharacterPersona(characterId)

  const prompt = `
    ${characterPersona}
    Your first task is to interpret the following unstructured text, which is a transcript of a user's voice note describing their travel itinerary. The content might be conversational, messy, or unstructured. Do your best to make sense of it and identify daily plans or distinct activities.
    Once you've inferred the itinerary, your second task is to roast it based on your character persona.
    Your final output MUST be a JSON array of strings.
    Each string in the array should be a short, punchy statement (max 1-2 sentences) reflecting your character.
    Include 3-4 of these roast statements based on the itinerary you inferred.
    After the roast statements, include 1-2 strings in the array that are genuinely useful pieces of advice related to the inferred itinerary. Start these with "Real Talk: ". These advice lines should be neutral and not necessarily in character.
    Do NOT include any other text, preamble, or sign-off outside of the JSON array.

    Example output format if the voice note was "Okay so like, day one, Eiffel Tower, maybe some croissants. Then day two, gotta hit the Louvre.":
    [
      "Listening to that was... an experience. Eiffel Tower and croissants, groundbreaking stuff for day one.",
      "The Louvre on day two? Hope you enjoy crowds and feeling lost in a giant building. Riveting.",
      "Real Talk: Pre-book tickets for popular attractions like the Eiffel Tower and Louvre to save time.",
      "Real Talk: Consider using a travel app to organize your thoughts before dictating next time."
    ]

    Here is the voice note transcript to interpret and then roast:
    ---
    ${voiceNoteText}
    ---
  `
  return getRoastFromAI(prompt)
}

async function getRoastFromAI(prompt: string): Promise<RoastResult> {
  try {
    const { text: rawAiText } = await generateText({
      model: openai("gpt-4o"),
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.78,
    })

    const cleanedText = stripMarkdownCodeFences(rawAiText)

    try {
      const parsedRoast = JSON.parse(cleanedText)
      if (Array.isArray(parsedRoast) && parsedRoast.every((item) => typeof item === "string")) {
        const validItems = parsedRoast.filter((item) => item.trim().length > 0)
        if (validItems.length > 0) {
          return { roastItems: validItems }
        } else {
          console.warn("AI returned an empty array or array of empty strings after cleaning:", parsedRoast)
          return { error: "The AI gave a very short (or empty) roast. Try being more detailed!" }
        }
      } else {
        console.warn("AI response parsed but not an array of strings:", parsedRoast)
        return { roastItems: ["AI returned an unexpected format. Here's the raw output: " + cleanedText] }
      }
    } catch (parseError) {
      console.warn(
        "Failed to parse AI response as JSON, falling back to newline splitting. Cleaned text:",
        cleanedText,
        "Parse error:",
        parseError,
      )
      const lines = cleanedText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line !== "[" && line !== "]" && !line.startsWith("```"))

      if (lines.length > 0) {
        return { roastItems: lines }
      }
      return { error: "The AI's response was a bit garbled. Please try again!" }
    }
  } catch (error) {
    console.error("Error generating roast from AI:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { error: `AI interaction failed. Details: ${errorMessage}` }
  }
}
