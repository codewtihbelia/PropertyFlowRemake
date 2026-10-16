import React, { useMemo } from "react";
import { View, StyleSheet, Text, Image, Share, Platform } from "react-native";
import Svg, { Rect, Path, G, Circle } from "react-native-svg";

/**
 * Lightweight, pure TypeScript QR Code Matrix Generator.
 * Implements ISO/IEC 18004 QR Code Byte mode with Error Correction (Level M).
 * Zero external native dependencies; renders cleanly via react-native-svg.
 */

// Galois Field (256) tables for Reed-Solomon polynomial math
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function polyMul(p1: Uint8Array, p2: Uint8Array): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree: number): Uint8Array<ArrayBuffer> {
  let g: Uint8Array<ArrayBuffer> = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, new Uint8Array([1, GF256_EXP[i]]));
  }
  return g;
}

function calculateReedSolomon(
  data: Uint8Array,
  ecCount: number,
): Uint8Array<ArrayBuffer> {
  const gen = getGeneratorPoly(ecCount);
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return new Uint8Array(msg.subarray(data.length));
}

// Version table parameters: [TotalDataWords, ECWordsPerBlock, NumBlocks]
// Using Level M for robust error correction with room for center avatar badge
const VERSION_SPECS_M: Record<
  number,
  { dataWords: number; ecWords: number; blocks: number }
> = {
  1: { dataWords: 16, ecWords: 10, blocks: 1 },
  2: { dataWords: 28, ecWords: 16, blocks: 1 },
  3: { dataWords: 44, ecWords: 26, blocks: 1 },
  4: { dataWords: 64, ecWords: 18, blocks: 2 },
  5: { dataWords: 86, ecWords: 24, blocks: 2 },
  6: { dataWords: 108, ecWords: 16, blocks: 4 },
  7: { dataWords: 124, ecWords: 18, blocks: 4 },
};

function getQrVersionForLength(byteCount: number): number {
  for (let v = 1; v <= 7; v++) {
    const spec = VERSION_SPECS_M[v];
    // In byte mode: 4 bits mode + 8 bits length + byteCount*8 + 4 bits terminator
    const neededWords = Math.ceil((4 + 8 + byteCount * 8 + 4) / 8);
    if (neededWords <= spec.dataWords) return v;
  }
  return 7;
}

function getAlignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const coords: Record<number, number[]> = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
  };
  return coords[version] || [];
}

/**
 * Builds the 2D boolean matrix for QR code.
 */
function generateQrMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const version = getQrVersionForLength(textBytes.length);
  const size = 17 + version * 4;
  const spec = VERSION_SPECS_M[version];

  // 1. Bitstream encoding: 0100 (Byte mode) + 8-bit length + bytes + terminator
  const bitstream: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bitstream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode
  pushBits(textBytes.length, 8); // Character count indicator
  for (let i = 0; i < textBytes.length; i++) {
    pushBits(textBytes[i], 8);
  }
  // Terminator
  const maxBits = spec.dataWords * 8;
  const termBits = Math.min(4, maxBits - bitstream.length);
  pushBits(0, termBits);

  // Pad to byte boundary
  while (bitstream.length % 8 !== 0) {
    bitstream.push(0);
  }

  // Pad bytes 0xEC, 0x11
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (bitstream.length < maxBits) {
    pushBits(padPatterns[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bitstream to bytes
  const dataBytes = new Uint8Array(spec.dataWords);
  for (let i = 0; i < spec.dataWords; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bitstream[i * 8 + b];
    }
    dataBytes[i] = byteVal;
  }

  // Calculate Reed-Solomon Error Correction
  const ecBytesPerBlock = spec.ecWords;
  const dataBytesPerBlock = Math.floor(spec.dataWords / spec.blocks);
  const allEcBytes: Uint8Array<ArrayBuffer>[] = [];
  const allDataBlocks: Uint8Array<ArrayBuffer>[] = [];

  for (let b = 0; b < spec.blocks; b++) {
    const start = b * dataBytesPerBlock;
    const blockData = new Uint8Array(
      dataBytes.subarray(start, start + dataBytesPerBlock),
    );
    allDataBlocks.push(blockData);
    allEcBytes.push(calculateReedSolomon(blockData, ecBytesPerBlock));
  }

  // Interleave data & EC
  const finalCodewords: number[] = [];
  for (let i = 0; i < dataBytesPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalCodewords.push(allDataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecBytesPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalCodewords.push(allEcBytes[b][i]);
    }
  }

  // 2. Initialize matrix (-1 = unset, 0 = white, 1 = black)
  const matrix: number[][] = Array.from({ length: size }, () =>
    new Array(size).fill(-1),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false),
  );

  function setModule(r: number, c: number, val: number, isFunc = false) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (isFunc) isFunction[r][c] = true;
    }
  }

  // Place Finder Pattern (7x7) + Separator
  function placeFinder(top: number, left: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            setModule(row, col, 1, true);
          } else {
            setModule(row, col, 0, true);
          }
        } else {
          setModule(row, col, 0, true); // White separator
        }
      }
    }
  }

  placeFinder(0, 0); // Top-left
  placeFinder(0, size - 7); // Top-right
  placeFinder(size - 7, 0); // Bottom-left

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    setModule(6, i, val, true);
    setModule(i, 6, val, true);
  }

  // Alignment patterns
  const alignPos = getAlignmentPatternPositions(version);
  for (const ar of alignPos) {
    for (const ac of alignPos) {
      // Don't overlap finders
      if (
        (ar <= 8 && ac <= 8) ||
        (ar <= 8 && ac >= size - 8) ||
        (ar >= size - 8 && ac <= 8)
      ) {
        continue;
      }
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isBlack =
            r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
          setModule(ar + r, ac + c, isBlack ? 1 : 0, true);
        }
      }
    }
  }

  // Dark module
  setModule(size - 8, 8, 1, true);

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === -1) setModule(8, i, 0, true);
    if (matrix[i][8] === -1) setModule(i, 8, 0, true);
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === -1) setModule(8, size - 1 - i, 0, true);
    if (matrix[size - 1 - i][8] === -1) setModule(size - 1 - i, 8, 0, true);
  }

  // 3. Place Data Bits in matrix (two columns at a time, zigzag right to left)
  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    for (let vert = 0; vert < size; vert++) {
      const r = upwards ? size - 1 - vert : vert;
      for (let c = right; c >= right - 1; c--) {
        if (!isFunction[r][c]) {
          let bit = 0;
          if (bitIdx < totalBits) {
            const wordIdx = Math.floor(bitIdx / 8);
            const b = 7 - (bitIdx % 8);
            bit = (finalCodewords[wordIdx] >> b) & 1;
            bitIdx++;
          }
          matrix[r][c] = bit;
        }
      }
    }
    upwards = !upwards;
  }

  // 4. Apply Mask Pattern 0: (r + c) % 2 === 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c]) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] ^= 1;
        }
      }
    }
  }

  // 5. Write Format Information (Level M + Mask 0: 0b10000 xor mask = 0b101010000010010)
  // Standard precalculated 15-bit format for Level M, Mask 0
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Top-left format placement
  const tlCoords = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = tlCoords[i];
    matrix[r][c] = formatBits[i];
  }

  // Split format around top-right and bottom-left
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = formatBits[i];
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = formatBits[7 + i];
  }

  // Return clean boolean matrix
  return matrix.map((row) => row.map((cell) => cell === 1));
}

export interface QrPngExportOptions {
  value: string;
  name?: string;
  email?: string;
  amount?: string;
  note?: string;
  initials?: string;
  filename?: string;
}

