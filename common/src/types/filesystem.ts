import type fs from 'fs'

/** File system used for Siya SDK.
 *
 * Compatible with `fs.promises` from the `'fs'` module.
 */
export type SiyaFileSystem = Pick<
  typeof fs.promises,
  'mkdir' | 'readdir' | 'readFile' | 'stat' | 'unlink' | 'writeFile'
>
