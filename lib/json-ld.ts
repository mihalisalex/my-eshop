/**
 * The schema.org *shape* fed to `<JsonLd>` is app-generated, but its values are not:
 * productSchema embeds `product.name`/`description`, faqSchema embeds CMS answers,
 * organizationSchema embeds SEO settings. All of those are admin-authored or
 * CSV-imported, so a value containing `</script>` would close the tag early and let
 * whatever follows execute — stored XSS on every visitor to the page. JSON.stringify
 * does not escape `<`, so we do.
 *
 * Escaping `<` alone closes the injection; U+2028/U+2029 are escaped too because they
 * terminate a JS line even inside a string literal. The output stays valid JSON — these
 * are standard JSON escapes that parse back to the identical value.
 */
export function serializeForScriptTag(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
