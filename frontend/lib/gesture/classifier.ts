/**
 * Rule-based gesture classifier.
 *
 * Uses MediaPipe HandLandmarker landmark indices:
 *   0: wrist
 *   4: thumb tip   |  3: thumb ip    |  2: thumb mcp
 *   8: index tip   |  7: index dip   |  6: index pip   |  5: index mcp
 *  12: middle tip  | 11: middle dip  | 10: middle pip  |  9: middle mcp
 *  16: ring tip    | 15: ring dip    | 14: ring pip    | 13: ring mcp
 *  20: pinky tip   | 19: pinky dip   | 18: pinky pip   | 17: pinky mcp
 *
 * Gesture IDs match keypoint_classifier_label.csv:
 *   0 Open  1 Close  2 Pointer  3 OK  4 Horn  5 ThumbsUp  6 Victory  7 Duck  8 Drag
 */

export interface Landmark { x: number; y: number; z: number }

// Returns true when a finger tip is "extended" (above its PIP in screen Y).
// In normalised coordinates y=0 is TOP of frame, y=1 is BOTTOM.
// An extended finger has its tip ABOVE (lower y) its PIP joint.
function isExtended(lm: Landmark[], tipIdx: number, pipIdx: number): boolean {
  return lm[tipIdx].y < lm[pipIdx].y
}

function dist2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Approximate hand size = wrist to middle MCP */
function handSize(lm: Landmark[]): number {
  return Math.max(dist2D(lm[0], lm[9]), 0.01)
}

/**
 * Classify a hand into one of the 9 Gesturize IDs.
 * Returns -1 when no confident match.
 */
export function classifyGesture(lm: Landmark[]): number {
  if (lm.length < 21) return -1

  const size = handSize(lm)

  const indexExt  = isExtended(lm, 8,  6)
  const middleExt = isExtended(lm, 12, 10)
  const ringExt   = isExtended(lm, 16, 14)
  const pinkyExt  = isExtended(lm, 20, 18)

  // Close / Fist — all four fingers curled
  if (!indexExt && !middleExt && !ringExt && !pinkyExt) return 1

  // Horn — index + pinky extended, middle + ring curled
  if (indexExt && !middleExt && !ringExt && pinkyExt) return 4

  // OK — thumb tip close to index tip, middle+ring+pinky extended
  const thumbIndexDist = dist2D(lm[4], lm[8])
  if (thumbIndexDist / size < 0.35 && middleExt && ringExt && pinkyExt) return 3

  // Pointer — only index extended
  if (indexExt && !middleExt && !ringExt && !pinkyExt) return 2

  // Victory / Peace — index + middle extended
  if (indexExt && middleExt && !ringExt && !pinkyExt) return 6

  // Thumbs Up — thumb extended, fingers curled
  // Thumb tip above wrist, fingers all closed
  if (!indexExt && !middleExt && !ringExt && !pinkyExt && lm[4].y < lm[0].y) return 5

  // Open — all fingers extended
  if (indexExt && middleExt && ringExt && pinkyExt) return 0

  return -1
}
