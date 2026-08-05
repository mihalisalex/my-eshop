import { serializeForScriptTag } from "@/lib/json-ld";

interface JsonLdProps {
  data: object;
}

/** Renders a JSON-LD <script> tag. See `serializeForScriptTag` for why the payload is escaped. */
export function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeForScriptTag(data) }} />;
}
