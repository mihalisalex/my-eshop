interface JsonLdProps {
  data: object;
}

/** Renders a JSON-LD <script> tag. `data` is always app-generated (schema.org objects), never raw user input. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
