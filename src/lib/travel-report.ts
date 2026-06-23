import { prisma } from './prisma'

export async function generateTravelReport(bookingId: string): Promise<string> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guest: true, room: true },
  })

  if (!booking) throw new Error(`Booking ${bookingId} not found`)

  const { guest, room } = booking
  const nameParts = guest.lastName.trim().split(' ')
  const apellido1 = nameParts[0] ?? guest.lastName
  const apellido2 = nameParts[1] ?? ''

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FICHERO_PARTES_VIAJEROS>
  <ESTABLECIMIENTO>
    <NOMBRE>Casa Rural La Aldea</NOMBRE>
    <NIF>00000000A</NIF>
    <TIPO>CH</TIPO>
    <MUNICIPIO>00000</MUNICIPIO>
    <PROVINCIA>00</PROVINCIA>
  </ESTABLECIMIENTO>
  <PARTES>
    <PARTE>
      <NUM_PARTE>${booking.id.slice(-8).toUpperCase()}</NUM_PARTE>
      <FECHA_ENTRADA>${booking.checkInDate.toISOString().split('T')[0]}</FECHA_ENTRADA>
      <FECHA_SALIDA>${booking.checkOutDate.toISOString().split('T')[0]}</FECHA_SALIDA>
      <HABITACION>${room.name}</HABITACION>
      <VIAJEROS>
        <VIAJERO>
          <TIPO_DOCUMENTO>D</TIPO_DOCUMENTO>
          <NUMERO_DOCUMENTO>${guest.documentId}</NUMERO_DOCUMENTO>
          <SOPORTE></SOPORTE>
          <NOMBRE>${guest.firstName}</NOMBRE>
          <APELLIDO1>${apellido1}</APELLIDO1>
          <APELLIDO2>${apellido2}</APELLIDO2>
          <SEXO>U</SEXO>
          <FECHA_NACIMIENTO></FECHA_NACIMIENTO>
          <PAIS_NACIONALIDAD>ESP</PAIS_NACIONALIDAD>
          <PAIS_EXPEDICION>ESP</PAIS_EXPEDICION>
        </VIAJERO>
      </VIAJEROS>
    </PARTE>
  </PARTES>
</FICHERO_PARTES_VIAJEROS>`

  console.log(`[Travel Report] Booking ${bookingId}:\n${xml}`)
  return xml
}