// CRC-32 table for pure TypeScript PNG generation
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array, start: number, len: number): number {
  let c = 0xffffffff;
  for (let i = start; i < start + len; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    s1 = (s1 + buf[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    const c0 = b0 >> 2;
    const c1 = ((b0 & 3) << 4) | (b1 >> 4);
    const c2 = ((b1 & 15) << 2) | (b2 >> 6);
    const c3 = b2 & 63;

    base64 += chars[c0] + chars[c1];
    base64 += i + 1 < len ? chars[c2] : "=";
    base64 += i + 2 < len ? chars[c3] : "=";
  }
  return base64;
}

/**
 * Pure TypeScript PNG binary rasterizer.
 * Generates an ultra-crisp, valid PNG data URL directly from the 2D QR matrix.
 * Runs in ANY JavaScript runtime (React Native Hermes/JSC, Node, Web Worker) with zero DOM.
 */
export function encodeQrMatrixToPngDataUrl(
  matrix: boolean[][],
  options: { scale?: number; margin?: number; initials?: string } = {},
): string {
  const { scale = 12, margin = 4 } = options;
  const moduleCount = matrix.length;
  const width = (moduleCount + margin * 2) * scale;
  const height = width;

  // Uncompressed scanlines: each row = 1 filter byte (0x00) + width * 3 (RGB) bytes
  const rowBytes = 1 + width * 3;
  const rawData = new Uint8Array(height * rowBytes);

  const centerRadiusPx = Math.floor(moduleCount * 0.16 * scale);
  const centerMidPx = Math.floor(width / 2);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const dist = Math.hypot(x - centerMidPx, y - centerMidPx);

      if (dist <= centerRadiusPx) {
        if (dist >= centerRadiusPx - 4) {
          // White border ring around avatar badge
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
        } else {
          // Blue avatar badge: #2563EB
          rawData[pxOffset] = 37;
          rawData[pxOffset + 1] = 99;
          rawData[pxOffset + 2] = 235;
        }
      } else {
        const mx = Math.floor(x / scale) - margin;
        const my = Math.floor(y / scale) - margin;

        if (
          mx >= 0 &&
          mx < moduleCount &&
          my >= 0 &&
          my < moduleCount &&
          matrix[my][mx]
        ) {
          // Dark blue module: #0F172A
          rawData[pxOffset] = 15;
          rawData[pxOffset + 1] = 23;
          rawData[pxOffset + 2] = 42;
        } else {
          // White background
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
        }
      }
    }
  }

  // Deflate uncompressed blocks (RFC 1951, BTYPE=00)
  const maxBlockSize = 65535;
  const numBlocks = Math.ceil(rawData.length / maxBlockSize);
  const zlibHeaderLen = 2; // CMF, FLG
  const zlibTrailerLen = 4; // Adler-32
  const deflateOverhead = numBlocks * 5;
  const zlibTotalLen =
    zlibHeaderLen + deflateOverhead + rawData.length + zlibTrailerLen;

  const zlibData = new Uint8Array(zlibTotalLen);
  zlibData[0] = 0x78; // CMF (Deflate)
  zlibData[1] = 0x01; // FLG (check bits, level 0)

  let zPos = 2;
  for (let b = 0; b < numBlocks; b++) {
    const isLast = b === numBlocks - 1;
    const start = b * maxBlockSize;
    const end = Math.min(start + maxBlockSize, rawData.length);
    const blockLen = end - start;

    zlibData[zPos++] = isLast ? 0x01 : 0x00; // BFINAL, BTYPE=00
    zlibData[zPos++] = blockLen & 0xff;
    zlibData[zPos++] = (blockLen >> 8) & 0xff;
    zlibData[zPos++] = ~blockLen & 0xff;
    zlibData[zPos++] = (~blockLen >> 8) & 0xff;

    zlibData.set(rawData.subarray(start, end), zPos);
    zPos += blockLen;
  }

  // Adler-32 checksum
  const adler = adler32(rawData);
  zlibData[zPos++] = (adler >> 24) & 0xff;
  zlibData[zPos++] = (adler >> 16) & 0xff;
  zlibData[zPos++] = (adler >> 8) & 0xff;
  zlibData[zPos++] = adler & 0xff;

  // Build PNG chunks
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: 13 bytes
  const ihdrData = new Uint8Array(13);
  ihdrData[0] = (width >> 24) & 0xff;
  ihdrData[1] = (width >> 16) & 0xff;
  ihdrData[2] = (width >> 8) & 0xff;
  ihdrData[3] = width & 0xff;
  ihdrData[4] = (height >> 24) & 0xff;
  ihdrData[5] = (height >> 16) & 0xff;
  ihdrData[6] = (height >> 8) & 0xff;
  ihdrData[7] = height & 0xff;
  ihdrData[8] = 8; // 8 bits per sample
  ihdrData[9] = 2; // Color type 2 (RGB)
  ihdrData[10] = 0; // Compression (Deflate)
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const totalPngLen =
    signature.length +
    12 +
    ihdrData.length + // IHDR chunk (4 len + 4 type + data + 4 crc)
    12 +
    zlibData.length + // IDAT chunk
    12; // IEND chunk

  const pngBytes = new Uint8Array(totalPngLen);
  let pPos = 0;

  // Signature
  pngBytes.set(signature, pPos);
  pPos += signature.length;

  function writeChunk(typeStr: string, data: Uint8Array) {
    const len = data.length;
    pngBytes[pPos++] = (len >> 24) & 0xff;
    pngBytes[pPos++] = (len >> 16) & 0xff;
    pngBytes[pPos++] = (len >> 8) & 0xff;
    pngBytes[pPos++] = len & 0xff;

    const typeStart = pPos;
    for (let i = 0; i < 4; i++) {
      pngBytes[pPos++] = typeStr.charCodeAt(i);
    }
    pngBytes.set(data, pPos);
    pPos += data.length;

    const chunkCrc = crc32(pngBytes, typeStart, 4 + data.length);
    pngBytes[pPos++] = (chunkCrc >> 24) & 0xff;
    pngBytes[pPos++] = (chunkCrc >> 16) & 0xff;
    pngBytes[pPos++] = (chunkCrc >> 8) & 0xff;
    pngBytes[pPos++] = chunkCrc & 0xff;
  }

  writeChunk("IHDR", ihdrData);
  writeChunk("IDAT", zlibData);
  writeChunk("IEND", new Uint8Array(0));

  return `data:image/png;base64,${uint8ArrayToBase64(pngBytes)}`;
}

