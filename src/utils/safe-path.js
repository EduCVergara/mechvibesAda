'use strict';

const path = require('path');

function resolveInside(baseDirectory, relativePath) {
  if(typeof relativePath !== 'string' || relativePath.trim() === '' || relativePath.includes('\0')){
    throw new Error('Invalid empty path');
  }

  const segments = relativePath.split(/[\\/]/);
  if(segments.some((segment) => (
    segment === '' ||
    segment === '.' ||
    segment === '..' ||
    /[<>:"|?*]/.test(segment) ||
    /[. ]$/.test(segment)
  ))){
    throw new Error('Invalid path segment');
  }

  if(path.isAbsolute(relativePath)){
    throw new Error('Absolute paths are not allowed');
  }

  const base = path.resolve(baseDirectory);
  const target = path.resolve(base, relativePath);
  const relative = path.relative(base, target);

  if(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)){
    throw new Error('Path escapes the destination directory');
  }

  return target;
}

function validateFolderName(folderName) {
  if(typeof folderName !== 'string' || !/^[a-z0-9][a-z0-9._ -]*$/i.test(folderName)){
    throw new Error('Invalid sound pack folder');
  }

  if(
    folderName === '.' ||
    folderName === '..' ||
    /[. ]$/.test(folderName) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(folderName)
  ){
    throw new Error('Invalid sound pack folder');
  }

  return folderName;
}

module.exports = { resolveInside, validateFolderName };
