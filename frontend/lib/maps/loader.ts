function waitForGoogleMaps(): Promise<void> {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (typeof window !== 'undefined' && typeof window.google?.maps?.importLibrary === 'function') {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

export async function loadMaps3D(): Promise<{
  Map3DElement: typeof google.maps.maps3d.Map3DElement
}> {
  await waitForGoogleMaps()
  const lib = await google.maps.importLibrary('maps3d')
  return lib as unknown as { Map3DElement: typeof google.maps.maps3d.Map3DElement }
}

export async function loadStreetView(): Promise<{
  StreetViewPanorama: typeof google.maps.StreetViewPanorama
  StreetViewService: typeof google.maps.StreetViewService
  StreetViewStatus: typeof google.maps.StreetViewStatus
}> {
  await waitForGoogleMaps()
  const lib = await google.maps.importLibrary('streetView')
  return lib as unknown as {
    StreetViewPanorama: typeof google.maps.StreetViewPanorama
    StreetViewService: typeof google.maps.StreetViewService
    StreetViewStatus: typeof google.maps.StreetViewStatus
  }
}