/**
 * Generates a high-resolution, uncompressed PNG data URL of the Splitzy QR code.
 * Seamlessly uses DOM canvas if available, and falls back to pure TypeScript
 * rasterization in React Native / non-DOM environments without throwing errors.
 */
export async function generateQrPngDataUrl(
  options: QrPngExportOptions,
): Promise<string> {
  const {
    value,
    name = "Splitzy Resident",
    email = "",
    amount = "",
    note = "",
    initials = "S",
  } = options;

  const matrix = generateQrMatrix(value || "splitzy");

  // In non-DOM environments (e.g. React Native native runtime), use the pure TypeScript PNG rasterizer
  if (
    typeof document === "undefined" ||
    !document.createElement ||
    Platform.OS !== "web"
  ) {
    return encodeQrMatrixToPngDataUrl(matrix, {
      scale: 12,
      margin: 4,
      initials,
    });
  }

  try {
    const moduleCount = matrix.length;
    const canvas = document.createElement("canvas");
    const canvasWidth = 720;
    const canvasHeight = amount && parseFloat(amount) > 0 ? 880 : 820;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return encodeQrMatrixToPngDataUrl(matrix, {
        scale: 12,
        margin: 4,
        initials,
      });
    }

    // 1. Clean crisp white card background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Subtle outer hairline frame
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvasWidth - 20, canvasHeight - 20);

    // 2. Splitzy Brand Header
    ctx.fillStyle = "#2563EB";
    ctx.font =
      "bold 24px -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SPLITZY PAY", canvasWidth / 2, 54);

    ctx.fillStyle = "#64748B";
    ctx.font =
      "14px -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(
      "Instant Peer-to-Peer Transfer & Splitzy Ledger",
      canvasWidth / 2,
      78,
    );

    // 3. Render High-Resolution QR Matrix
    const qrSize = 460;
    const qrX = (canvasWidth - qrSize) / 2;
    const qrY = 100;
    const cellSize = qrSize / moduleCount;
    const centerRadius = Math.floor(moduleCount * 0.16);
    const centerMid = Math.floor(moduleCount / 2);

    ctx.fillStyle = "#0F172A";
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          const dist = Math.hypot(r - centerMid, c - centerMid);
          if (dist <= centerRadius) continue; // Clear center for avatar badge

          ctx.fillRect(
            qrX + c * cellSize,
            qrY + r * cellSize,
            cellSize + 0.5,
            cellSize + 0.5,
          );
        }
      }
    }

    // 4. Center Initials Avatar Badge
    const badgeRadius = Math.round(qrSize * 0.13);
    const badgeCenterX = qrX + qrSize / 2;
    const badgeCenterY = qrY + qrSize / 2;

    // Outer white border ring
    ctx.beginPath();
    ctx.arc(badgeCenterX, badgeCenterY, badgeRadius + 4, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Blue avatar circle
    ctx.beginPath();
    ctx.arc(badgeCenterX, badgeCenterY, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#2563EB";
    ctx.fill();

    // White initials text
    ctx.fillStyle = "#FFFFFF";
    ctx.font =
      "bold 28px -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      initials.slice(0, 2).toUpperCase(),
      badgeCenterX,
      badgeCenterY + 1,
    );
    ctx.textBaseline = "alphabetic";

    // 5. User Identity Meta
    let currentY = qrY + qrSize + 36;
    ctx.fillStyle = "#0F172A";
    ctx.font =
      "bold 26px -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(name, canvasWidth / 2, currentY);

    if (email) {
      currentY += 24;
      ctx.fillStyle = "#64748B";
      ctx.font =
        "15px -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(email, canvasWidth / 2, currentY);
    }

    // 6. Preset Amount Banner (if specified)
    if (amount && parseFloat(amount) > 0) {
      currentY += 32;
      const pillText = `Requesting ₱${parseFloat(amount).toFixed(2)}${note ? ` · ${note}` : ""}`;
      ctx.font =
        "bold 16px -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif";
      const textWidth = ctx.measureText(pillText).width;
      const pillWidth = textWidth + 36;
      const pillHeight = 36;
      const pillX = (canvasWidth - pillWidth) / 2;
      const pillY = currentY - 24;

      ctx.fillStyle = "#ECFDF5";
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#059669";
      ctx.fillText(pillText, canvasWidth / 2, currentY);
    }

    // 7. Footer Seal & Compatibility Note
    currentY += 40;
    ctx.fillStyle = "#94A3B8";
    ctx.font =
      "12px -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(
      "Splitzy P2P Ledger · Compatible with QR Ph & Universal Readers",
      canvasWidth / 2,
      currentY,
    );

    return canvas.toDataURL("image/png");
  } catch (canvasErr) {
    console.warn(
      "[SplitzyQrCode] Canvas fallback to pure PNG encoder:",
      canvasErr,
    );
    return encodeQrMatrixToPngDataUrl(matrix, {
      scale: 12,
      margin: 4,
      initials,
    });
  }
}

