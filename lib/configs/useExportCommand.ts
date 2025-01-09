import fs from 'fs-extra'
import path from 'path'
import { getNextronConfig } from './getNextronConfig'
import * as logger from '../logger'

const cwd = process.cwd()
const pkgPath = path.join(cwd, 'package.json')
const nextConfigPathDir = path.join(
  cwd,
  getNextronConfig().rendererSrcDir || 'renderer'
)

export const findNextJsConfig = async (): Promise<string> => {
  const configExists = async (configFileName: string) =>
    await fs.pathExists(path.join(nextConfigPathDir, configFileName))

  const filePathToURL = (filePath: string) => {
    return new URL(`file:///${path.join(nextConfigPathDir, filePath)}`).href
  }

  // Priority for nextron config
  if (await configExists('next.config.nextron.js'))
    return filePathToURL('next.config.nextron.js')
  else if (await configExists('next.config.nextron.mjs'))
    return filePathToURL('next.config.nextron.mjs')
  else if (await configExists('next.config.nextron.cjs'))
    return filePathToURL('next.config.nextron.cjs')
  // Priority for electron config
  else if (await configExists('next.config.electron.js'))
    return filePathToURL('next.config.electron.js')
  else if (await configExists('next.config.electron.mjs'))
    return filePathToURL('next.config.electron.mjs')
  else if (await configExists('next.config.electron.cjs'))
    return filePathToURL('next.config.electron.cjs')
  // Default next.js config
  else if (await configExists('next.config.js'))
    return filePathToURL('next.config.js')
  else if (await configExists('next.config.mjs'))
    return filePathToURL('next.config.mjs')
  else if (await configExists('next.config.cjs'))
    return filePathToURL('next.config.cjs')
  // Fallback to next.config.js
  else return path.join(nextConfigPathDir, 'next.config.js')
}

type NextConfigBase = {
  output: 'server' | 'static' | 'serverless' | 'export'
  distDir: string
}

const importNextConfig = async (): Promise<NextConfigBase> => {
  const nectConfigURL = await findNextJsConfig()
  if (!nectConfigURL) {
    logger.error('next.config.js not found.')
    process.exit(1)
  }
  const fileName = new URL(nectConfigURL).pathname.split('/').pop()
  console.log(`✓  Using [${fileName}] as next.config file`)

  const cfg = await import(nectConfigURL)
  console.log('Next.Js Config: ', cfg.default as NextConfigBase)
  return cfg.default as NextConfigBase
}

export const useExportCommand = async (): Promise<boolean> => {
  const { dependencies, devDependencies } = await fs.readJSON(pkgPath)

  let nextVersion: string
  nextVersion = dependencies.next
  if (nextVersion) {
    logger.info(
      'To reduce the bundle size of the electron app, we recommend placing next and nextron in devDependencies instead of dependencies.'
    )
  }
  if (!nextVersion) {
    nextVersion = devDependencies.next
    if (!nextVersion) {
      logger.error('Next not found in both dependencies and devDependencies.')
      process.exit(1)
    }
  }

  const majorVersion = ~~nextVersion
    .split('.')
    .filter((v) => v.trim() !== '')[0]
    .replace('^', '')
    .replace('~', '')
  if (majorVersion < 13) {
    return true
  }
  if (majorVersion === 13) {
    const { output, distDir } = await importNextConfig()
    if (output === 'export') {
      if (distDir !== '../app') {
        logger.error(
          'Nextron export the build results to "app" directory, so please set "distDir" to "../app" in next.config.js.'
        )
        process.exit(1)
      }
      return false
    }
    return true
  }
  if (majorVersion > 13) {
    const { output, distDir } = await importNextConfig()
    if (output !== 'export') {
      logger.error(
        'We must export static files so as Electron can handle them. Please set next.config.js#output to "export".'
      )
      process.exit(1)
    }
    if (distDir !== '../app') {
      logger.error(
        'Nextron exports the build results to "app" directory, so please set "distDir" to "../app" in next.config.js.'
      )
      process.exit(1)
    }
    return false
  }

  logger.error('Unexpected error occerred')
  process.exit(1)
}
