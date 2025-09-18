import { createReadStream, createWriteStream } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream';
import { join } from 'node:path';
import { StorageCore } from 'src/cores/storage.core';
import { StorageFolder } from 'src/enum';
import { Injectable } from '@nestjs/common';

const pipelineAsync = promisify(pipeline);

@Injectable()
export class EncryptionRepository {
  private readonly ENCRYPTED_FOLDER = 'encrypted';
  private readonly IV_LENGTH = 16; // AES block size is 16 bytes
  private readonly SALT_LENGTH = 32;
  private readonly KEY_LENGTH = 32; // AES-256 key length

  constructor(
    private readonly storageCore: StorageCore,
  ) {}

  /**
   * 生成加密密钥
   * @param password 用户密码
   * @param salt 盐值，如果不提供则生成新的
   * @returns 包含密钥和盐值的对象
   */
  private generateKey(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
    if (!salt) {
      salt = randomBytes(this.SALT_LENGTH);
    }
    const key = scryptSync(password, salt, this.KEY_LENGTH);
    return { key, salt };
  }

  /**
   * 获取加密文件的存储路径
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 加密文件的完整路径
   */
  getEncryptedFilePath(userId: string, filename: string): string {
    const baseFolder = StorageCore.getBaseFolder(StorageFolder.Library);
    const encryptedFolder = join(baseFolder, userId, this.ENCRYPTED_FOLDER);

    // 确保文件夹存在
    this.storageCore.ensureFolders(join(encryptedFolder, filename));

    return join(encryptedFolder, filename);
  }

  /**
   * 加密文件
   * @param inputPath 输入文件路径
   * @param outputPath 输出文件路径
   * @param password 加密密码
   * @returns 包含加密信息的对象，包括初始化向量和盐值
   */
  async encryptFile(inputPath: string, outputPath: string, password: string): Promise<{
    iv: string;
    salt: string;
    encryptedPath: string;
  }> {
    // 生成密钥和初始化向量
    const iv = randomBytes(this.IV_LENGTH);
    const { key, salt } = this.generateKey(password);

    // 创建加密流
    const cipher = createCipheriv('aes-256-cbc', key, iv);

    // 确保输出文件夹存在
    this.storageCore.ensureFolders(outputPath);

    // 执行加密
    await pipelineAsync(
      createReadStream(inputPath),
      cipher,
      createWriteStream(outputPath)
    );

    // 返回加密信息
    return {
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      encryptedPath: outputPath
    };
  }

  /**
   * 解密文件
   * @param inputPath 加密文件路径
   * @param outputPath 解密后的文件路径
   * @param password 解密密码
   * @param iv 初始化向量（十六进制字符串）
   * @param salt 盐值（十六进制字符串）
   */
  async decryptFile(inputPath: string, outputPath: string, password: string, iv: string, salt: string): Promise<void> {
    // 转换初始化向量和盐值从十六进制字符串到Buffer
    const ivBuffer = Buffer.from(iv, 'hex');
    const saltBuffer = Buffer.from(salt, 'hex');

    // 生成密钥
    const { key } = this.generateKey(password, saltBuffer);

    // 创建解密流
    const decipher = createDecipheriv('aes-256-cbc', key, ivBuffer);

    // 确保输出文件夹存在
    this.storageCore.ensureFolders(outputPath);

    // 执行解密
    await pipelineAsync(
      createReadStream(inputPath),
      decipher,
      createWriteStream(outputPath)
    );
  }

  /**
   * 检查文件是否已加密
   * @param filePath 文件路径
   * @returns 是否为加密文件
   */
  isEncryptedFile(filePath: string): boolean {
    return filePath.includes(this.ENCRYPTED_FOLDER);
  }

  /**
   * 检查并处理加密文件
   * @param filePath 文件路径
   * @returns 包含加密信息的对象
   */
  checkAndProcessEncryptedFile(filePath: string): {
    isEncrypted: boolean;
    encryptedPath?: string | null;
    encryptionIv?: string | null;
    encryptionSalt?: string | null;
    originalPath?: string | null;
  } {
    // 检查文件是否为加密文件
    const isEncrypted = this.isEncryptedFile(filePath);

    if (isEncrypted) {
      // 对于加密文件，我们假设它已经有相关的加密信息
      // 在实际实现中，可能需要从文件元数据或数据库中获取加密信息
      // 这里返回一个基本结构，实际值可能需要从其他地方获取
      return {
        isEncrypted: true,
        encryptedPath: filePath,
        encryptionIv: null, // 实际应用中可能需要从元数据或数据库中获取
        encryptionSalt: null, // 实际应用中可能需要从元数据或数据库中获取
        originalPath: null, // 加密文件没有原始路径，或者需要从其他地方获取
      };
    }

    // 非加密文件，返回默认值
    return {
      isEncrypted: false,
      encryptedPath: null,
      encryptionIv: null,
      encryptionSalt: null,
      originalPath: null,
    };
  }
}