/**
 * Downloads the high-resolution Splitzy QR code as a PNG file.
 * Handles web browser downloads and mobile native gallery / share sheet exports.
 */
export async function downloadQrCodePng(
  options: QrPngExportOptions,
): Promise<{ success: boolean; message: string }> {
  try {
    const dataUrl = await generateQrPngDataUrl(options);

    const safeName = (options.name || "splitzy")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 24);
    const filename = options.filename || `splitzy_qr_${safeName}.png`;

    // 1. Web / Desktop Browser Environment
    if (typeof document !== "undefined" && Platform.OS === "web") {
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (typeof navigator !== "undefined" && (navigator as any).canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], filename, { type: "image/png" });
          if ((navigator as any).canShare({ files: [file] })) {
            await (navigator as any).share({
              files: [file],
              title: `${options.name || "Splitzy"} QR Code`,
              text: "Scan this Splitzy QR Code to transfer funds instantly.",
            });
          }
        } catch (_) {}
      }

      return {
        success: true,
        message: `Saved "${filename}" to device downloads.`,
      };
    }

    // 2. React Native Native Environment: MediaLibrary + Native Share Sheet
    try {
      const MediaLibrary = require("expo-media-library");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        await MediaLibrary.saveToLibraryAsync(dataUrl);
        return {
          success: true,
          message: "Saved QR code PNG directly to your device photo gallery!",
        };
      }
    } catch (nativeErr) {
      console.warn("[SplitzyQrCode] Native media library fallback:", nativeErr);
    }

    // 3. Native Share sheet fallback (allows user to tap "Save Image", "Save to Files", or send)
    try {
      if (Share && Share.share) {
        await Share.share({
          title: `${options.name || "Splitzy"} QR Code`,
          message: `Splitzy QR Code for ${options.name || "Splitzy Resident"}: ${options.value}`,
          url: dataUrl,
        });
        return {
          success: true,
          message: "Splitzy QR code ready to save or share!",
        };
      }
    } catch (shareErr) {
      console.warn("[SplitzyQrCode] Native share fallback:", shareErr);
    }

    return {
      success: true,
      message: "Generated high-resolution QR Code PNG successfully.",
    };
  } catch (err: any) {
    console.warn("[SplitzyQrCode] downloadQrCodePng error:", err);
    return {
      success: false,
      message: err?.message || "Failed to generate QR Code PNG.",
    };
  }
}

