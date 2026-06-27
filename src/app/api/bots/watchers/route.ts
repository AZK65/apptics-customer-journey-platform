import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const WATCHERS_PATH =
  process.env.SOCIAL_LISTENING_DIR
    ? join(process.env.SOCIAL_LISTENING_DIR, "watchers.json")
    : join(process.cwd(), "data", "watchers.json");

interface Watcher {
  name: string;
  chatId: string;
  queries: string[];
}

async function loadWatchers(): Promise<Watcher[]> {
  try {
    const raw = await readFile(WATCHERS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function GET() {
  const watchers = await loadWatchers();
  return NextResponse.json(watchers);
}

export async function PUT(req: Request) {
  const watchers: Watcher[] = await req.json();

  for (const w of watchers) {
    if (!w.name?.trim()) {
      return NextResponse.json({ error: "Every watcher needs a name" }, { status: 400 });
    }
  }

  await writeFile(WATCHERS_PATH, JSON.stringify(watchers, null, 2) + "\n");
  return NextResponse.json(watchers);
}
