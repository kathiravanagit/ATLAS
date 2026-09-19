"use client"

import { GlobeCdn } from "./cobe-globe-cdn"

export default function GlobeCdnDemo() {
  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-white p-8 overflow-hidden">
      <div className="w-full max-w-lg">
        <GlobeCdn />
      </div>
    </div>
  )
}
