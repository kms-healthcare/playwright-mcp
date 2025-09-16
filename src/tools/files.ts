/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations of the License.
 */

import { z } from 'zod';
import { defineTabTool } from './tool.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const uploadFile = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_file_upload',
    title: 'Upload files',
    description: 'Upload one or multiple files from S3',
    inputSchema: z.object({
      s3Keys: z.array(z.string()).describe('The S3 keys of the files to upload. Can be a single file or multiple files.'),
    }),
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const modalState = tab.modalStates().find(state => state.type === 'fileChooser');
    if (!modalState)
      throw new Error('No file chooser visible');

    const bucketName = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;

    if (!bucketName || !region) {
      throw new Error('AWS_S3_BUCKET and AWS_REGION environment variables must be set');
    }

    const s3Client = new S3Client({ region });
    const localPaths: string[] = [];

    try {
      for (const s3Key of params.s3Keys) {
        const getObjectCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
        });

        const s3Response = await s3Client.send(getObjectCommand);

        if (!s3Response.Body) {
          throw new Error(`Failed to get file body for ${s3Key}`);
        }

        const chunks: Uint8Array[] = [];
        for await (const chunk of s3Response.Body as any) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const fileName = s3Key.split('/').pop() || s3Key;
        const localPath = join(tmpdir(), `playwright-upload-${Date.now()}-${fileName}`);
        writeFileSync(localPath, buffer);
        localPaths.push(localPath);
      }

      response.addCode(`await fileChooser.setFiles(${JSON.stringify(localPaths)}) // upload from s3: ${params.s3Keys.join(', ')}`);

      tab.clearModalState(modalState);
      await tab.waitForCompletion(async () => {
        await modalState.fileChooser.setFiles(localPaths);
      });

      response.addResult(`Successfully uploaded ${localPaths.length} file(s) from S3`);
      
      // Store file paths for cleanup when tab closes/navigates
      // Don't delete immediately as browser may need files during form submission
      (tab as any)._tempFilePaths = ((tab as any)._tempFilePaths || []).concat(localPaths);
      
    } catch (error) {
      // Clean up on error
      for (const localPath of localPaths) {
        try {
          unlinkSync(localPath);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temporary file ${localPath}:`, cleanupError);
        }
      }
      throw error;
    }
  },
  clearsModalState: 'fileChooser',
});

export default [
  uploadFile,
];
