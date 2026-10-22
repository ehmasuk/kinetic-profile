import fs from "node:fs"
import path from "node:path"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis
const createElementNS = () => {
  const o = { width: 0, height: 0, onload: null }
  Object.defineProperty(o, "src", {
    set() {
      setTimeout(() => o.onload && o.onload(), 0)
    },
    get() {
      return ""
    },
  })
  return o
}
globalThis.document = {
  createElementNS,
  createElement: () => ({ getContext: () => null }),
}
globalThis.createImageBitmap = undefined
const realFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input.url ?? String(input)
  if (/^https?:/i.test(url)) return realFetch(url)
  if (/^data:/i.test(url)) {
    const comma = url.indexOf(",")
    return new Response(
      new Uint8Array(Buffer.from(url.slice(comma + 1), "base64"))
    )
  }
  const clean = url.split("?")[0].split("#")[0].split("\\").join("/")
  const buf = fs.readFileSync(
    path.join(process.cwd(), decodeURIComponent(clean))
  )
  return new Response(new Uint8Array(buf), { status: 200 })
}
class FakeProgressEvent {
  constructor(t, i) {
    this.type = t
    this.init = i
  }
}
globalThis.ProgressEvent = FakeProgressEvent

for (const file of process.argv.slice(2)) {
  const buffer = fs.readFileSync(file)
  const data = buffer.buffer
    .slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const gltf = await new Promise((res, rej) =>
    new GLTFLoader().parse(data, path.dirname(file) + "/", res, rej)
  )
  gltf.scene.updateMatrixWorld(true)
  const box = new THREE.Box3()
  gltf.scene.traverse((o) => {
    if (o.isMesh && o.geometry) box.expandByObject(o)
  })
  const center = box.getCenter(new THREE.Vector3())
  console.log(
    path.basename(file).padEnd(34),
    "origin->center x/z:",
    center.x.toFixed(2).padStart(7),
    center.z.toFixed(2).padStart(7)
  )
}
