// No geocoding API call — just opens a prefilled Google Maps search so the
// developer can copy the address/website back into the form by hand.
export function AddressWebsiteHelper({
  name,
  city,
  state,
}: {
  name: string
  city?: string | null
  state?: string | null
}) {
  const query = [name, city, state].filter(Boolean).join(' ')
  const href = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-caddie-accent"
      style={{ fontSize: 12 }}
    >
      Look up address/website on Google Maps →
    </a>
  )
}
