import { execFileSync } from 'node:child_process'
import { platform } from 'node:os'

/**
 * Electron's Mach-O files carry linker signatures even when no signing
 * identity is available. Without signing the complete bundle, Gatekeeper can
 * report the downloaded application as damaged. Give development/community
 * builds a complete ad-hoc signature; electron-builder replaces it with the
 * configured Developer ID signature when release credentials are available.
 */
export default async function afterPack(context) {
  if (platform() !== 'darwin' || context.electronPlatformName !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit'
  })
}
