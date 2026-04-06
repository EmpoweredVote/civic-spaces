// One-time upload script for Bloomington pilot photos. Run once against production Supabase.
//
// Usage:
//   SUPABASE_URL=https://<project-ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   npx tsx scripts/upload-bloomington-photos.ts
//
// After running, copy the printed SQL UPDATE statements into:
//   supabase/migrations/20260405100000_phase10_bloomington_photos.sql
// then run: npx supabase db reset

import { createClient } from '@supabase/supabase-js'

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Public domain photos from Wikimedia Commons — direct upload.wikimedia.org URLs only.
// Each photo is landscape/wide orientation, suitable for 16:5 aspect ratio hero banner.
const PHOTOS = [
  {
    // White House — wide south lawn view, public domain (US federal government work)
    // Source: https://commons.wikimedia.org/wiki/File:White_House_lawn.jpg
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/a/af/White_House_lawn.jpg',
    storagePath: 'bloomington/white-house.jpg',
    label: 'White House (Federal — IN-07)',
    geoid: '1807',
    sliceType: 'federal',
  },
  {
    // Indiana State Capitol (Statehouse) — Indianapolis, IN. Public domain.
    // Source: https://commons.wikimedia.org/wiki/File:Indiana_State_Capitol_building.jpg
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/c7/Indiana_State_Capitol_building.jpg',
    storagePath: 'bloomington/indiana-capitol.jpg',
    label: 'Indiana State Capitol (State — SD-46)',
    geoid: '18046',
    sliceType: 'state',
  },
  {
    // Monroe County Courthouse — Bloomington, Indiana. Public domain.
    // Source: https://commons.wikimedia.org/wiki/File:Monroe_County_Courthouse_Bloomington_Indiana.jpg
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/e/e5/Monroe_County_Courthouse_Bloomington_Indiana.jpg',
    storagePath: 'bloomington/courthouse.jpg',
    label: 'Monroe County Courthouse (Local — Monroe County)',
    geoid: '18097',
    sliceType: 'local',
  },
]

interface UploadedPhoto {
  label: string
  cdnUrl: string
  geoid: string
  sliceType: string
}

async function main() {
  console.log('Uploading Bloomington pilot hero photos to Supabase Storage...\n')

  const uploaded: UploadedPhoto[] = []

  for (const photo of PHOTOS) {
    process.stdout.write(`Downloading ${photo.label}... `)
    const response = await fetch(photo.sourceUrl)
    if (!response.ok) {
      throw new Error(`Failed to download ${photo.sourceUrl}: ${response.status} ${response.statusText}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    console.log(`${Math.round(buffer.length / 1024)}KB`)

    process.stdout.write(`Uploading to slice-photos/${photo.storagePath}... `)
    const { error } = await supabase.storage
      .from('slice-photos')
      .upload(photo.storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000',
      })
    if (error) throw error

    const { data } = supabase.storage
      .from('slice-photos')
      .getPublicUrl(photo.storagePath)

    console.log('done')
    console.log(`  CDN URL: ${data.publicUrl}`)

    uploaded.push({
      label: photo.label,
      cdnUrl: data.publicUrl,
      geoid: photo.geoid,
      sliceType: photo.sliceType,
    })
  }

  console.log('\n-- ----------------------------------------------------------------')
  console.log('-- Copy these UPDATE statements into the migration file:')
  console.log('--   supabase/migrations/20260405100000_phase10_bloomington_photos.sql')
  console.log('-- Then run: npx supabase db reset')
  console.log('-- ----------------------------------------------------------------\n')

  for (const photo of uploaded) {
    console.log(
      `UPDATE civic_spaces.slices SET photo_url = '${photo.cdnUrl}' WHERE geoid = '${photo.geoid}' AND slice_type = '${photo.sliceType}';`
    )
  }

  console.log('\nUpload complete.')
}

main().catch((err) => {
  console.error('Upload failed:', err)
  process.exit(1)
})
