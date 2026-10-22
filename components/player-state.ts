import * as THREE from "three"

// Shared, ref-like player state written by the controller and read by the camera
export const playerPosition = new THREE.Vector3()

// Shooting trigger: the DOM crosshair increments this on a tap/click and the
// character reads it once per frame to fire. One-shots compare counts, so
// window-scope state avoids re-render plumbing.
export const shootRequests = { count: 0 }
