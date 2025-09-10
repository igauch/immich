import { Selectable } from 'kysely';
import { ApiProperty } from '@nestjs/swagger';
import { AssetFace, AssetFile, Exif, Stack, Tag, User } from 'src/database';
import { PropertyLifecycle } from 'src/decorators';
import { AuthDto } from 'src/dtos/auth.dto';
import { ExifResponseDto, mapExif } from 'src/dtos/exif.dto';
import {
  AssetFaceWithoutPersonResponseDto,
  PersonWithFacesResponseDto,
  mapFacesWithoutPerson,
  mapPerson,
} from 'src/dtos/person.dto';
import { TagResponseDto, mapTag } from 'src/dtos/tag.dto';
import { UserResponseDto, mapUser } from 'src/dtos/user.dto';
import { AssetStatus, AssetType, AssetVisibility } from 'src/enum';
import { hexOrBufferToBase64 } from 'src/utils/bytes';
import { mimeTypes } from 'src/utils/mime-types';
import { ensureAssetEncryptionFields } from 'src/utils/asset-utils';
import { ValidateEnum } from 'src/validation';

export class SanitizedAssetResponseDto {
  id!: string;
  @ValidateEnum({ enum: AssetType, name: 'AssetTypeEnum' })
  type!: AssetType;
  thumbhash!: string | null;
  originalMimeType?: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description:
      'The local date and time when the photo/video was taken, derived from EXIF metadata. This represents the photographer\'s local time regardless of timezone, stored as a timezone-agnostic timestamp. Used for timeline grouping by "local" days and months.',
    example: '2024-01-15T14:30:00.000Z',
  })
  localDateTime!: Date;
  duration!: string;
  livePhotoVideoId?: string | null;
  hasMetadata!: boolean;
}

export class AssetResponseDto extends SanitizedAssetResponseDto {
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description:
      'The UTC timestamp when the asset was originally uploaded to Immich.',
    example: '2024-01-15T20:30:00.000Z',
  })
  createdAt!: Date;
  deviceAssetId!: string;
  deviceId!: string;
  ownerId!: string;
  owner?: UserResponseDto;
  @PropertyLifecycle({ deprecatedAt: 'v1.106.0' })
  libraryId?: string | null;
  originalPath!: string;
  originalFileName!: string;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description:
      'The actual UTC timestamp when the file was created/captured, preserving timezone information. This is the authoritative timestamp for chronological sorting within timeline groups. Combined with timezone data, this can be used to determine the exact moment the photo was taken.',
    example: '2024-01-15T19:30:00.000Z',
  })
  fileCreatedAt!: Date;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description:
      'The UTC timestamp when the file was last modified on the filesystem. This reflects the last time the physical file was changed, which may be different from when the photo was originally taken.',
    example: '2024-01-16T10:15:00.000Z',
  })
  fileModifiedAt!: Date;
  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description:
      'The UTC timestamp when the asset record was last updated in the database. This is automatically maintained by the database and reflects when any field in the asset was last modified.',
    example: '2024-01-16T12:45:30.000Z',
  })
  updatedAt!: Date;
  isFavorite!: boolean;
  isArchived!: boolean;
  isTrashed!: boolean;
  isOffline!: boolean;
  @ValidateEnum({ enum: AssetVisibility, name: 'AssetVisibility' })
  visibility!: AssetVisibility;
  exifInfo?: ExifResponseDto;
  tags?: TagResponseDto[];
  people?: PersonWithFacesResponseDto[];
  unassignedFaces?: AssetFaceWithoutPersonResponseDto[];
  /**base64 encoded sha1 hash */
  checksum!: string;
  /**base64 encoded sha1 hash of file content */
  fileHash!: string;
  stack?: AssetStackResponseDto | null;
  duplicateId?: string | null;

  @PropertyLifecycle({ deprecatedAt: 'v1.113.0' })
  resized?: boolean;

  // 加密相关字段
  @ApiProperty({ type: Boolean, nullable: true })
  isEncrypted?: boolean;
  @ApiProperty({ type: String, nullable: true })
  encryptedPath?: string | null;
  @ApiProperty({ type: String, nullable: true })
  encryptionIv?: string | null;
  @ApiProperty({ type: String, nullable: true })
  encryptionSalt?: string | null;
}

export type MapAsset = {
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  id: string;
  updateId: string;
  status: AssetStatus;
  checksum: Buffer<ArrayBufferLike>;
  fileHash: Buffer<ArrayBufferLike>;
  deviceAssetId: string;
  deviceId: string;
  duplicateId: string | null;
  duration: string | null;
  encodedVideoPath: string | null;
  exifInfo?: Selectable<Exif> | null;
  faces?: AssetFace[];
  fileCreatedAt: Date;
  fileModifiedAt: Date;
  files?: AssetFile[];
  isExternal: boolean;
  isFavorite: boolean;
  isOffline: boolean;
  visibility: AssetVisibility;
  libraryId: string | null;
  livePhotoVideoId: string | null;
  localDateTime: Date;
  originalFileName: string;
  originalPath: string;
  owner?: User | null;
  ownerId: string;
  sidecarPath: string | null;
  stack?: Stack | null;
  stackId: string | null;
  tags?: Tag[];
  thumbhash: Buffer<ArrayBufferLike> | null;
  type: AssetType;
  // 加密相关字段
  isEncrypted?: boolean;
  encryptedPath?: string | null;
  encryptionIv?: string | null;
  encryptionSalt?: string | null;
};

