export const isOpenAiConfigured = Boolean(process.env.OPENAI_API_KEY);

type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

export async function generateStructuredJson<T>({
  schema,
  input,
  instructions
}: {
  schema: JsonSchema;
  input: unknown;
  instructions: string;
}): Promise<T> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions,
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          strict: true,
          schema: schema.schema
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "OpenAI request failed.");
  }

  const payload = await response.json();
  const text = extractOutputText(payload);
  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return JSON.parse(text) as T;
}

function extractOutputText(payload: unknown) {
  const data = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (data.output_text) return data.output_text;

  return data.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" && content.text)
    ?.text;
}
