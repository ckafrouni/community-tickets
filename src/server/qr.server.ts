import { encode, renderSVG } from 'uqr'

const QR_OPTIONS = { ecc: 'M', border: 2 } as const

export function qrSvg(text: string): string {
  return renderSVG(text, QR_OPTIONS)
}

export function qrPng(text: string, scale = 10): Promise<Uint8Array> {
  return encodeMonochromePng(encode(text, QR_OPTIONS).data, scale)
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set(new TextEncoder().encode(type), 4)
  chunk.set(data, 8)
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)))
  return chunk
}

async function encodeMonochromePng(modules: boolean[][], scale: number): Promise<Uint8Array> {
  const size = modules.length * scale
  const raw = new Uint8Array((size + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = modules[Math.floor(y / scale)]
    const offset = y * (size + 1)
    for (let x = 0; x < size; x++) raw[offset + 1 + x] = row[Math.floor(x / scale)] ? 0 : 255
  }
  const compressed = new Uint8Array(
    await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer(),
  )

  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, size)
  view.setUint32(4, size)
  header.set([8, 0, 0, 0, 0], 8)

  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array()),
  ]
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    png.set(part, offset)
    offset += part.length
  }
  return png
}
