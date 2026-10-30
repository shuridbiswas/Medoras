import { crc32, deflateSync } from "node:zlib";

/**
 * Tiny PNG encoder (8-bit RGB) so the seed tool can create valid placeholder images without any
 * dependency. Avatars are a silhouette on a brand-colour background, covers are diagonal bands.
 * Neither contains text or any real person's likeness.
 */

type Rgb = [number, number, number];

export const PALETTE: Rgb[] = [
  [122, 31, 53],
  [148, 48, 72],
  [96, 24, 45],
  [170, 80, 100],
  [74, 20, 38],
  [196, 120, 134],
];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

export function encodePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Rgb,
): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  // compression, filter and interlace bytes stay 0

  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function avatarPng(colorIndex: number, size = 256): Buffer {
  const bg = PALETTE[colorIndex % PALETTE.length];
  const fg = mix(bg, [255, 255, 255], 0.78);
  const cx = size / 2;
  return encodePng(size, size, (x, y) => {
    const head = (x - cx) ** 2 + (y - size * 0.38) ** 2 <= (size * 0.17) ** 2;
    const body =
      ((x - cx) / (size * 0.34)) ** 2 + ((y - size * 0.96) / (size * 0.3)) ** 2 <= 1;
    return head || body ? fg : bg;
  });
}

export function coverPng(colorIndex: number, width = 1200, height = 300): Buffer {
  const a = PALETTE[colorIndex % PALETTE.length];
  const b = PALETTE[(colorIndex + 2) % PALETTE.length];
  const c = mix(a, [255, 255, 255], 0.55);
  return encodePng(width, height, (x, y) => {
    const band = Math.floor((x + y * 0.5) / 90) % 3;
    return band === 0 ? a : band === 1 ? b : c;
  });
}