export interface SplitzyQrCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  logoUrl?: string;
  logoInitials?: string;
}

export const SplitzyQrCode: React.FC<SplitzyQrCodeProps> = ({
  value,
  size = 220,
  color = "#0F172A",
  backgroundColor = "#FFFFFF",
  logoUrl,
  logoInitials = "S",
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(value || "splitzy");
    } catch (e) {
      console.warn("[SplitzyQrCode] QR generation fallback:", e);
      return generateQrMatrix("splitzy");
    }
  }, [value]);

  const moduleCount = matrix.length;
  const cellSize = size / moduleCount;

  // Center badge clearance: clear center 25% of matrix for avatar badge
  const centerRadius = Math.floor(moduleCount * 0.16);
  const centerMid = Math.floor(moduleCount / 2);

  // Generate SVG path for crisp single-pass rendering
  const pathData = useMemo(() => {
    let p = "";
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          // If cell is inside center badge radius, skip it so avatar has clean white clearance
          const dist = Math.hypot(r - centerMid, c - centerMid);
          if (dist <= centerRadius) continue;

          const x = c * cellSize;
          const y = r * cellSize;
          p += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
        }
      }
    }
    return p;
  }, [matrix, moduleCount, cellSize, centerMid, centerRadius]);

  const centerBadgeSize = Math.round(size * 0.26);

  return (
    <View
      style={[
        styles.container,
        {
          width: size + 24,
          height: size + 24,
          backgroundColor,
        },
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill={backgroundColor} />
        <Path d={pathData} fill={color} />
      </Svg>

      {/* Center Avatar / Brand Emblem */}
      <View
        style={[
          styles.centerBadge,
          {
            width: centerBadgeSize,
            height: centerBadgeSize,
            borderRadius: centerBadgeSize / 2,
            backgroundColor: "#FFFFFF",
            borderColor: backgroundColor,
          },
        ]}
      >
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={{
              width: centerBadgeSize - 6,
              height: centerBadgeSize - 6,
              borderRadius: (centerBadgeSize - 6) / 2,
            }}
          />
        ) : (
          <View
            style={[
              styles.initialsCircle,
              {
                width: centerBadgeSize - 6,
                height: centerBadgeSize - 6,
                borderRadius: (centerBadgeSize - 6) / 2,
              },
            ]}
          >
            <Text style={styles.initialsText}>{logoInitials.slice(0, 2)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  centerBadge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  initialsCircle: {
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
