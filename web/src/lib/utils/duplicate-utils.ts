import { getExifCount } from '$lib/utils/exif-utils';
import type { AssetResponseDto } from '@immich/sdk';
import { sortBy } from 'lodash-es';
import { getOldestDate } from '$lib/utils/asset-utils';

/**
 * Suggests the best duplicate asset to keep from a list of duplicates.
 *
 * The best asset is determined by the following criteria:
 *  - Largest image file size in bytes
 *  - Largest count of exif data
 *
 * @param assets List of duplicate assets
 * @returns The best asset to keep
 */
export const suggestDuplicate = (assets: AssetResponseDto[]): AssetResponseDto | undefined => {
  let duplicateAssets = sortBy(assets, (asset) => asset.exifInfo?.fileSizeInByte ?? 0);

  // Update the list to only include assets with the largest file size
  duplicateAssets = duplicateAssets.filter(
    (asset) => asset.exifInfo?.fileSizeInByte === duplicateAssets.at(-1)?.exifInfo?.fileSizeInByte,
  );

  // If there are multiple assets with the same file size, sort the list by the count of exif data
  if (duplicateAssets.length >= 2) {
    duplicateAssets = sortBy(duplicateAssets, getExifCount);
  }
  const o = duplicateAssets.at(-1);
  duplicateAssets = sortBy(duplicateAssets, getOldestDate)
  if (getOldestDate(o!) !== getOldestDate(duplicateAssets.at(0)!)) {
    console.error('gauch', o!.originalPath);
    return duplicateAssets.at(0);
  }
  // Return the last asset in the list
  return o;
};
