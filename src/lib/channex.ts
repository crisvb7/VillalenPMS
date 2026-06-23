/**
 * Channex.io API client
 * Docs: https://developers.channex.io/
 *
 * Authentication: X-Api-Key header
 * Base URL: https://api.channex.io/api/v1
 */

const CHANNEX_BASE = 'https://api.channex.io/api/v1'

async function getConfig(): Promise<{ apiKey: string; propertyId: string } | null> {
  const { prisma } = await import('./prisma')
  const config = await prisma.channelConfig.findUnique({ where: { channel: 'channex' } })
  if (!config || !config.active || !config.apiKey || !config.propertyId) return null
  return { apiKey: config.apiKey, propertyId: config.propertyId }
}

async function apiCall(
  apiKey: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${CHANNEX_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`[Channex] ${method} ${path} → ${res.status}`, data)
    throw new Error(`Channex API error ${res.status}: ${JSON.stringify(data)}`)
  }
  return data
}

/**
 * Push availability for a room type over a date range.
 * availability = 0 → closed/blocked; availability = 1 → open.
 */
export async function pushAvailability(
  channexRoomTypeId: string,
  dateFrom: Date,
  dateTo: Date,
  availability: 0 | 1
): Promise<void> {
  const cfg = await getConfig()
  if (!cfg) {
    console.info('[Channex] No active config — skipping availability push')
    return
  }

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  await apiCall(cfg.apiKey, 'POST', '/availability', {
    availability: [
      {
        property_id: cfg.propertyId,
        room_type_id: channexRoomTypeId,
        date_from: formatDate(dateFrom),
        date_to: formatDate(dateTo),
        availability,
      },
    ],
  })
}

/**
 * Push daily rates for a rate plan.
 * Call this when base prices change.
 */
export async function pushRates(
  ratePlanId: string,
  dateFrom: Date,
  dateTo: Date,
  ratePerNight: number
): Promise<void> {
  const cfg = await getConfig()
  if (!cfg) {
    console.info('[Channex] No active config — skipping rate push')
    return
  }

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  await apiCall(cfg.apiKey, 'POST', '/rates', {
    rates: [
      {
        property_id: cfg.propertyId,
        rate_plan_id: ratePlanId,
        date_from: formatDate(dateFrom),
        date_to: formatDate(dateTo),
        rate: ratePerNight,
      },
    ],
  })
}

/** List all room types for the configured property */
export async function listRoomTypes(): Promise<RoomType[]> {
  const cfg = await getConfig()
  if (!cfg) return []
  const data = await apiCall(cfg.apiKey, 'GET', `/room_types?filter[property_id]=${cfg.propertyId}`)
  return ((data as { data?: RoomType[] }).data) ?? []
}

/** List all properties accessible with the API key */
export async function listProperties(apiKey: string): Promise<Property[]> {
  const data = await apiCall(apiKey, 'GET', '/properties')
  return ((data as { data?: Property[] }).data) ?? []
}

export interface RoomType {
  id: string
  attributes: { title: string; capacity: number }
}

export interface Property {
  id: string
  attributes: { title: string; currency: string }
}

/**
 * Verify Channex webhook signature.
 * Channex sends X-Channex-Signature: sha256=<hmac>
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const sigBytes = Buffer.from(signature.replace('sha256=', ''), 'hex')
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload))
}
