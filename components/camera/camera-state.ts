// Mutable camera orbit state shared between the follow camera (writer) and
// the player controls (reader) so input directions stay camera-relative.
export const cameraOrbit = {
  // Horizontal angle of the camera offset around the player, in radians.
  yaw: Math.atan2(10, 10.5),
}
