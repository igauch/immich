/**
 * 为资产对象添加缺失的加密相关字段
 * @param asset 资产对象
 * @returns 添加了加密字段的资产对象
 */
export function ensureAssetEncryptionFields<T extends Record<string, any>>(asset: T): T & {
  isEncrypted: boolean;
  encryptedPath: string | null;
  encryptionIv: string | null;
  encryptionSalt: string | null;
} {
  return {
    ...asset,
    isEncrypted: asset.isEncrypted ?? false,
    encryptedPath: asset.encryptedPath ?? null,
    encryptionIv: asset.encryptionIv ?? null,
    encryptionSalt: asset.encryptionSalt ?? null,
  };
}