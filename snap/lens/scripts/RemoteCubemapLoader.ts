/**
 * RemoteCubemapLoader.ts — Ayana Teleport Me Lens
 *
 * Handles downloading the city's cubemap texture at runtime via
 * Snap's Remote Assets system and applying it to the skybox material.
 *
 * USAGE:
 *  - Add this script to the AyanaController SceneObject alongside TeleportLens.ts
 *  - Wire the skyboxMaterial @input to the Look Around sphere material
 *  - Upload your cubemap PNGs via Lens Studio > Asset Browser > right-click > Upload to Remote Assets
 *  - Copy the resulting RemoteReferenceAsset into the remoteAsset @input
 *
 * NOTE: For a hackathon build, you can skip this and bake the cubemap
 * directly into the lens (simpler, no loading screen needed).
 * Use this only if you want one lens that switches between cities
 * or if cubemaps are too large to bundle.
 */

@component
export class RemoteCubemapLoader extends BaseScriptComponent {

  /** Remote Reference Asset created in Lens Studio for this city's cubemap */
  @input('Asset.RemoteReferenceAsset')
  remoteAsset!: RemoteReferenceAsset

  /** Material on the 360° sphere — its texture will be replaced on load */
  @input('Asset.Material')
  skyboxMaterial!: Material

  /** Loading overlay to hide once asset is ready */
  @input
  loadingOverlay!: SceneObject

  onAwake(): void {
    if (!this.remoteAsset) {
      print('[RemoteCubemapLoader] No remote asset set — using baked cubemap')
      this.hideLoading()
      return
    }

    this.downloadCubemap()
  }

  private downloadCubemap(): void {
    print('[RemoteCubemapLoader] Downloading cubemap...')

    this.remoteAsset.downloadAsset(
      (asset: Asset) => {
        print('[RemoteCubemapLoader] Cubemap downloaded successfully')
        this.applyCubemap(asset as Texture)
        this.hideLoading()
      },
      () => {
        print('[RemoteCubemapLoader] Cubemap download failed — using baked fallback')
        this.hideLoading()
      }
    )
  }

  private applyCubemap(texture: Texture): void {
    if (!this.skyboxMaterial) return

    const pass = this.skyboxMaterial.getPass(0)
    if (pass) {
      // Apply to the main texture slot of the skybox material
      pass.baseTex = texture
      print('[RemoteCubemapLoader] Cubemap applied to skybox material')
    }
  }

  private hideLoading(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.enabled = false
    }
  }
}