export class AssetStackResponseDto {
  id!: string;

  primaryAssetId!: string;

  @ApiProperty({ type: 'integer' })
  assetCount!: number;
}

export type AssetMapOptions = {
  stripMetadata?: boolean;
  withStack?: boolean;
  auth?: AuthDto;
};

// TODO: this is inefficient
const peopleWithFaces = (faces?: AssetFace[]): PersonWithFacesResponseDto[] => {
  const result: PersonWithFacesResponseDto[] = [];
  if (faces) {
    for (const face of faces) {
      if (face.person) {
        const existingPersonEntry = result.find((item) => item.id === face.person!.id);
        if (existingPersonEntry) {
          existingPersonEntry.faces.push(face);
        } else {
          result.push({ ...mapPerson(face.person!), faces: [mapFacesWithoutPerson(face)] });
        }
      }
    }
  }

  return result;
};

const mapStack = (entity: { stack?: Stack | null }) => {
  if (!entity.stack) {
    return null;
  }

  return {
    id: entity.stack.id,
    primaryAssetId: entity.stack.primaryAssetId,
    assetCount: entity.stack.assetCount ?? entity.stack.assets.length + 1,
  };
};

export function mapAsset(entity: MapAsset, options: AssetMapOptions = {}): AssetResponseDto {
  const { stripMetadata = false, withStack = false } = options;
  
  // 确保资产对象包含加密相关字段
  const assetWithEncryption = ensureAssetEncryptionFields(entity);

  if (stripMetadata) {
    const sanitizedAssetResponse: SanitizedAssetResponseDto = {
      id: assetWithEncryption.id,
      type: assetWithEncryption.type,
      originalMimeType: mimeTypes.lookup(assetWithEncryption.originalFileName),
      thumbhash: assetWithEncryption.thumbhash ? hexOrBufferToBase64(assetWithEncryption.thumbhash) : null,
      localDateTime: assetWithEncryption.localDateTime,
      duration: assetWithEncryption.duration ?? '0:00:00.00000',
      livePhotoVideoId: assetWithEncryption.livePhotoVideoId,
      hasMetadata: false,
    };
    return sanitizedAssetResponse as AssetResponseDto;
  }

  return {
    id: assetWithEncryption.id,
    createdAt: assetWithEncryption.createdAt,
    deviceAssetId: assetWithEncryption.deviceAssetId,
    ownerId: assetWithEncryption.ownerId,
    owner: assetWithEncryption.owner ? mapUser(assetWithEncryption.owner) : undefined,
    deviceId: assetWithEncryption.deviceId,
    libraryId: assetWithEncryption.libraryId,
    type: assetWithEncryption.type,
    originalPath: assetWithEncryption.originalPath,
    originalFileName: assetWithEncryption.originalFileName,
    originalMimeType: mimeTypes.lookup(assetWithEncryption.originalFileName),
    thumbhash: assetWithEncryption.thumbhash ? hexOrBufferToBase64(assetWithEncryption.thumbhash) : null,
    fileCreatedAt: assetWithEncryption.fileCreatedAt,
    fileModifiedAt: assetWithEncryption.fileModifiedAt,
    localDateTime: assetWithEncryption.localDateTime,
    updatedAt: assetWithEncryption.updatedAt,
    isFavorite: options.auth?.user.id === assetWithEncryption.ownerId ? assetWithEncryption.isFavorite : false,
    isArchived: assetWithEncryption.visibility === AssetVisibility.Archive,
    isTrashed: !!assetWithEncryption.deletedAt,
    visibility: assetWithEncryption.visibility,
    duration: assetWithEncryption.duration ?? '0:00:00.00000',
    exifInfo: assetWithEncryption.exifInfo ? mapExif(assetWithEncryption.exifInfo) : undefined,
    livePhotoVideoId: assetWithEncryption.livePhotoVideoId,
    tags: assetWithEncryption.tags?.map((tag) => mapTag(tag)),
    people: peopleWithFaces(assetWithEncryption.faces),
    unassignedFaces: assetWithEncryption.faces?.filter((face) => !face.person).map((a) => mapFacesWithoutPerson(a)),
    checksum: hexOrBufferToBase64(assetWithEncryption.checksum)!, 
    fileHash: hexOrBufferToBase64(assetWithEncryption.fileHash)!, 
    stack: withStack ? mapStack(assetWithEncryption) : undefined,
    isOffline: assetWithEncryption.isOffline,
    hasMetadata: true,
    duplicateId: assetWithEncryption.duplicateId,
    resized: true,
    // 加密相关字段
    isEncrypted: assetWithEncryption.isEncrypted,
    encryptedPath: assetWithEncryption.encryptedPath,
    encryptionIv: assetWithEncryption.encryptionIv,
    encryptionSalt: assetWithEncryption.encryptionSalt,
  };
}
