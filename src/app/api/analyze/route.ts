import { analyzeToken } from "@/lib/analyze-token";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return Response.json(
      {
        error: "Missing token query. Pass a token address with ?q=",
      },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeToken(query);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze token.";

    return Response.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
