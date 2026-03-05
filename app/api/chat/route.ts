import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { question, profile } = (await request.json()) as { question?: string; profile?: unknown };

    if (!question) {
      return NextResponse.json({ error: "Please include a question." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are LifeRank AI, a supportive self-improvement coach. Speak in a warm, encouraging tone and treat personal growth like a game: talk about levels, XP, quests, and opportunity points without being childish. Always focus first on the 1-2 lowest scoring life categories and suggest 3-7 concrete, highly practical actions the user can take in the next 7-30 days to level up their score. Keep responses structured, scannable, and optimistic."
        },
        {
          role: "user",
          content: (() => {
            const p = profile as any;
            const categories = p?.categories ?? {};
            const opportunities = p?.opportunities ?? [];

            const profileLines = [
              "User LifeRank Profile",
              `Score: ${p?.lifeScore ?? "unknown"}`,
              `Potential Score: ${p?.potentialScore ?? "unknown"}`,
              `OperatingPercent: ${p?.operatingPercent ?? "unknown"}%`,
              `Career: ${categories.Career ?? "unknown"}`,
              `Money: ${categories.Money ?? "unknown"}`,
              `Health: ${categories.Health ?? "unknown"}`,
              `Social: ${categories.Social ?? "unknown"}`,
              `Growth: ${categories.Growth ?? "unknown"}`,
              "",
              "Biggest Opportunities (lowest categories first):",
              ...(Array.isArray(opportunities)
                ? opportunities.map(
                    (o: any, index: number) =>
                      `${index + 1}. ${o.category ?? "Unknown"} — +${o.potential ?? "?"} opportunity points`
                  )
                : []),
              "",
              "User Question:",
              question
            ];

            return profileLines.join("\n");
          })()
        }
      ],
      temperature: 0.7,
      max_tokens: 280
    });

    return NextResponse.json({ reply: completion.choices[0]?.message?.content ?? "No response generated." });
  } catch (error) {
    return NextResponse.json({ error: "LifeRank AI is currently unavailable." }, { status: 500 });
  }
}
